export interface Product {
  id: string;
  name: string;
  nameKu?: string;
  nameEn?: string;
  barcode?: string;
  price: number;
  category: string;
  stock: number;
  imageUri?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  subtotal: number;
}

export type PaymentMethod = 'cash' | 'fib';

export interface Transaction {
  id: string;
  items: CartItem[];
  total: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  change: number;
  status: 'completed' | 'pending_sync' | 'failed';
  createdAt: string;
}

export interface DailySummary {
  date: string;
  totalSales: number;
  totalTransactions: number;
  salesByMethod: Record<PaymentMethod, number>;
  transactionsByMethod: Record<PaymentMethod, number>;
}

export interface PendingSyncItem {
  id: string;
  transactionId: string;
  data: string;
  type: 'payment' | 'transaction';
  createdAt: string;
  retryCount: number;
}

export type Language = 'ar' | 'ku' | 'en' | 'de';
