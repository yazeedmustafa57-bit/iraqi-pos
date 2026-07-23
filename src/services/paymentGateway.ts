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
// PROVIDER STATUS: Only officially documented integrations
// ============================================================
export interface PaymentProviderInfo {
  method: PaymentMethod;
  label: string;
  icon: string;
  color: string;
  hasOfficialApi: boolean;
  hasQrCode: boolean;
  hasDeepLink: boolean;
  apiDocsUrl: string;
  registrationUrl: string;
  requirements: string[];
  status: 'ready' | 'api_required' | 'manual_only';
}

export const PAYMENT_PROVIDERS: Record<string, PaymentProviderInfo> = {
  fib: {
    method: 'fib',
    label: 'FIB',
    icon: '🏦',
    color: '#1565C0',
    hasOfficialApi: true,     // API exists for registered merchants
    hasQrCode: false,
    hasDeepLink: false,
    apiDocsUrl: '',           // Only after merchant registration
    registrationUrl: 'mailto:business@fib.iq',
    requirements: ['Händlerkonto bei FIB', 'Merchant ID', 'API-Schlüssel'],
    status: 'api_required',
  },
  zaincash: {
    method: 'zaincash',
    label: 'ZainCash',
    icon: '📱',
    color: '#ED1C24',
    hasOfficialApi: true,     // Public API at developer.zaincash.iq
    hasQrCode: true,          // QR via payment_url from API
    hasDeepLink: true,        // payment_url opens ZainCash app
    apiDocsUrl: 'https://developer.zaincash.iq',
    registrationUrl: 'https://merchant.zaincash.iq',
    requirements: ['Merchant-Registrierung', 'KYC-Dokumente', 'Merchant ID + Secret Key'],
    status: 'ready',
  },
  fastpay: {
    method: 'fastpay',
    label: 'FastPay',
    icon: '⚡',
    color: '#FF9800',
    hasOfficialApi: false,
    hasQrCode: false,
    hasDeepLink: false,
    apiDocsUrl: '',
    registrationUrl: '',
    requirements: ['Keine öffentliche API bekannt'],
    status: 'api_required',
  },
  asia_hawala: {
    method: 'asia_hawala',
    label: 'AsiaHawala',
    icon: '👛',
    color: '#4CAF50',
    hasOfficialApi: false,
    hasQrCode: false,
    hasDeepLink: false,
    apiDocsUrl: '',
    registrationUrl: '',
    requirements: ['Keine öffentliche API bekannt'],
    status: 'manual_only',
  },
  cash: {
    method: 'cash',
    label: 'Bargeld',
    icon: '💵',
    color: '#333',
    hasOfficialApi: false,
    hasQrCode: false,
    hasDeepLink: false,
    apiDocsUrl: '',
    registrationUrl: '',
    requirements: [],
    status: 'ready',
  },
  credit_card: {
    method: 'credit_card',
    label: 'Kreditkarte',
    icon: '💳',
    color: '#666',
    hasOfficialApi: false,
    hasQrCode: false,
    hasDeepLink: false,
    apiDocsUrl: '',
    registrationUrl: '',
    requirements: ['Separater Kartenterminal nötig'],
    status: 'manual_only',
  },
};

// ============================================================
// ZAINCASH OFFICIAL API
// ============================================================
export interface ZainCashConfig {
  merchantId: string;
  secretKey: string;
  baseUrl: string; // https://api.zaincash.iq
}

export async function createZainCashPayment(
  config: ZainCashConfig,
  amount: number,
  phoneNumber: string,
  orderId: string,
  description: string
): Promise<{ success: boolean; paymentUrl?: string; paymentId?: string; error?: string }> {
  try {
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
        description: description,
        redirect_url: window.location.origin + '/payment-callback',
      }),
    });

    const data = await response.json();
    if (data.status === 'success' || data.result?.status === 'success') {
      return {
        success: true,
        paymentUrl: data.result?.payment_url || data.payment_url,
        paymentId: data.result?.payment_id || data.payment_id,
      };
    }
    return { success: false, error: data.message || data.error || 'Payment creation failed' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}

export async function checkZainCashPaymentStatus(
  config: ZainCashConfig,
  paymentId: string
): Promise<{ status: 'pending' | 'paid' | 'failed'; amount?: number }> {
  try {
    const response = await fetch(`${config.baseUrl}/api/v1/payment/status/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.secretKey}`,
      },
    });

    const data = await response.json();
    if (data.result?.status === 'paid' || data.status === 'paid') {
      return { status: 'paid', amount: data.result?.amount || data.amount };
    }
    if (data.result?.status === 'failed' || data.status === 'failed') {
      return { status: 'failed' };
    }
    return { status: 'pending' };
  } catch {
    return { status: 'pending' };
  }
}

// ============================================================
// LOCAL PAYMENT STATUS (for manual payments)
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
  return PAYMENT_PROVIDERS[method]?.status === 'ready';
}

export function getPaymentMethodInfo(method: PaymentMethod): PaymentProviderInfo {
  return PAYMENT_PROVIDERS[method] || PAYMENT_PROVIDERS.cash;
}
