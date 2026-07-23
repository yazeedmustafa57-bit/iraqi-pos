import { getLocalDateTimeString } from "../utils/dateHelper";
import { PaymentMethod, Transaction, PendingSyncItem } from '../types';
import { addPendingSync } from '../database/db';

export interface PaymentRequest {
  amount: number;
  transactionId: string;
  description?: string;
}

export interface PaymentResponse {
  success: boolean;
  reference?: string;
  error?: string;
  pendingSync?: boolean;
}

async function addToSyncQueue(request: PaymentRequest, method: PaymentMethod): Promise<void> {
  await addPendingSync({
    transactionId: request.transactionId,
    data: JSON.stringify({ ...request, method }),
    type: 'payment',
    createdAt: getLocalDateTimeString(),
    retryCount: 0,
  });
}

export async function processPayment(
  method: PaymentMethod,
  request: PaymentRequest,
  isOnline: boolean
): Promise<PaymentResponse> {
  switch (method) {
    case 'cash':
      return { success: true };
    case 'fib':
      if (!isOnline) {
        await addToSyncQueue(request, 'fib');
        return { success: true, pendingSync: true, reference: `FIB-QUEUE-${Date.now()}` };
      }
      // FIB API integration placeholder - needs real credentials
      // In production: call FIB merchant API here
      return { success: true, reference: `FIB-${Date.now()}` };
    default:
      return { success: false, error: 'Unknown payment method' };
  }
}

const MAX_RETRY_COUNT = 5;

export async function syncPendingPayments(): Promise<{ synced: number; failed: number }> {
  const { getPendingSyncItems, removePendingSync } = await import('../database/db');
  const items = await getPendingSyncItems();
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    if (item.retryCount >= MAX_RETRY_COUNT) { failed++; continue; }
    try {
      const data = JSON.parse(item.data);
      const result = await processPayment(
        data.method || 'fib',
        { amount: data.amount, transactionId: data.transactionId },
        true
      );
      if (result.success) { await removePendingSync(item.id); synced++; }
      else { failed++; }
    } catch { failed++; }
  }
  return { synced, failed };
}
