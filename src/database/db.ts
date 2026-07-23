import { Product, Transaction, PendingSyncItem, PaymentMethod } from '../types';
import { generateId } from '../utils/uuid';
import { getLocalDateString, getLocalDateTimeString } from '../utils/dateHelper';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

// ============================================================
// MULTI-SHOP ISOLATION
// Each shop (user) has isolated data via userId-prefixed keys
// ============================================================
let currentUserId: string = '';

export function setCurrentShop(userId: string): void {
  currentUserId = userId;
}

export function getCurrentShopId(): string {
  return currentUserId;
}

// ============================================================
// WEB: localStorage with per-shop isolation
// ============================================================
function webGetStore<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function webSetStore<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

// Shop-prefixed storage keys
function shopKey(base: string): string {
  return currentUserId ? `${base}_${currentUserId}` : base;
}

// ============================================================
// PRODUCTS (per shop)
// ============================================================
async function webGetAllProducts(): Promise<Product[]> { return webGetStore<Product>(shopKey('iraqi_pos_products')); }
async function webGetProductsByCategory(category: string): Promise<Product[]> {
  if (category === 'all') return webGetAllProducts();
  return webGetStore<Product>(shopKey('iraqi_pos_products')).filter(p => p.category === category);
}
async function webGetProductByBarcode(barcode: string): Promise<Product | null> {
  return webGetStore<Product>(shopKey('iraqi_pos_products')).find(p => p.barcode === barcode) || null;
}
async function webSearchProducts(query: string): Promise<Product[]> {
  const q = query.toLowerCase();
  return webGetStore<Product>(shopKey('iraqi_pos_products')).filter(p =>
    p.name.toLowerCase().includes(q) || (p.nameEn || '').toLowerCase().includes(q) || (p.barcode || '').includes(q)
  );
}
async function webAddProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
  const key = shopKey('iraqi_pos_products');
  const products = webGetStore<Product>(key);
  const now = getLocalDateTimeString();
  const np: Product = { ...product, id: generateId(), createdAt: now, updatedAt: now };
  products.push(np);
  webSetStore(key, products);
  return np;
}
async function webUpdateProduct(product: Product): Promise<void> {
  const key = shopKey('iraqi_pos_products');
  const products = webGetStore<Product>(key);
  const idx = products.findIndex(p => p.id === product.id);
  if (idx >= 0) { products[idx] = { ...product, updatedAt: getLocalDateTimeString() }; webSetStore(key, products); }
}
async function webDeleteProduct(id: string): Promise<void> {
  const key = shopKey('iraqi_pos_products');
  webSetStore(key, webGetStore<Product>(key).filter(p => p.id !== id));
}

// ============================================================
// TRANSACTIONS (per shop)
// ============================================================
async function webSaveTransaction(tx: Transaction): Promise<void> {
  const key = shopKey('iraqi_pos_transactions');
  const txs = webGetStore<Transaction>(key);
  txs.push(tx);
  webSetStore(key, txs);
}
async function webGetTransactionsByDate(date: string): Promise<Transaction[]> {
  return webGetStore<Transaction>(shopKey('iraqi_pos_transactions')).filter(tx => tx.createdAt.startsWith(date));
}

// ============================================================
// PENDING SYNC (per shop)
// ============================================================
async function webGetPendingSyncItems(): Promise<PendingSyncItem[]> { return webGetStore<PendingSyncItem>(shopKey('iraqi_pos_pending_sync')); }
async function webAddPendingSync(item: Omit<PendingSyncItem, 'id'>): Promise<void> {
  const key = shopKey('iraqi_pos_pending_sync');
  const items = webGetStore<PendingSyncItem>(key);
  items.push({ ...item, id: generateId() });
  webSetStore(key, items);
}
async function webRemovePendingSync(id: string): Promise<void> {
  const key = shopKey('iraqi_pos_pending_sync');
  webSetStore(key, webGetStore<PendingSyncItem>(key).filter(i => i.id !== id));
}

// ============================================================
// SEED DEMO PRODUCTS (per shop, only if empty)
// ============================================================
async function webSeedDemoProducts(): Promise<void> {
  if ((await webGetAllProducts()).length > 0) return;
  const demos = [
    { name: 'بيبسي عبوة', nameEn: 'Pepsi Can', barcode: '6281001001001', price: 1000, category: 'drinks', stock: 100 },
    { name: 'ماء نقي عبوة', nameEn: 'Water Bottle', barcode: '6281001001002', price: 500, category: 'drinks', stock: 200 },
    { name: 'شيبس ليز عبوة', nameEn: 'Lays Chips', barcode: '6281001001003', price: 1500, category: 'snacks', stock: 50 },
    { name: 'سكر كيلو', nameEn: 'Sugar 1kg', barcode: '6281001001004', price: 3000, category: 'food', stock: 80 },
    { name: 'أرز بسمتي 5 كيلو', nameEn: 'Basmati Rice 5kg', barcode: '6281001001005', price: 25000, category: 'food', stock: 30 },
    { name: 'زيت ذرة لتر', nameEn: 'Corn Oil 1L', barcode: '6281001001006', price: 8000, category: 'food', stock: 40 },
    { name: 'حليب بودرة', nameEn: 'Milk Powder', barcode: '6281001001007', price: 12000, category: 'food', stock: 25 },
    { name: 'صابون', nameEn: 'Soap', barcode: '6281001001008', price: 2000, category: 'household', stock: 60 },
    { name: 'معقم يد', nameEn: 'Hand Sanitizer', barcode: '6281001001009', price: 3500, category: 'household', stock: 45 },
    { name: 'علبة شاي', nameEn: 'Tea Box', barcode: '6281001001010', price: 4500, category: 'food', stock: 35 },
  ];
  for (const p of demos) await webAddProduct(p);
}

// ============================================================
// USERS (shared - needed for login/registration)
// ============================================================
export interface PaymentAccounts {
  fib: string;
}

export interface User { id: string; shopName: string; ownerName: string; phone: string; pin: string; role: 'admin' | 'cashier'; createdAt: string; paymentAccounts?: PaymentAccounts; }

async function webRegisterUser(shopName: string, ownerName: string, phone: string, pin: string): Promise<User> {
  const users = webGetStore<User>('iraqi_pos_users');
  if (users.find(u => u.phone === phone)) throw new Error('PHONE_EXISTS');
  const user: User = { id: generateId(), shopName, ownerName, phone, pin, role: 'admin', createdAt: getLocalDateTimeString() };
  users.push(user);
  webSetStore('iraqi_pos_users', users);
  return user;
}
async function webLoginUser(phone: string, pin: string): Promise<User | null> {
  return webGetStore<User>('iraqi_pos_users').find(u => u.phone === phone && u.pin === pin) || null;
}
async function webHasAnyUser(): Promise<boolean> { return webGetStore<User>('iraqi_pos_users').length > 0; }

async function webUpdatePaymentAccounts(userId: string, accounts: PaymentAccounts): Promise<void> {
  const users = webGetStore<User>('iraqi_pos_users');
  const idx = users.findIndex(u => u.id === userId);
  if (idx >= 0) { users[idx] = { ...users[idx], paymentAccounts: accounts }; webSetStore('iraqi_pos_users', users); }
}
async function webGetPaymentAccounts(userId: string): Promise<PaymentAccounts | null> {
  const user = webGetStore<User>('iraqi_pos_users').find(u => u.id === userId);
  return user?.paymentAccounts || null;
}

// ============================================================
// NATIVE: SQLite with per-shop tables
// ============================================================
let db: any = null;
let dbInitPromise: Promise<any> | null = null;

async function getNativeDatabase(): Promise<any> {
  if (db) return db;
  if (dbInitPromise) return dbInitPromise;
  dbInitPromise = (async () => {
    const SQLite = require('expo-sqlite');
    db = await SQLite.openDatabaseAsync('iraqi_pos.db');
    await db.execAsync(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, shopName TEXT, ownerName TEXT, phone TEXT, pin TEXT, role TEXT, createdAt TEXT, paymentAccounts TEXT);`);
    await db.execAsync(`CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT, nameKu TEXT, nameEn TEXT, barcode TEXT, price INTEGER, category TEXT, stock INTEGER, imageUri TEXT, createdAt TEXT, updatedAt TEXT, shopId TEXT);`);
    await db.execAsync(`CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, items TEXT, total INTEGER, paymentMethod TEXT, amountPaid INTEGER, changeAmount INTEGER, status TEXT, createdAt TEXT, shopId TEXT);`);
    await db.execAsync(`CREATE TABLE IF NOT EXISTS pending_sync (id TEXT PRIMARY KEY, transactionId TEXT, data TEXT, type TEXT, createdAt TEXT, retryCount INTEGER, shopId TEXT);`);
    return db;
  })();
  return dbInitPromise;
}

async function nativeGetAllProducts(): Promise<Product[]> {
  const d = await getNativeDatabase();
  const rows = await d.getAllAsync('SELECT * FROM products WHERE shopId=?', [currentUserId]);
  return rows.map((row: any) => ({ id: row.id, name: row.name, nameKu: row.nameKu, nameEn: row.nameEn, barcode: row.barcode, price: row.price, category: row.category, stock: row.stock, imageUri: row.imageUri, createdAt: row.createdAt, updatedAt: row.updatedAt }));
}
async function nativeGetProductsByCategory(category: string): Promise<Product[]> {
  const d = await getNativeDatabase();
  if (category === 'all') return nativeGetAllProducts();
  const rows = await d.getAllAsync('SELECT * FROM products WHERE category=? AND shopId=?', [category, currentUserId]);
  return rows.map((row: any) => ({ id: row.id, name: row.name, nameKu: row.nameKu, nameEn: row.nameEn, barcode: row.barcode, price: row.price, category: row.category, stock: row.stock, imageUri: row.imageUri, createdAt: row.createdAt, updatedAt: row.updatedAt }));
}
async function nativeGetProductByBarcode(barcode: string): Promise<Product | null> {
  const d = await getNativeDatabase();
  const row = await d.getFirstAsync('SELECT * FROM products WHERE barcode=? AND shopId=?', [barcode, currentUserId]);
  return row ? { id: row.id, name: row.name, nameKu: row.nameKu, nameEn: row.nameEn, barcode: row.barcode, price: row.price, category: row.category, stock: row.stock, imageUri: row.imageUri, createdAt: row.createdAt, updatedAt: row.updatedAt } : null;
}
async function nativeSearchProducts(query: string): Promise<Product[]> {
  const d = await getNativeDatabase();
  const q = `%${query}%`;
  const rows = await d.getAllAsync('SELECT * FROM products WHERE shopId=? AND (name LIKE ? OR nameEn LIKE ? OR barcode LIKE ?)', [currentUserId, q, q, q]);
  return rows.map((row: any) => ({ id: row.id, name: row.name, nameKu: row.nameKu, nameEn: row.nameEn, barcode: row.barcode, price: row.price, category: row.category, stock: row.stock, imageUri: row.imageUri, createdAt: row.createdAt, updatedAt: row.updatedAt }));
}
async function nativeAddProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
  const d = await getNativeDatabase(); const now = getLocalDateTimeString(); const id = generateId();
  await d.runAsync('INSERT INTO products (id,name,nameKu,nameEn,barcode,price,category,stock,imageUri,createdAt,updatedAt,shopId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, product.name, product.nameKu || '', product.nameEn || '', product.barcode || '', product.price, product.category, product.stock, product.imageUri || '', now, now, currentUserId]);
  return { ...product, id, createdAt: now, updatedAt: now };
}
async function nativeUpdateProduct(product: Product): Promise<void> {
  const d = await getNativeDatabase();
  await d.runAsync('UPDATE products SET name=?,nameKu=?,nameEn=?,barcode=?,price=?,category=?,stock=?,imageUri=?,updatedAt=? WHERE id=? AND shopId=?',
    [product.name, product.nameKu || '', product.nameEn || '', product.barcode || '', product.price, product.category, product.stock, product.imageUri || '', getLocalDateTimeString(), product.id, currentUserId]);
}
async function nativeDeleteProduct(id: string): Promise<void> { (await getNativeDatabase()).runAsync('DELETE FROM products WHERE id=? AND shopId=?', [id, currentUserId]); }
async function nativeSaveTransaction(tx: Transaction): Promise<void> {
  const d = await getNativeDatabase();
  await d.runAsync('INSERT INTO transactions (id,items,total,paymentMethod,amountPaid,changeAmount,status,createdAt,shopId) VALUES (?,?,?,?,?,?,?,?,?)',
    [tx.id, JSON.stringify(tx.items), tx.total, tx.paymentMethod, tx.amountPaid, tx.change, tx.status, tx.createdAt, currentUserId]);
}
async function nativeGetTransactionsByDate(date: string): Promise<Transaction[]> {
  const d = await getNativeDatabase();
  const rows = await d.getAllAsync('SELECT * FROM transactions WHERE createdAt LIKE ? AND shopId=?', [`${date}%`, currentUserId]);
  return rows.map((r: any) => ({ id: r.id, items: JSON.parse(r.items), total: r.total, paymentMethod: r.paymentMethod as PaymentMethod, amountPaid: r.amountPaid, change: r.changeAmount, status: r.status, createdAt: r.createdAt }));
}
async function nativeGetPendingSyncItems(): Promise<PendingSyncItem[]> {
  const d = await getNativeDatabase();
  const rows = await d.getAllAsync('SELECT * FROM pending_sync WHERE shopId=?', [currentUserId]);
  return rows.map((r: any) => ({ id: r.id, transactionId: r.transactionId, data: r.data, type: r.type, createdAt: r.createdAt, retryCount: r.retryCount }));
}
async function nativeAddPendingSync(item: Omit<PendingSyncItem, 'id'>): Promise<void> {
  const d = await getNativeDatabase();
  await d.runAsync('INSERT INTO pending_sync (id,transactionId,data,type,createdAt,retryCount,shopId) VALUES (?,?,?,?,?,?,?)',
    [generateId(), item.transactionId, item.data, item.type, item.createdAt, item.retryCount, currentUserId]);
}
async function nativeRemovePendingSync(id: string): Promise<void> { (await getNativeDatabase()).runAsync('DELETE FROM pending_sync WHERE id=? AND shopId=?', [id, currentUserId]); }

async function nativeRegisterUser(shopName: string, ownerName: string, phone: string, pin: string): Promise<User> {
  const d = await getNativeDatabase();
  const id = generateId();
  const user: User = { id, shopName, ownerName, phone, pin, role: 'admin', createdAt: getLocalDateTimeString() };
  await d.runAsync('INSERT INTO users (id,shopName,ownerName,phone,pin,role,createdAt) VALUES (?,?,?,?,?,?,?)',
    [id, shopName, ownerName, phone, pin, 'admin', user.createdAt]);
  return user;
}
async function nativeLoginUser(phone: string, pin: string): Promise<User | null> {
  const d = await getNativeDatabase();
  const row = await d.getFirstAsync('SELECT * FROM users WHERE phone=? AND pin=?', [phone, pin]);
  return row ? { id: row.id, shopName: row.shopName, ownerName: row.ownerName, phone: row.phone, pin: row.pin, role: row.role, createdAt: row.createdAt, paymentAccounts: row.paymentAccounts ? JSON.parse(row.paymentAccounts) : undefined } : null;
}
async function nativeSeedDemoProducts(): Promise<void> {
  // No-op on native for now
  return;
}
async function nativeHasAnyUser(): Promise<boolean> {
  const d = await getNativeDatabase();
  const row = await d.getFirstAsync('SELECT COUNT(*) as cnt FROM users');
  return row?.cnt > 0;
}

async function nativeUpdatePaymentAccounts(userId: string, accounts: PaymentAccounts): Promise<void> {
  const d = await getNativeDatabase();
  await d.runAsync('UPDATE users SET paymentAccounts=? WHERE id=?', [JSON.stringify(accounts), userId]);
}
async function nativeGetPaymentAccounts(userId: string): Promise<PaymentAccounts | null> {
  const d = await getNativeDatabase();
  const row = await d.getFirstAsync('SELECT paymentAccounts FROM users WHERE id=?', [userId]);
  return row?.paymentAccounts ? JSON.parse(row.paymentAccounts) : null;
}

// ============================================================
// EXPORTS
// ============================================================
export async function getDatabase(): Promise<void> { if (!isWeb) await getNativeDatabase(); }
export const getAllProducts = isWeb ? webGetAllProducts : nativeGetAllProducts;
export const getProductsByCategory = isWeb ? webGetProductsByCategory : nativeGetProductsByCategory;
export const getProductByBarcode = isWeb ? webGetProductByBarcode : nativeGetProductByBarcode;
export const searchProducts = isWeb ? webSearchProducts : nativeSearchProducts;
export const addProduct = isWeb ? webAddProduct : nativeAddProduct;
export const updateProduct = isWeb ? webUpdateProduct : nativeUpdateProduct;
export const deleteProduct = isWeb ? webDeleteProduct : nativeDeleteProduct;
export const saveTransaction = isWeb ? webSaveTransaction : nativeSaveTransaction;
export const getTransactionsByDate = isWeb ? webGetTransactionsByDate : nativeGetTransactionsByDate;
export const getPendingSyncItems = isWeb ? webGetPendingSyncItems : nativeGetPendingSyncItems;
export const addPendingSync = isWeb ? webAddPendingSync : nativeAddPendingSync;
export const removePendingSync = isWeb ? webRemovePendingSync : nativeRemovePendingSync;
export const seedDemoProducts = isWeb ? webSeedDemoProducts : nativeSeedDemoProducts;
export const registerUser = isWeb ? webRegisterUser : nativeRegisterUser;
export const loginUser = isWeb ? webLoginUser : nativeLoginUser;
export const hasAnyUser = isWeb ? webHasAnyUser : nativeHasAnyUser;
export const updatePaymentAccounts = isWeb ? webUpdatePaymentAccounts : nativeUpdatePaymentAccounts;
export const getPaymentAccounts = isWeb ? webGetPaymentAccounts : nativeGetPaymentAccounts;
