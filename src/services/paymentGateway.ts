import { PaymentMethod } from '../types';

export interface PaymentStatus {
  status: 'pending' | 'paid' | 'failed' | 'expired';
  transactionId: string;
  amount: number;
  paidAt?: string;
}

const POLL_INTERVAL = 5000;
const MAX_POLL_ATTEMPTS = 60;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollAttempts = 0;

// ============================================================
// PROVIDER STATUS
// ============================================================
export interface PaymentProviderInfo {
  method: PaymentMethod;
  label: string;
  icon: string;
  color: string;
  hasOfficialApi: boolean;
  status: 'ready' | 'api_required';
  requirements: string[];
}

export const PAYMENT_PROVIDERS: Record<string, PaymentProviderInfo> = {
  cash: {
    method: 'cash',
    label: 'Bargeld',
    icon: '💵',
    color: '#333',
    hasOfficialApi: false,
    status: 'ready',
    requirements: [],
  },
  fib: {
    method: 'fib',
    label: 'FIB',
    icon: '🏦',
    color: '#1565C0',
    hasOfficialApi: true,
    status: 'api_required',
    requirements: ['Händlerkonto bei FIB', 'Merchant ID', 'API-Schlüssel'],
  },
};

// ============================================================
// FIB OFFICIAL API (placeholder - needs real credentials)
// ============================================================
export interface FIBConfig {
  merchantId: string;
  apiKey: string;
  baseUrl: string;
}

export async function createFIBPayment(
  config: FIBConfig,
  amount: number,
  phoneNumber: string,
  orderId: string
): Promise<{ success: boolean; paymentId?: string; error?: string }> {
  try {
    const response = await fetch(`${config.baseUrl}/api/v1/payment/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        merchant_id: config.merchantId,
        amount: amount,
        currency: 'IQD',
        phone: phoneNumber,
        order_id: orderId,
      }),
    });

    const data = await response.json();
    if (data.status === 'success') {
      return { success: true, paymentId: data.payment_id };
    }
    return { success: false, error: data.message || 'Payment creation failed' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}

export async function checkFIBPaymentStatus(
  config: FIBConfig,
  paymentId: string
): Promise<{ status: 'pending' | 'paid' | 'failed'; amount?: number }> {
  try {
    const response = await fetch(`${config.baseUrl}/api/v1/payment/status/${paymentId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${config.apiKey}` },
    });
    const data = await response.json();
    return { status: data.status || 'pending', amount: data.amount };
  } catch {
    return { status: 'pending' };
  }
}

// ============================================================
// LOCAL PAYMENT STATUS (for manual cash confirmation)
// ============================================================
export function confirmPaymentReceived(transactionId: string, amount: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`iraqi_pos_payment_${transactionId}`, JSON.stringify({
    status: 'paid', transactionId, amount, paidAt: new Date().toISOString(),
  }));
}

export async function checkPaymentStatus(transactionId: string): Promise<PaymentStatus> {
  if (typeof window === 'undefined') return { status: 'pending', transactionId, amount: 0 };
  const stored = localStorage.getItem(`iraqi_pos_payment_${transactionId}`);
  if (stored) { try { return JSON.parse(stored); } catch {} }
  return { status: 'pending', transactionId, amount: 0 };
}

// ============================================================
// POLLING
// ============================================================
export function startPaymentPolling(
  transactionId: string, amount: number, method: PaymentMethod,
  onPaid: () => void, onFailed?: () => void, onExpired?: () => void
): void {
  stopPaymentPolling();
  pollAttempts = 0;
  pollTimer = setInterval(async () => {
    pollAttempts++;
    if (pollAttempts > MAX_POLL_ATTEMPTS) { stopPaymentPolling(); onExpired?.(); return; }
    try {
      const result = await checkPaymentStatus(transactionId);
      if (result.status === 'paid') { stopPaymentPolling(); onPaid(); }
      else if (result.status === 'failed') { stopPaymentPolling(); onFailed?.(); }
    } catch (err) { console.warn('Payment poll error:', err); }
  }, POLL_INTERVAL);
}

export function stopPaymentPolling(): void {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  pollAttempts = 0;
}

export function supportsAutoCheck(method: PaymentMethod): boolean {
  return method === 'fib';
}

export function getPaymentMethodInfo(method: PaymentMethod): PaymentProviderInfo {
  return PAYMENT_PROVIDERS[method] || PAYMENT_PROVIDERS.cash;
}
