import * as SQLite from 'expo-sqlite';
import { getLocalDateString, getLocalDateTimeString } from "../utils/dateHelper";
import { Product, Transaction, PendingSyncItem, PaymentMethod } from '../types';
import { generateId } from "../utils/uuid";

let db: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  if (dbInitPromise) return dbInitPromise;
  dbInitPromise = (async () => {
    const instance = await SQLite.openDatabaseAsync('iraqi_pos.db');
    await initDatabase(instance);
    db = instance;
    return instance;
  })();
  return dbInitPromise;
}

async function initDatabase(database: SQLite.SQLiteDatabase) {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      nameKu TEXT,
      nameEn TEXT,
      barcode TEXT UNIQUE,
      price INTEGER NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      stock INTEGER NOT NULL DEFAULT 0,
      imageUri TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      items TEXT NOT NULL,
      total INTEGER NOT NULL,
      paymentMethod TEXT NOT NULL,
      amountPaid INTEGER NOT NULL,
      change INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'completed',
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pending_sync (
      id TEXT PRIMARY KEY,
      transactionId TEXT NOT NULL,
      data TEXT NOT NULL,
      type TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      retryCount INTEGER NOT NULL DEFAULT 0
    );

    
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      shopName TEXT NOT NULL,
      ownerName TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      pin TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      createdAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(createdAt);
    CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
  `);
}

// Product operations
export async function getAllProducts(): Promise<Product[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>('SELECT * FROM products ORDER BY name');
  return rows.map(mapRowToProduct);
}

export async function getProductsByCategory(category: string): Promise<Product[]> {
  const db = await getDatabase();
  if (category === 'all') return getAllProducts();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM products WHERE category = ? ORDER BY name',
    [category]
  );
  return rows.map(mapRowToProduct);
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM products WHERE barcode = ?',
    [barcode]
  );
  return row ? mapRowToProduct(row) : null;
}

export async function searchProducts(query: string): Promise<Product[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM products WHERE name LIKE ? OR nameEn LIKE ? OR barcode LIKE ? ORDER BY name',
    [`%${query}%`, `%${query}%`, `%${query}%`]
  );
  return rows.map(mapRowToProduct);
}

export async function addProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
  const db = await getDatabase();
  const now = getLocalDateTimeString();
  const id = generateId();
  await db.runAsync(
    `INSERT INTO products (id, name, nameKu, nameEn, barcode, price, category, stock, imageUri, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, product.name, product.nameKu || null, product.nameEn || null,
     product.barcode || null, product.price, product.category,
     product.stock, product.imageUri || null, now, now]
  );
  return { ...product, id, createdAt: now, updatedAt: now };
}

export async function updateProduct(product: Product): Promise<void> {
  const db = await getDatabase();
  const now = getLocalDateTimeString();
  await db.runAsync(
    `UPDATE products SET name=?, nameKu=?, nameEn=?, barcode=?, price=?, category=?, stock=?, imageUri=?, updatedAt=?
     WHERE id=?`,
    [product.name, product.nameKu || null, product.nameEn || null,
     product.barcode || null, product.price, product.category,
     product.stock, product.imageUri || null, now, product.id]
  );
}

export async function deleteProduct(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM products WHERE id=?', [id]);
}

// Transaction operations
export async function saveTransaction(transaction: Transaction): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO transactions (id, items, total, paymentMethod, amountPaid, change, status, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [transaction.id, JSON.stringify(transaction.items), transaction.total,
     transaction.paymentMethod, transaction.amountPaid, transaction.change,
     transaction.status, transaction.createdAt]
  );
}

export async function getTransactionsByDate(date: string): Promise<Transaction[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    "SELECT * FROM transactions WHERE date(createdAt) = date(?) ORDER BY createdAt DESC",
    [date]
  );
  return rows.map(r => ({
    ...r,
    items: JSON.parse(r.items),
  }));
}

export async function getTodayTransactions(): Promise<Transaction[]> {
  const today = getLocalDateString();
  return getTransactionsByDate(today);
}

// Pending sync operations
export async function addPendingSync(item: Omit<PendingSyncItem, 'id'>): Promise<void> {
  const db = await getDatabase();
  const id = generateId();
  await db.runAsync(
    'INSERT INTO pending_sync (id, transactionId, data, type, createdAt, retryCount) VALUES (?, ?, ?, ?, ?, ?)',
    [id, item.transactionId, item.data, item.type, item.createdAt, item.retryCount]
  );
}

export async function getPendingSyncItems(): Promise<PendingSyncItem[]> {
  const db = await getDatabase();
  return db.getAllAsync<PendingSyncItem>('SELECT * FROM pending_sync ORDER BY createdAt');
}

export async function removePendingSync(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM pending_sync WHERE id=?', [id]);
}

// Seed demo data
export async function seedDemoProducts(): Promise<void> {
  const existing = await getAllProducts();
  if (existing.length > 0) return;

  const demoProducts = [
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

  for (const p of demoProducts) {
    await addProduct(p);
  }
}


// User/Auth operations
export interface User {
  id: string;
  shopName: string;
  ownerName: string;
  phone: string;
  pin: string;
  role: 'admin' | 'cashier';
  createdAt: string;
}

export async function registerUser(shopName: string, ownerName: string, phone: string, pin: string): Promise<User> {
  const db = await getDatabase();
  const id = generateId();
  const now = getLocalDateTimeString();
  
  // Check if phone already exists
  const existing = await db.getFirstAsync<any>('SELECT id FROM users WHERE phone = ?', [phone]);
  if (existing) {
    throw new Error('PHONE_EXISTS');
  }
  
  await db.runAsync(
    'INSERT INTO users (id, shopName, ownerName, phone, pin, role, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, shopName, ownerName, phone, pin, 'admin', now]
  );
  return { id, shopName, ownerName, phone, pin, role: 'admin', createdAt: now };
}

export async function loginUser(phone: string, pin: string): Promise<User | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM users WHERE phone = ? AND pin = ?',
    [phone, pin]
  );
  return row ? {
    id: row.id,
    shopName: row.shopName,
    ownerName: row.ownerName,
    phone: row.phone,
    pin: row.pin,
    role: row.role,
    createdAt: row.createdAt,
  } : null;
}

export async function hasAnyUser(): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT COUNT(*) as count FROM users');
  return row && row.count > 0;
}

export async function getUserById(id: string): Promise<User | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT * FROM users WHERE id = ?', [id]);
  return row ? {
    id: row.id,
    shopName: row.shopName,
    ownerName: row.ownerName,
    phone: row.phone,
    pin: row.pin,
    role: row.role,
    createdAt: row.createdAt,
  } : null;
}

function mapRowToProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    nameKu: row.nameKu,
    nameEn: row.nameEn,
    barcode: row.barcode,
    price: row.price,
    category: row.category,
    stock: row.stock,
    imageUri: row.imageUri,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
