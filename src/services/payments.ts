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
  qrCode?: string;
  redirectUrl?: string;
  error?: string;
  pendingSync?: boolean;
}

// ZainCash integration
// API docs: docs.zaincash.iq
export async function processZainCash(request: PaymentRequest, isOnline: boolean): Promise<PaymentResponse> {
  if (!isOnline) {
    await addToSyncQueue(request, 'zaincash');
    return { success: true, pendingSync: true, reference: `ZC-QUEUE-${Date.now()}` };
  }

  try {
    // In production: const response = await fetch('https://api.zaincash.iq/...', { ... });
    const mockResponse: PaymentResponse = {
      success: true,
      reference: `ZC-${Date.now()}`,
      qrCode: `zaincash://pay?amount=${request.amount}&ref=${request.transactionId}`,
    };
    return mockResponse;
  } catch {
    await addToSyncQueue(request, 'zaincash');
    return { success: false, error: 'Network error - queued for sync', pendingSync: true };
  }
}

// FastPay integration
// API docs: fast-pay.iq/integration
export async function processFastPay(request: PaymentRequest, isOnline: boolean): Promise<PaymentResponse> {
  if (!isOnline) {
    await addToSyncQueue(request, 'fastpay');
    return { success: true, pendingSync: true, reference: `FP-QUEUE-${Date.now()}` };
  }

  try {
    // In production: const response = await fetch('https://api.fast-pay.iq/...', { ... });
    const mockResponse: PaymentResponse = {
      success: true,
      reference: `FP-${Date.now()}`,
      qrCode: `fastpay://pay?amount=${request.amount}&ref=${request.transactionId}`,
    };
    return mockResponse;
  } catch {
    await addToSyncQueue(request, 'fastpay');
    return { success: false, error: 'Network error - queued for sync', pendingSync: true };
  }
}

// AsiaHawala integration
export async function processAsiaHawala(request: PaymentRequest, isOnline: boolean): Promise<PaymentResponse> {
  if (!isOnline) {
    await addToSyncQueue(request, 'asia_hawala');
    return { success: true, pendingSync: true, reference: `AH-QUEUE-${Date.now()}` };
  }

  try {
    // In production: integration with AsiaHawala API
    const mockResponse: PaymentResponse = {
      success: true,
      reference: `AH-${Date.now()}`,
      qrCode: `asia_hawala://pay?amount=${request.amount}&ref=${request.transactionId}`,
    };
    return mockResponse;
  } catch {
    await addToSyncQueue(request, 'asia_hawala');
    return { success: false, error: 'Network error - queued for sync', pendingSync: true };
  }
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

// Process payment by method
export async function processPayment(
  method: PaymentMethod,
  request: PaymentRequest,
  isOnline: boolean
): Promise<PaymentResponse> {
  switch (method) {
    case 'zaincash':
      return processZainCash(request, isOnline);
    case 'fastpay':
      return processFastPay(request, isOnline);
    case 'asia_hawala':
      return processAsiaHawala(request, isOnline);
    case 'cash':
      return { success: true };
    case 'credit_card':
      return { success: true };
    case 'fib':
      return { success: true };
    default:
      return { success: false, error: 'Unknown payment method' };
  }
}

const MAX_RETRY_COUNT = 5;

// Sync pending payments — called when device comes back online
export async function syncPendingPayments(): Promise<{ synced: number; failed: number }> {
  const { getPendingSyncItems, removePendingSync } = await import('../database/db');
  const items = await getPendingSyncItems();
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    if (item.retryCount >= MAX_RETRY_COUNT) {
      failed++;
      continue;
    }
    try {
      const data = JSON.parse(item.data);
      // Process directly without re-queuing
      const result = await processZainCash(
        { amount: data.amount, transactionId: data.transactionId },
        true
      ).catch(() => null) ||
      await processFastPay(
        { amount: data.amount, transactionId: data.transactionId },
        true
      ).catch(() => null) ||
      { success: false };

      if (result && result.success) {
        await removePendingSync(item.id);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}
