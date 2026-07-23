import { create } from 'zustand';
import { Language, Transaction, DailySummary, PaymentMethod } from '../types';
import { User } from '../database/db';
import { getLocalDateString } from '../utils/dateHelper';

export interface FIBConfig {
  enabled: boolean;
  merchantId: string;
  apiKey: string;
  secretKey: string;
  webhookUrl: string;
  sandboxMode: boolean;
  baseUrl: string;
}

const defaultFIBConfig: FIBConfig = {
  enabled: false,
  merchantId: '',
  apiKey: '',
  secretKey: '',
  webhookUrl: '',
  sandboxMode: true,
  baseUrl: '',
};

interface AppState {
  language: Language;
  setLanguage: (lang: Language) => void;
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;
  printerConnected: boolean;
  setPrinterConnected: (connected: boolean) => void;
  printerDeviceId: string | null;
  setPrinterDeviceId: (id: string | null) => void;
  lastTransaction: Transaction | null;
  setLastTransaction: (tx: Transaction | null) => void;
  showPaymentSuccess: boolean;
  setShowPaymentSuccess: (show: boolean) => void;
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (auth: boolean) => void;
  fibConfig: FIBConfig;
  setFIBConfig: (config: FIBConfig) => void;
}

export const useAppStore = create<AppState>((set) => ({
  language: 'ar',
  setLanguage: (lang) => set({ language: lang }),
  isOnline: true,
  setIsOnline: (online) => set({ isOnline: online }),
  printerConnected: false,
  setPrinterConnected: (connected) => set({ printerConnected: connected }),
  printerDeviceId: null,
  setPrinterDeviceId: (id) => set({ printerDeviceId: id }),
  lastTransaction: null,
  setLastTransaction: (tx) => set({ lastTransaction: tx }),
  showPaymentSuccess: false,
  setShowPaymentSuccess: (show) => set({ showPaymentSuccess: show }),
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),
  isAuthenticated: false,
  setIsAuthenticated: (auth) => set({ isAuthenticated: auth }),
  fibConfig: defaultFIBConfig,
  setFIBConfig: (config) => set({ fibConfig: config }),
}));

export function calculateDailySummary(transactions: Transaction[]): DailySummary {
  const today = getLocalDateString();
  const todayTx = transactions.filter(
    (tx) => tx.createdAt.startsWith(today) && tx.status === 'completed'
  );

  const salesByMethod: Record<PaymentMethod, number> = {
    cash: 0,
    fib: 0,
  };
  const transactionsByMethod: Record<PaymentMethod, number> = {
    cash: 0,
    fib: 0,
  };

  todayTx.forEach((tx) => {
    salesByMethod[tx.paymentMethod] += tx.total;
    transactionsByMethod[tx.paymentMethod] += 1;
  });

  return {
    date: today,
    totalSales: todayTx.reduce((sum, tx) => sum + tx.total, 0),
    totalTransactions: todayTx.length,
    salesByMethod,
    transactionsByMethod,
  };
}
