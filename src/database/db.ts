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

// ---- USER TYPES ----
export interface PaymentAccounts {
  fib: string;
}

export interface SecurityQuestion {
  question: string;
  answer: string;
}

export interface User {
  id: string;
  shopName: string;
  ownerName: string;
  phone: string;
  email?: string;
  pin: string;         // Stored as SHA-256 hash
  role: 'admin' | 'cashier';
  createdAt: string;
  paymentAccounts?: PaymentAccounts;
  securityQuestion?: SecurityQuestion;
  emailVerified?: boolean;
}

// ---- WEB: User Functions ----
async function webRegisterUser(
  shopName: string, ownerName: string, phone: string, pinHash: string,
  email?: string, securityQuestion?: SecurityQuestion
): Promise<User> {
  const users = webGetStore<User>('iraqi_pos_users');
  if (users.find(u => u.phone === phone)) throw new Error('PHONE_EXISTS');
  const user: User = {
    id: generateId(), shopName, ownerName, phone,
    email, pin: pinHash, role: 'admin',
    createdAt: getLocalDateTimeString(),
    securityQuestion, emailVerified: false,
  };
  users.push(user);
  webSetStore('iraqi_pos_users', users);
  return user;
}

async function webLoginUser(phone: string, pinHash: string): Promise<User | null> {
  return webGetStore<User>('iraqi_pos_users').find(u => u.phone === phone && u.pin === pinHash) || null;
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

// Password reset via security question
async function webResetPIN(phone: string, securityAnswer: string, newPinHash: string): Promise<boolean> {
  const users = webGetStore<User>('iraqi_pos_users');
  const user = users.find(u => u.phone === phone);
  if (!user || !user.securityQuestion) return false;
  if (user.securityQuestion.answer.toLowerCase().trim() !== securityAnswer.toLowerCase().trim()) return false;
  const idx = users.findIndex(u => u.phone === phone);
  if (idx >= 0) { users[idx] = { ...users[idx], pin: newPinHash }; webSetStore('iraqi_pos_users', users); }
  return true;
}

// Get user by phone (for password reset)
async function webGetUserByPhone(phone: string): Promise<User | null> {
  return webGetStore<User>('iraqi_pos_users').find(u => u.phone === phone) || null;
}

// Update email verification status
async function webVerifyEmail(userId: string): Promise<void> {
  const users = webGetStore<User>('iraqi_pos_users');
  const idx = users.findIndex(u => u.id === userId);
  if (idx >= 0) { users[idx] = { ...users[idx], emailVerified: true }; webSetStore('iraqi_pos_users', users); }
}

// Update user email
async function webUpdateUserEmail(userId: string, email: string): Promise<void> {
  const users = webGetStore<User>('iraqi_pos_users');
  const idx = users.findIndex(u => u.id === userId);
  if (idx >= 0) { users[idx] = { ...users[idx], email, emailVerified: false }; webSetStore('iraqi_pos_users', users); }
}

// ---- NATIVE: SQLite ----
let db: any = null;
let dbInitPromise: Promise<any> | null = null;

async function getNativeDatabase(): Promise<any> {
  if (db) return db;
  if (dbInitPromise) return dbInitPromise;
  dbInitPromise = (async () => {
    const SQLite = require('expo-sqlite');
    db = await SQLite.openDatabaseAsync('iraqi_pos.db');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT, nameKu TEXT, nameEn TEXT, barcode TEXT, price REAL, category TEXT, stock REAL, imageUri TEXT, createdAt TEXT, updatedAt TEXT, shopId TEXT);
      CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, items TEXT, total REAL, paymentMethod TEXT, amountPaid REAL, changeAmount REAL, status TEXT, createdAt TEXT, shopId TEXT);
      CREATE TABLE IF NOT EXISTS pending_sync (id TEXT PRIMARY KEY, transactionId TEXT, data TEXT, type TEXT, createdAt TEXT, retryCount REAL, shopId TEXT);
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, shopName TEXT, ownerName TEXT, phone TEXT, email TEXT, pin TEXT, role TEXT, createdAt TEXT, paymentAccounts TEXT, securityQuestion TEXT, emailVerified REAL, shopId TEXT);
    `);
    return db;
  })();
  return dbInitPromise;
}

let currentUserId = '';

async function nativeGetAllProducts(): Promise<Product[]> {
  const d = await getNativeDatabase();
  const rows = await d.getAllAsync('SELECT * FROM products WHERE shopId=?', [currentUserId]);
  return rows.map((r: any) => ({ ...r, stock: Number(r.stock) }));
}
async function nativeGetProductsByCategory(category: string): Promise<Product[]> {
  const d = await getNativeDatabase();
  if (category === 'all') return nativeGetAllProducts();
  const rows = await d.getAllAsync('SELECT * FROM products WHERE category=? AND shopId=?', [category, currentUserId]);
  return rows.map((r: any) => ({ ...r, stock: Number(r.stock) }));
}
async function nativeGetProductByBarcode(barcode: string): Promise<Product | null> {
  const d = await getNativeDatabase();
  return await d.getFirstAsync('SELECT * FROM products WHERE barcode=? AND shopId=?', [barcode, currentUserId]) || null;
}
async function nativeSearchProducts(query: string): Promise<Product[]> {
  const d = await getNativeDatabase();
  return await d.getAllAsync('SELECT * FROM products WHERE shopId=? AND (name LIKE ? OR nameEn LIKE ? OR barcode LIKE ?)', [currentUserId, `%${query}%`, `%${query}%`, `%${query}%`]);
}
async function nativeAddProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
  const d = await getNativeDatabase();
  const now = getLocalDateTimeString();
  const id = generateId();
  await d.runAsync('INSERT INTO products (id, name, nameKu, nameEn, barcode, price, category, stock, imageUri, createdAt, updatedAt, shopId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, product.name, product.nameKu || '', product.nameEn || '', product.barcode || '', product.price, product.category, product.stock, product.imageUri || '', now, now, currentUserId]);
  return { ...product, id, createdAt: now, updatedAt: now };
}
async function nativeUpdateProduct(product: Product): Promise<void> {
  const d = await getNativeDatabase();
  await d.runAsync('UPDATE products SET name=?, nameKu=?, nameEn=?, barcode=?, price=?, category=?, stock=?, imageUri=?, updatedAt=? WHERE id=? AND shopId=?',
    [product.name, product.nameKu || '', product.nameEn || '', product.barcode || '', product.price, product.category, product.stock, product.imageUri || '', getLocalDateTimeString(), product.id, currentUserId]);
}
async function nativeDeleteProduct(id: string): Promise<void> {
  (await getNativeDatabase()).runAsync('DELETE FROM products WHERE id=? AND shopId=?', [id, currentUserId]);
}
async function nativeSaveTransaction(tx: Transaction): Promise<void> {
  const d = await getNativeDatabase();
  await d.runAsync('INSERT INTO transactions (id, items, total, paymentMethod, amountPaid, changeAmount, status, createdAt, shopId) VALUES (?,?,?,?,?,?,?,?,?)',
    [tx.id, JSON.stringify(tx.items), tx.total, tx.paymentMethod, tx.amountPaid, tx.change, tx.status, tx.createdAt, currentUserId]);
}
async function nativeGetTransactionsByDate(date: string): Promise<Transaction[]> {
  const d = await getNativeDatabase();
  return await d.getAllAsync('SELECT * FROM transactions WHERE createdAt LIKE ? AND shopId=?', [date + '%', currentUserId]);
}
async function nativeGetPendingSyncItems(): Promise<PendingSyncItem[]> {
  return (await getNativeDatabase()).getAllAsync('SELECT * FROM pending_sync WHERE shopId=?', [currentUserId]);
}
async function nativeAddPendingSync(item: Omit<PendingSyncItem, 'id'>): Promise<void> {
  const d = await getNativeDatabase();
  await d.runAsync('INSERT INTO pending_sync (id, transactionId, data, type, createdAt, retryCount, shopId) VALUES (?,?,?,?,?,?,?)',
    [generateId(), item.transactionId, item.data, item.type, item.createdAt, item.retryCount, currentUserId]);
}
async function nativeRemovePendingSync(id: string): Promise<void> {
  (await getNativeDatabase()).runAsync('DELETE FROM pending_sync WHERE id=? AND shopId=?', [id, currentUserId]);
}
async function nativeUpdatePaymentAccounts(userId: string, accounts: PaymentAccounts): Promise<void> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem('iraqi_pos_payment_accounts_' + userId, JSON.stringify(accounts));
  } catch {}
}
async function nativeGetPaymentAccounts(userId: string): Promise<PaymentAccounts | null> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const data = await AsyncStorage.getItem('iraqi_pos_payment_accounts_' + userId);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

async function nativeRegisterUser(
  shopName: string, ownerName: string, phone: string, pinHash: string,
  email?: string, securityQuestion?: SecurityQuestion
): Promise<User> {
  const d = await getNativeDatabase();
  const existing = await d.getFirstAsync('SELECT * FROM users WHERE phone=?', [phone]);
  if (existing) throw new Error('PHONE_EXISTS');
  const id = generateId();
  await d.runAsync('INSERT INTO users (id, shopName, ownerName, phone, email, pin, role, createdAt, securityQuestion, emailVerified, shopId) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [id, shopName, ownerName, phone, email || '', pinHash, 'admin', getLocalDateTimeString(), JSON.stringify(securityQuestion || null), 0, id]);
  currentUserId = id;
  return { id, shopName, ownerName, phone, email, pin: pinHash, role: 'admin', createdAt: getLocalDateTimeString(), securityQuestion, emailVerified: false };
}

async function nativeLoginUser(phone: string, pinHash: string): Promise<User | null> {
  const d = await getNativeDatabase();
  const row = await d.getFirstAsync('SELECT * FROM users WHERE phone=? AND pin=?', [phone, pinHash]);
  if (row) currentUserId = row.id;
  return row || null;
}

async function nativeHasAnyUser(): Promise<boolean> {
  const d = await getNativeDatabase();
  const row = await d.getFirstAsync('SELECT COUNT(*) as cnt FROM users');
  return row?.cnt > 0;
}

async function nativeResetPIN(phone: string, securityAnswer: string, newPinHash: string): Promise<boolean> {
  const d = await getNativeDatabase();
  const user = await d.getFirstAsync('SELECT * FROM users WHERE phone=?', [phone]);
  if (!user || !user.securityQuestion) return false;
  const sq = JSON.parse(user.securityQuestion);
  if (sq.answer.toLowerCase().trim() !== securityAnswer.toLowerCase().trim()) return false;
  await d.runAsync('UPDATE users SET pin=? WHERE phone=?', [newPinHash, phone]);
  return true;
}

async function nativeGetUserByPhone(phone: string): Promise<User | null> {
  const d = await getNativeDatabase();
  return await d.getFirstAsync('SELECT * FROM users WHERE phone=?', [phone]) || null;
}

async function nativeVerifyEmail(userId: string): Promise<void> {
  const d = await getNativeDatabase();
  await d.runAsync('UPDATE users SET emailVerified=1 WHERE id=?', [userId]);
}

async function nativeUpdateUserEmail(userId: string, email: string): Promise<void> {
  const d = await getNativeDatabase();
  await d.runAsync('UPDATE users SET email=?, emailVerified=0 WHERE id=?', [email, userId]);
}

// ---- EXPORTS ----
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
export const seedDemoProducts = isWeb ? webSeedDemoProducts : async () => {};
export const registerUser = isWeb ? webRegisterUser : nativeRegisterUser;
export const loginUser = isWeb ? webLoginUser : nativeLoginUser;
export const hasAnyUser = isWeb ? webHasAnyUser : nativeHasAnyUser;
export const updatePaymentAccounts = isWeb ? webUpdatePaymentAccounts : nativeUpdatePaymentAccounts;
export const getPaymentAccounts = isWeb ? webGetPaymentAccounts : nativeGetPaymentAccounts;
export const resetPIN = isWeb ? webResetPIN : nativeResetPIN;
export const getUserByPhone = isWeb ? webGetUserByPhone : nativeGetUserByPhone;
export const verifyEmail = isWeb ? webVerifyEmail : nativeVerifyEmail;
export const updateUserEmail = isWeb ? webUpdateUserEmail : nativeUpdateUserEmail;
