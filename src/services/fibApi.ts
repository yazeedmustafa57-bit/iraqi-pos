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
// Derzeitige Platzhalter basieren auf typischen irakischen
// Bank-API-Strukturen und sind NICHT funktionsfähig.
//
// Ansprechpartner FIB: business@fib.iq
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
// PLACEHOLDER VALIDATION
// Prevents accidental API calls before real documentation
// ============================================================
function validateConfig(config: FIBConfig): string | null {
  if (!config.enabled) return 'FIB is not enabled';
  if (!config.baseUrl) return 'API Base URL is required';
  if (!config.merchantId) return 'Merchant ID is required';
  if (!config.apiKey) return 'API Key is required';
  // When real FIB documentation is received, also validate:
  // - URL format matches FIB specification
  // - Auth method matches FIB requirement
  return null;
}

// ============================================================
// 1. TEST CONNECTION
//
// PLACEHOLDER - Replace with actual FIB endpoint:
// - Method: (as per FIB documentation)
// - Auth: (as per FIB documentation)
// - Request format: (as per FIB documentation)
// - Response format: (as per FIB documentation)
// ============================================================
export async function testFIBConnection(config: FIBConfig): Promise<FIBConnectionResult> {
  const validationError = validateConfig(config);
  if (validationError) {
    return { success: false, message: validationError };
  }

  // TODO: Replace this block with actual FIB API call
  // Once FIB documentation is received:
  //
  // const response = await fetch(`${config.baseUrl}/ACTUAL_FIB_ENDPOINT`, {
  //   method: 'ACTUAL_FIB_METHOD',
  //   headers: {
  //     // Exact headers as per FIB documentation
  //     'Content-Type': 'application/json',
  //     'Authorization': `Bearer ${config.apiKey}`,  // or however FIB authenticates
  //     // ... other required headers
  //   },
  //   body: JSON.stringify({
  //     // Exact request format as per FIB documentation
  //   }),
  // });
  //
  // Parse response according to FIB documentation

  // PLACEHOLDER: Returns clear error until real integration
  return {
    success: false,
    message: 'FIB API integration pending official documentation. Contact business@fib.iq for API access.',
  };
}

// ============================================================
// 2. CREATE PAYMENT
//
// PLACEHOLDER - Replace with actual FIB endpoint
// ============================================================
export async function createFIBPayment(
  config: FIBConfig,
  request: FIBPaymentRequest
): Promise<FIBPaymentResult> {
  const validationError = validateConfig(config);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // TODO: Replace with actual FIB payment creation
  // Exact endpoint, auth, and request/response format
  // must come from official FIB documentation

  return {
    success: false,
    error: 'FIB API integration pending official documentation',
  };
}

// ============================================================
// 3. CHECK PAYMENT STATUS
//
// PLACEHOLDER - Replace with actual FIB endpoint
// ============================================================
export async function checkFIBPaymentStatus(
  config: FIBConfig,
  paymentId: string
): Promise<FIBPaymentStatus> {
  const validationError = validateConfig(config);
  if (validationError) {
    return { paymentId, status: 'failed', amount: 0 };
  }

  // TODO: Replace with actual FIB status check
  return { paymentId, status: 'pending', amount: 0 };
}

// ============================================================
// 4. PARSE WEBHOOK CALLBACK
//
// PLACEHOLDER - Replace with actual FIB webhook format
//
// ⚠️  WEBHOOKS REQUIRE A BACKEND SERVER!
//
// Architecture:
// ┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
// │  FIB Server  │────▶│  Backend Server   │────▶│  Your App   │
// │  (Payment    │     │  (Public URL)     │     │  (Local)    │
// │  confirmed)  │     │  /api/fib-webhook │     │             │
// └──────────────┘     └──────────────────┘     └─────────────┘
//
// The backend server:
// 1. Receives webhook from FIB
// 2. Validates the signature (as per FIB documentation)
// 3. Updates payment status in database
// 4. Notifies the POS app (via WebSocket or polling)
// ============================================================
export function parseFIBWebhook(payload: any): {
  paymentId: string;
  status: 'paid' | 'failed';
  amount: number;
  transactionRef?: string;
} | null {
  // TODO: Replace with actual FIB webhook format
  // Verify webhook signature as per FIB documentation
  // Parse payload according to FIB specification

  try {
    // PLACEHOLDER: Generic webhook parsing
    if (payload.status === 'paid' || payload.status === 'success') {
      return {
        paymentId: payload.payment_id || payload.order_id || '',
        status: 'paid',
        amount: payload.amount || 0,
        transactionRef: payload.transaction_ref || payload.reference,
      };
    }
    if (payload.status === 'failed' || payload.status === 'error') {
      return {
        paymentId: payload.payment_id || payload.order_id || '',
        status: 'failed',
        amount: payload.amount || 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}
