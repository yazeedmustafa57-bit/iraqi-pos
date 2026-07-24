/**
 * Account Deletion Service
 * 
 * Löscht alle lokalen Daten eines Shops dauerhaft.
 * Nicht rückgängig machbar!
 */

import { hashPIN } from '../utils/crypto';

// All localStorage keys used by the app
const APP_KEYS = [
  'iraqi_pos_products',
  'iraqi_pos_transactions',
  'iraqi_pos_pending_sync',
  'iraqi_pos_users',
];

export interface DeletionResult {
  success: boolean;
  deletedItems: string[];
  error?: string;
}

/**
 * Verify PIN before deletion
 */
export async function verifyPINForDeletion(
  phone: string,
  pin: string,
  storedHash: string
): Promise<boolean> {
  const pinHash = await hashPIN(pin);
  return pinHash === storedHash;
}

/**
 * Delete ALL data for a specific shop
 * This is irreversible!
 */
export function deleteAllShopData(userId: string, phone: string): DeletionResult {
  const deletedItems: string[] = [];

  try {
    // 1. Delete user account
    const users = JSON.parse(localStorage.getItem('iraqi_pos_users') || '[]');
    const filteredUsers = users.filter((u: any) => u.id !== userId);
    localStorage.setItem('iraqi_pos_users', JSON.stringify(filteredUsers));
    deletedItems.push('Shop-Account');

    // 2. Delete products
    const products = JSON.parse(localStorage.getItem('iraqi_pos_products') || '[]');
    const filteredProducts = products.filter((p: any) => p.shopId !== userId);
    localStorage.setItem('iraqi_pos_products', JSON.stringify(filteredProducts));
    deletedItems.push('Produkte');

    // 3. Delete transactions
    const transactions = JSON.parse(localStorage.getItem('iraqi_pos_transactions') || '[]');
    const filteredTransactions = transactions.filter((t: any) => t.shopId !== userId);
    localStorage.setItem('iraqi_pos_transactions', JSON.stringify(filteredTransactions));
    deletedItems.push('Bestellungen');

    // 4. Delete pending sync items
    const pendingSync = JSON.parse(localStorage.getItem('iraqi_pos_pending_sync') || '[]');
    const filteredPendingSync = pendingSync.filter((p: any) => p.shopId !== userId);
    localStorage.setItem('iraqi_pos_pending_sync', JSON.stringify(filteredPendingSync));
    deletedItems.push('Offline-Warteschlange');

    // 5. Delete FIB config for this shop
    localStorage.removeItem(`iraqi_pos_fib_config_${userId}`);
    deletedItems.push('FIB-Konfiguration');

    // 6. Delete login attempts
    localStorage.removeItem(`login_attempts_${phone}`);
    deletedItems.push('Login-Verlauf');

    // 7. Delete payment accounts
    localStorage.removeItem(`iraqi_pos_payment_accounts_${userId}`);
    deletedItems.push('Zahlungskonten');

    // 8. Delete backend token
    localStorage.removeItem(`fib_token_${userId}`);
    deletedItems.push('Backend-Token');

    // 9. Delete current user session
    localStorage.removeItem('iraqi_pos_current_user');
    deletedItems.push('Sitzung');

    return { success: true, deletedItems };
  } catch (error: any) {
    return { success: false, deletedItems, error: error.message || 'Unknown error' };
  }
}

/**
 * Get all data that will be deleted (for preview)
 */
export function getDeletableDataSummary(userId: string): {
  products: number;
  transactions: number;
  pendingSync: number;
} {
  try {
    const products = JSON.parse(localStorage.getItem('iraqi_pos_products') || '[]')
      .filter((p: any) => p.shopId === userId);
    const transactions = JSON.parse(localStorage.getItem('iraqi_pos_transactions') || '[]')
      .filter((t: any) => t.shopId === userId);
    const pendingSync = JSON.parse(localStorage.getItem('iraqi_pos_pending_sync') || '[]')
      .filter((p: any) => p.shopId === userId);

    return {
      products: products.length,
      transactions: transactions.length,
      pendingSync: pendingSync.length,
    };
  } catch {
    return { products: 0, transactions: 0, pendingSync: 0 };
  }
}
