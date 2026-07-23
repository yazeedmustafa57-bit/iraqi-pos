import { Product, Transaction, PendingSyncItem, PaymentMethod } from '../types';
import { generateId } from '../utils/uuid';
import { getLocalDateString, getLocalDateTimeString } from '../utils/dateHelper';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

// ---- WEB: localStorage ----
function webGetStore<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function webSetStore<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

async function webGetAllProducts(): Promise<Product[]> { return webGetStore<Product>('iraqi_pos_products'); }
async function webGetProductsByCategory(category: string): Promise<Product[]> {
  if (category === 'all') return webGetAllProducts();
  return webGetStore<Product>('iraqi_pos_products').filter(p => p.category === category);
}
async function webGetProductByBarcode(barcode: string): Promise<Product | null> {
  return webGetStore<Product>('iraqi_pos_products').find(p => p.barcode === barcode) || null;
}
async function webSearchProducts(query: string): Promise<Product[]> {
  const q = query.toLowerCase();
  return webGetStore<Product>('iraqi_pos_products').filter(p =>
    p.name.toLowerCase().includes(q) || (p.nameEn || '').toLowerCase().includes(q) || (p.barcode || '').includes(q)
  );
}
async function webAddProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
  const products = webGetStore<Product>('iraqi_pos_products');
  const now = getLocalDateTimeString();
  const np: Product = { ...product, id: generateId(), createdAt: now, updatedAt: now };
  products.push(np);
  webSetStore('iraqi_pos_products', products);
  return np;
}
async function webUpdateProduct(product: Product): Promise<void> {
  const products = webGetStore<Product>('iraqi_pos_products');
  const idx = products.findIndex(p => p.id === product.id);
  if (idx >= 0) { products[idx] = { ...product, updatedAt: getLocalDateTimeString() }; webSetStore('iraqi_pos_products', products); }
}
async function webDeleteProduct(id: string): Promise<void> {
  webSetStore('iraqi_pos_products', webGetStore<Product>('iraqi_pos_products').filter(p => p.id !== id));
}
async function webSaveTransaction(tx: Transaction): Promise<void> {
  const txs = webGetStore<Transaction>('iraqi_pos_transactions');
  txs.push(tx);
  webSetStore('iraqi_pos_transactions', txs);
}
async function webGetTransactionsByDate(date: string): Promise<Transaction[]> {
  return webGetStore<Transaction>('iraqi_pos_transactions').filter(tx => tx.createdAt.startsWith(date));
}
async function webGetPendingSyncItems(): Promise<PendingSyncItem[]> { return webGetStore<PendingSyncItem>('iraqi_pos_pending_sync'); }
async function webAddPendingSync(item: Omit<PendingSyncItem, 'id'>): Promise<void> {
  const items = webGetStore<PendingSyncItem>('iraqi_pos_pending_sync');
  items.push({ ...item, id: generateId() });
  webSetStore('iraqi_pos_pending_sync', items);
}
async function webRemovePendingSync(id: string): Promise<void> {
  webSetStore('iraqi_pos_pending_sync', webGetStore<PendingSyncItem>('iraqi_pos_pending_sync').filter(i => i.id !== id));
}
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

export interface PaymentAccounts {
  fib: string;
  zaincash: string;
  fastpay: string;
  asia_hawala: string;
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

// ---- NATIVE: SQLite ----
let db: any = null;
let dbInitPromise: Promise<any> | null = null;

async function getNativeDatabase(): Promise<any> {
  if (db) return db;
  if (dbInitPromise) return dbInitPromise;
  dbInitPromise = (async () => {
    const SQLite = require('expo-sqlite');
    const instance = await SQLite.openDatabaseAsync('iraqi_pos.db');
    await instance.execAsync(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, nameKu TEXT, nameEn TEXT, barcode TEXT UNIQUE, price INTEGER NOT NULL, category TEXT NOT NULL DEFAULT 'other', stock INTEGER NOT NULL DEFAULT 0, imageUri TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, items TEXT NOT NULL, total INTEGER NOT NULL, paymentMethod TEXT NOT NULL, amountPaid INTEGER NOT NULL, change INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'completed', createdAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS pending_sync (id TEXT PRIMARY KEY, transactionId TEXT NOT NULL, data TEXT NOT NULL, type TEXT NOT NULL, createdAt TEXT NOT NULL, retryCount INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, shopName TEXT NOT NULL, ownerName TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, pin TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'admin', createdAt TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(createdAt);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);`);
    db = instance;
    return instance;
  })();
  return dbInitPromise;
}

function mapRowToProduct(row: any): Product {
  return { id: row.id, name: row.name, nameKu: row.nameKu, nameEn: row.nameEn, barcode: row.barcode, price: row.price, category: row.category, stock: row.stock, imageUri: row.imageUri, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

async function nativeGetAllProducts(): Promise<Product[]> {
  const d = await getNativeDatabase();
  return (await d.getAllAsync('SELECT * FROM products ORDER BY name')).map(mapRowToProduct);
}
async function nativeGetProductsByCategory(category: string): Promise<Product[]> {
  if (category === 'all') return nativeGetAllProducts();
  const d = await getNativeDatabase();
  return (await d.getAllAsync('SELECT * FROM products WHERE category = ? ORDER BY name', [category])).map(mapRowToProduct);
}
async function nativeGetProductByBarcode(barcode: string): Promise<Product | null> {
  const d = await getNativeDatabase();
  const r = await d.getFirstAsync('SELECT * FROM products WHERE barcode = ?', [barcode]);
  return r ? mapRowToProduct(r) : null;
}
async function nativeSearchProducts(query: string): Promise<Product[]> {
  const d = await getNativeDatabase();
  return (await d.getAllAsync('SELECT * FROM products WHERE name LIKE ? OR nameEn LIKE ? OR barcode LIKE ? ORDER BY name', [`%${query}%`, `%${query}%`, `%${query}%`])).map(mapRowToProduct);
}
async function nativeAddProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
  const d = await getNativeDatabase(); const now = getLocalDateTimeString(); const id = generateId();
  await d.runAsync('INSERT INTO products (id, name, nameKu, nameEn, barcode, price, category, stock, imageUri, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, product.name, product.nameKu || null, product.nameEn || null, product.barcode || null, product.price, product.category, product.stock, product.imageUri || null, now, now]);
  return { ...product, id, createdAt: now, updatedAt: now };
}
async function nativeUpdateProduct(product: Product): Promise<void> {
  const d = await getNativeDatabase(); const now = getLocalDateTimeString();
  await d.runAsync('UPDATE products SET name=?, nameKu=?, nameEn=?, barcode=?, price=?, category=?, stock=?, imageUri=?, updatedAt=? WHERE id=?',
    [product.name, product.nameKu || null, product.nameEn || null, product.barcode || null, product.price, product.category, product.stock, product.imageUri || null, now, product.id]);
}
async function nativeDeleteProduct(id: string): Promise<void> { (await getNativeDatabase()).runAsync('DELETE FROM products WHERE id=?', [id]); }
async function nativeSaveTransaction(tx: Transaction): Promise<void> {
  (await getNativeDatabase()).runAsync('INSERT INTO transactions (id, items, total, paymentMethod, amountPaid, change, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [tx.id, JSON.stringify(tx.items), tx.total, tx.paymentMethod, tx.amountPaid, tx.change, tx.status, tx.createdAt]);
}
async function nativeGetTransactionsByDate(date: string): Promise<Transaction[]> {
  return (await (await getNativeDatabase()).getAllAsync("SELECT * FROM transactions WHERE date(createdAt) = date(?) ORDER BY createdAt DESC", [date])).map((r: any) => ({ ...r, items: JSON.parse(r.items) }));
}
async function nativeGetPendingSyncItems(): Promise<PendingSyncItem[]> { return (await getNativeDatabase()).getAllAsync('SELECT * FROM pending_sync ORDER BY createdAt'); }
async function nativeAddPendingSync(item: Omit<PendingSyncItem, 'id'>): Promise<void> {
  (await getNativeDatabase()).runAsync('INSERT INTO pending_sync (id, transactionId, data, type, createdAt, retryCount) VALUES (?, ?, ?, ?, ?, ?)',
    [generateId(), item.transactionId, item.data, item.type, item.createdAt, item.retryCount]);
}
async function nativeRemovePendingSync(id: string): Promise<void> { (await getNativeDatabase()).runAsync('DELETE FROM pending_sync WHERE id=?', [id]); }
async function nativeSeedDemoProducts(): Promise<void> {
  if ((await nativeGetAllProducts()).length > 0) return;
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
  for (const p of demos) await nativeAddProduct(p);
}
async function nativeRegisterUser(shopName: string, ownerName: string, phone: string, pin: string): Promise<User> {
  const d = await getNativeDatabase();
  const existing = await d.getFirstAsync('SELECT id FROM users WHERE phone = ?', [phone]);
  if (existing) throw new Error('PHONE_EXISTS');
  const id = generateId(); const now = getLocalDateTimeString();
  await d.runAsync('INSERT INTO users (id, shopName, ownerName, phone, pin, role, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, shopName, ownerName, phone, pin, 'admin', now]);
  return { id, shopName, ownerName, phone, pin, role: 'admin', createdAt: now };
}
async function nativeLoginUser(phone: string, pin: string): Promise<User | null> {
  const r = await (await getNativeDatabase()).getFirstAsync('SELECT * FROM users WHERE phone = ? AND pin = ?', [phone, pin]);
  return r ? { id: r.id, shopName: r.shopName, ownerName: r.ownerName, phone: r.phone, pin: r.pin, role: r.role, createdAt: r.createdAt } : null;
}
async function nativeHasAnyUser(): Promise<boolean> {
  const r = await (await getNativeDatabase()).getFirstAsync('SELECT COUNT(*) as count FROM users');
  return r && r.count > 0;
}

// ---- Export ----
async function nativeUpdatePaymentAccounts(userId: string, accounts: PaymentAccounts): Promise<void> {
  // Store in AsyncStorage for native
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const key = 'iraqi_pos_payment_accounts_' + userId;
    await AsyncStorage.setItem(key, JSON.stringify(accounts));
  } catch {}
}
async function nativeGetPaymentAccounts(userId: string): Promise<PaymentAccounts | null> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const key = 'iraqi_pos_payment_accounts_' + userId;
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

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
export const updatePaymentAccounts = isWeb ? webUpdatePaymentAccounts : nativeUpdatePaymentAccounts;
export const getPaymentAccounts = isWeb ? webGetPaymentAccounts : nativeGetPaymentAccounts;
export const loginUser = isWeb ? webLoginUser : nativeLoginUser;
export const hasAnyUser = isWeb ? webHasAnyUser : nativeHasAnyUser;
