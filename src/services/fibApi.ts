import { FIBConfig } from '../stores/appStore';

// ============================================================
// FIB OFFICIAL API SERVICE
//
// ⚠️  WICHTIG: Diese Datei enthält PLACEHOLDER-Endpunkte!
//
// Sobald die offizielle FIB-Dokumentation vorliegt, müssen
// hier die exakten Endpunkte, Auth-Header und Request/Response-
// Formate eingetragen werden.
//
// Ansprechpartner FIB: business@fib.iq
//
// ─────────────────────────────────────────────────────────────
// PRODUKTIONS-HINWEIS:
//
// API Keys und Secret Keys werden NICHT in der App gespeichert.
// In der Produktionsversion werden sie sicher über einen
// Backend-Server verwaltet (JWT-Tokens).
// ─────────────────────────────────────────────────────────────
// ============================================================

export interface FIBConnectionResult {
  success: boolean;
  message: string;
  merchantInfo?: {
    merchantId: string;
    merchantName: string;
    accountStatus: string;
  };
}

export interface FIBPaymentRequest {
  amount: number;
  currency: string;
  orderId: string;
  description: string;
  customerPhone?: string;
}

export interface FIBPaymentResult {
  success: boolean;
  paymentId?: string;
  status?: 'pending' | 'paid' | 'failed';
  error?: string;
}

export interface FIBPaymentStatus {
  paymentId: string;
  status: 'pending' | 'paid' | 'failed';
  amount: number;
  paidAt?: string;
}

// ============================================================
// BACKEND TOKEN MANAGEMENT (placeholder)
// ============================================================
interface BackendToken {
  token: string;
  expiresAt: string;
  shopId: string;
}

function getStoredToken(shopId: string): BackendToken | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(`fib_token_${shopId}`);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

// ============================================================
// VALIDATION
// ============================================================
function validateConfig(config: FIBConfig): string | null {
  if (!config.enabled) return 'FIB is not enabled';
  if (!config.baseUrl) return 'API Base URL is required';
  if (!config.merchantId) return 'Merchant ID is required';
  if (!config.apiKey) return 'API Key is required';
  return null;
}

// ============================================================
// 1. TEST CONNECTION (placeholder)
// ============================================================
export async function testFIBConnection(
  config: FIBConfig, shopId: string
): Promise<FIBConnectionResult> {
  const err = validateConfig(config);
  if (err) return { success: false, message: err };
  // TODO: Replace with actual FIB API call when documentation received
  return {
    success: false,
    message: 'FIB API integration pending official documentation. Contact business@fib.iq for API access.',
  };
}

// ============================================================
// 2. CREATE PAYMENT (placeholder)
// ============================================================
export async function createFIBPayment(
  config: FIBConfig, shopId: string, request: FIBPaymentRequest
): Promise<FIBPaymentResult> {
  const err = validateConfig(config);
  if (err) return { success: false, error: err };
  // TODO: Replace with actual FIB API call
  return { success: false, error: 'FIB API integration pending official documentation' };
}

// ============================================================
// 3. CHECK PAYMENT STATUS (placeholder)
// ============================================================
export async function checkFIBPaymentStatus(
  config: FIBConfig, shopId: string, paymentId: string
): Promise<FIBPaymentStatus> {
  return { paymentId, status: 'pending', amount: 0 };
}

// ============================================================
// 4. ORDER ID GENERATION
//
// Format: {shopId}__{timestamp}__{random}
// Using __ as separator since shopId (UUID) contains dashes
// ============================================================
export function generateFIBOrderId(shopId: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const random = Math.random().toString(36).substring(2, 8);
  return `${shopId}__${timestamp}__${random}`;
}

// ============================================================
// 5. PARSE WEBHOOK
//
// Shop-ID wird direkt aus der URL gelesen (/fib-webhook/shop/{shopId}),
// NICHT aus der Order-ID extrahiert.
//
// Webhook-Payload muss enthalten:
// - shop_id: Eindeutige Shop-ID
// - order_id: Bestellungs-ID
// - payment_id: FIB-Zahlungs-ID
// - status: paid/failed
// - amount: Betrag
// - signature: HMAC-Signatur (zur Verifizierung)
//
// ⚠️  BACKEND-ARCHITEKTUR:
// URL: https://backend.de/fib-webhook/shop/{shopId}
// Der Backend-Server liest shopId aus der URL,
// empfängt den Payload von FIB, und ordnet die
// Zahlung dem richtigen Shop + der richtigen Bestellung zu.
// ============================================================
export function parseFIBWebhook(payload: any): {
  shopId: string;
  paymentId: string;
  orderId: string;
  status: 'paid' | 'failed';
  amount: number;
  transactionRef?: string;
} | null {
  try {
    if (!payload || !payload.shop_id || !payload.order_id) return null;

    if (payload.status === 'paid' || payload.status === 'success') {
      return {
        shopId: payload.shop_id,
        paymentId: payload.payment_id || '',
        orderId: payload.order_id,
        status: 'paid',
        amount: payload.amount || 0,
        transactionRef: payload.transaction_ref,
      };
    }
    if (payload.status === 'failed' || payload.status === 'error') {
      return {
        shopId: payload.shop_id,
        paymentId: payload.payment_id || '',
        orderId: payload.order_id,
        status: 'failed',
        amount: payload.amount || 0,
      };
    }
    return null;
  } catch { return null; }
}
