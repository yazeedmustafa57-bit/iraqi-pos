import { PaymentMethod } from '../types';

export interface PaymentStatus {
  status: 'pending' | 'paid' | 'failed' | 'expired';
  transactionId: string;
  amount: number;
  paidAt?: string;
}

const POLL_INTERVAL = 5000;
const MAX_POLL_ATTEMPTS = 60; // 5 minutes

let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollAttempts = 0;

function getPaymentStoreKey(txId: string): string {
  return `iraqi_pos_payment_${txId}`;
}

// Simulated payment gateway - checks if payment was received
// In production: replace with real FIB/ZainCash/FastPay/AsiaHawala API
async function checkPaymentStatus(transactionId: string): Promise<PaymentStatus> {
  if (typeof window === 'undefined') {
    return { status: 'pending', transactionId, amount: 0 };
  }

  // Check localStorage for payment confirmation
  // In production: this would be a server API call
  const stored = localStorage.getItem(getPaymentStoreKey(transactionId));
  if (stored) {
    try {
      return JSON.parse(stored) as PaymentStatus;
    } catch {
      return { status: 'pending', transactionId, amount: 0 };
    }
  }

  return { status: 'pending', transactionId, amount: 0 };
}

// Simulate incoming payment (called by external system or webhook)
export function confirmPaymentReceived(transactionId: string, amount: number): void {
  if (typeof window === 'undefined') return;
  const status: PaymentStatus = {
    status: 'paid',
    transactionId,
    amount,
    paidAt: new Date().toISOString(),
  };
  localStorage.setItem(getPaymentStoreKey(transactionId), JSON.stringify(status));
}

// Start polling for payment status
export function startPaymentPolling(
  transactionId: string,
  amount: number,
  method: PaymentMethod,
  onPaid: () => void,
  onFailed?: () => void,
  onExpired?: () => void
): void {
  stopPaymentPolling();
  pollAttempts = 0;

  pollTimer = setInterval(async () => {
    pollAttempts++;

    if (pollAttempts > MAX_POLL_ATTEMPTS) {
      stopPaymentPolling();
      onExpired?.();
      return;
    }

    try {
      const result = await checkPaymentStatus(transactionId);

      if (result.status === 'paid') {
        stopPaymentPolling();
        onPaid();
      } else if (result.status === 'failed') {
        stopPaymentPolling();
        onFailed?.();
      }
      // 'pending' -> continue polling
    } catch (err) {
      console.warn('Payment poll error:', err);
    }
  }, POLL_INTERVAL);
}

// Stop polling
export function stopPaymentPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  pollAttempts = 0;
}

// Get current poll time remaining (seconds)
export function getRemainingTime(): number {
  return Math.max(0, (MAX_POLL_ATTEMPTS - pollAttempts) * (POLL_INTERVAL / 1000));
}

// Check if FIB method supports auto-detection
export function supportsAutoCheck(method: PaymentMethod): boolean {
  return ['fib', 'zaincash', 'fastpay', 'asia_hawala'].includes(method);
}
