/**
 * Account Deletion Service
 * 
 * Löscht alle Daten eines Shops:
 * 1. Lokale Daten (immer)
 * 2. Backend/Cloud-Daten (später, wenn aktiv)
 * 
 * NICHT rückgängig machbar!
 */

import { hashPIN } from '../utils/crypto';

export interface DeletionResult {
  success: boolean;
  deletedItems: string[];
  backendDeleted?: boolean;
  error?: string;
}

/**
 * PIN-Verifizierung vor Löschung
 */
export async function verifyPINForDeletion(
  phone: string, pin: string, storedHash: string
): Promise<boolean> {
  const pinHash = await hashPIN(pin);
  return pinHash === storedHash;
}

/**
 * Alle lokalen Daten eines Shops löschen
 */
function deleteLocalData(userId: string, phone: string): { success: boolean; items: string[]; error?: string } {
  const deletedItems: string[] = [];

  try {
    // 1. Shop-Account
    const users = JSON.parse(localStorage.getItem('iraqi_pos_users') || '[]');
    localStorage.setItem('iraqi_pos_users', JSON.stringify(users.filter((u: any) => u.id !== userId)));
    deletedItems.push('Shop-Account');

    // 2. Produkte
    const products = JSON.parse(localStorage.getItem('iraqi_pos_products') || '[]');
    localStorage.setItem('iraqi_pos_products', JSON.stringify(products.filter((p: any) => p.shopId !== userId)));
    deletedItems.push('Produkte');

    // 3. Bestellungen
    const transactions = JSON.parse(localStorage.getItem('iraqi_pos_transactions') || '[]');
    localStorage.setItem('iraqi_pos_transactions', JSON.stringify(transactions.filter((t: any) => t.shopId !== userId)));
    deletedItems.push('Bestellungen');

    // 4. Offline-Warteschlange
    const pending = JSON.parse(localStorage.getItem('iraqi_pos_pending_sync') || '[]');
    localStorage.setItem('iraqi_pos_pending_sync', JSON.stringify(pending.filter((p: any) => p.shopId !== userId)));
    deletedItems.push('Offline-Warteschlange');

    // 5. FIB-Konfiguration
    localStorage.removeItem(`iraqi_pos_fib_config_${userId}`);
    deletedItems.push('FIB-Konfiguration');

    // 6. Login-Verlauf
    localStorage.removeItem(`login_attempts_${phone}`);
    deletedItems.push('Login-Verlauf');

    // 7. Zahlungskonten
    localStorage.removeItem(`iraqi_pos_payment_accounts_${userId}`);
    deletedItems.push('Zahlungskonten');

    // 8. Backend-Token
    localStorage.removeItem(`fib_token_${userId}`);
    deletedItems.push('Backend-Token');

    // 9. Aktuelle Sitzung
    localStorage.removeItem('iraqi_pos_current_user');
    deletedItems.push('Sitzung');

    return { success: true, items: deletedItems };
  } catch (error: any) {
    return { success: false, items: deletedItems, error: error.message || 'Local deletion failed' };
  }
}

/**
 * Backend-Konto löschen (Platzhalter für spätere Integration)
 * 
 * Wird aufgerufen wenn Backend-Server aktiv ist.
 * Muss implementiert werden mit:
 * - DELETE /api/shops/{shopId}
 * - Authentifizierung mit JWT-Token
 * - Bestätigungs-E-Mail an Shop-Besitzer
 */
async function deleteBackendData(userId: string): Promise<{ success: boolean; error?: string }> {
  // TODO: Replace with actual backend deletion when server is active
  //
  // const token = localStorage.getItem(`fib_token_${userId}`);
  // if (!token) return { success: true }; // No backend data
  //
  // const response = await fetch(`${BACKEND_URL}/api/shops/${userId}`, {
  //   method: 'DELETE',
  //   headers: { 'Authorization': `Bearer ${token}` },
  // });
  //
  // if (!response.ok) {
  //   return { success: false, error: `Backend deletion failed: ${response.status}` };
  // }
  //
  // return { success: true };

  // Derzeit: Kein Backend aktiv, immer erfolgreich
  return { success: true };
}

/**
 * Komplette Konto-Löschung
 * 
 * Ablauf:
 * 1. Backend-Daten lösben (wenn aktiv)
 * 2. Lokale Daten löschen (immer)
 * 3. Sitzung beenden
 */
export async function deleteAllShopData(
  userId: string, phone: string
): Promise<DeletionResult> {
  const allDeletedItems: string[] = [];

  // Schritt 1: Backend-Daten löschen
  const backendResult = await deleteBackendData(userId);

  // Schritt 2: Lokale Daten löschen
  const localResult = deleteLocalData(userId, phone);
  allDeletedItems.push(...localResult.items);

  return {
    success: localResult.success && backendResult.success,
    deletedItems: allDeletedItems,
    backendDeleted: backendResult.success,
    error: localResult.error || backendResult.error,
  };
}

/**
 * Vorschau: Welche Daten werden gelöscht?
 */
export function getDeletableDataSummary(userId: string): {
  products: number;
  transactions: number;
  pendingSync: number;
  hasBackendData: boolean;
} {
  try {
    const products = JSON.parse(localStorage.getItem('iraqi_pos_products') || '[]')
      .filter((p: any) => p.shopId === userId);
    const transactions = JSON.parse(localStorage.getItem('iraqi_pos_transactions') || '[]')
      .filter((t: any) => t.shopId === userId);
    const pending = JSON.parse(localStorage.getItem('iraqi_pos_pending_sync') || '[]')
      .filter((p: any) => p.shopId === userId);
    const hasBackend = !!localStorage.getItem(`fib_token_${userId}`);

    return {
      products: products.length,
      transactions: transactions.length,
      pendingSync: pending.length,
      hasBackendData: hasBackend,
    };
  } catch {
    return { products: 0, transactions: 0, pendingSync: 0, hasBackendData: false };
  }
}
