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
// DEEP-LINK: Opens the payment app directly with pre-filled data
// ============================================================
export function openPaymentApp(
  method: PaymentMethod,
  phoneNumber: string,
  amount: number,
  shopName: string,
  transactionId: string
): boolean {
  if (typeof window === 'undefined') return false;

  const amountStr = amount.toString();
  const note = `${shopName} #${transactionId.slice(0, 8)}`;

  // Android deep links for each payment app
  const deepLinks: Record<string, string> = {
    fib: `intent://pay#Intent;scheme=fib;package=com.fib.mobile;S.phone=${phoneNumber};S.amount=${amountStr};S.note=${encodeURIComponent(note)};end`,
    zaincash: `intent://pay#Intent;scheme=zaincash;package=com.zaincash.app;S.phone=${phoneNumber};S.amount=${amountStr};S.note=${encodeURIComponent(note)};end`,
    fastpay: `intent://pay#Intent;scheme=fastpay;package=com.fastpay.app;S.phone=${phoneNumber};S.amount=${amountStr};S.note=${encodeURIComponent(note)};end`,
    asia_hawala: `intent://pay#Intent;scheme=asia;package=com.asiahawala.app;S.phone=${phoneNumber};S.amount=${amountStr};S.note=${encodeURIComponent(note)};end`,
  };

  // Fallback: Try opening via universal link or phone dialer
  const fallbackLinks: Record<string, string> = {
    fib: `tel:${phoneNumber}`,
    zaincash: `tel:${phoneNumber}`,
    fastpay: `tel:${phoneNumber}`,
    asia_hawala: `tel:${phoneNumber}`,
  };

  try {
    const link = deepLinks[method] || fallbackLinks[method];
    if (link) {
      window.location.href = link;
      return true;
    }
  } catch (e) {
    // Fallback to phone dialer
    try {
      window.location.href = fallbackLinks[method] || `tel:${phoneNumber}`;
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// ============================================================
// ZAINCASH API INTEGRATION (if registered as merchant)
// ============================================================
export interface ZainCashConfig {
  merchantId: string;
  secretKey: string;
  baseUrl: string;
}

export async function createZainCashPayment(
  config: ZainCashConfig,
  amount: number,
  phoneNumber: string,
  orderId: string
): Promise<{ success: boolean; paymentUrl?: string; error?: string }> {
  try {
    // ZainCash API endpoint
    const response = await fetch(`${config.baseUrl}/api/v1/payment/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.secretKey}`,
      },
      body: JSON.stringify({
        merchant_id: config.merchantId,
        amount: amount,
        currency: 'IQD',
        phone: phoneNumber,
        order_id: orderId,
        redirect_url: window.location.origin + '/payment-callback',
      }),
    });

    const data = await response.json();
    if (data.status === 'success') {
      return { success: true, paymentUrl: data.payment_url };
    }
    return { success: false, error: data.message || 'Payment creation failed' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================================
// POLLING: Check payment status
// ============================================================
export async function checkPaymentStatus(transactionId: string): Promise<PaymentStatus> {
  if (typeof window === 'undefined') {
    return { status: 'pending', transactionId, amount: 0 };
  }

  const stored = localStorage.getItem(`iraqi_pos_payment_${transactionId}`);
  if (stored) {
    try {
      return JSON.parse(stored) as PaymentStatus;
    } catch {
      return { status: 'pending', transactionId, amount: 0 };
    }
  }

  return { status: 'pending', transactionId, amount: 0 };
}

export function confirmPaymentReceived(transactionId: string, amount: number): void {
  if (typeof window === 'undefined') return;
  const status: PaymentStatus = {
    status: 'paid',
    transactionId,
    amount,
    paidAt: new Date().toISOString(),
  };
  localStorage.setItem(`iraqi_pos_payment_${transactionId}`, JSON.stringify(status));
}

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
    } catch (err) {
      console.warn('Payment poll error:', err);
    }
  }, POLL_INTERVAL);
}

export function stopPaymentPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  pollAttempts = 0;
}

export function supportsAutoCheck(method: PaymentMethod): boolean {
  return ['fib', 'zaincash', 'fastpay', 'asia_hawala'].includes(method);
}

export function getPaymentMethodInfo(method: PaymentMethod): { icon: string; color: string; label: string; hasApi: boolean } {
  const info: Record<string, { icon: string; color: string; label: string; hasApi: boolean }> = {
    fib: { icon: '🏦', color: '#1565C0', label: 'FIB', hasApi: false },
    zaincash: { icon: '📱', color: '#ED1C24', label: 'ZainCash', hasApi: true },
    fastpay: { icon: '⚡', color: '#FF9800', label: 'FastPay', hasApi: false },
    asia_hawala: { icon: '👛', color: '#4CAF50', label: 'AsiaHawala', hasApi: false },
    cash: { icon: '💵', color: '#333', label: 'Cash', hasApi: false },
    credit_card: { icon: '💳', color: '#666', label: 'Card', hasApi: false },
  };
  return info[method] || { icon: '💳', color: '#666', label: method, hasApi: false };
}
