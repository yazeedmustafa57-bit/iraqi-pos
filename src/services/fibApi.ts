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
//
// ─────────────────────────────────────────────────────────────
// PRODUKTIONS-HINWEIS:
//
// API Keys und Secret Keys dürfen NICHT dauerhaft in der App
// gespeichert werden. In der Produktionsversion müssen sie
// sicher über einen Backend-Server verwaltet werden.
//
// Ablauf in Produktion:
// 1. Händler gibt seine FIB-Daten in der App ein
// 2. App sendet Daten verschlüsselt an Backend-Server
// 3. Backend speichert Schlüssel sicher (z.B. Vault/DB)
// 4. App erhält nur ein Token für API-Aufrufe
// 5. Backend führt FIB-API-Aufrufe durch (Schlüssel bleiben serverseitig)
//
// Vorteile:
// - API Keys nie im Klartext auf dem Gerät
// - Backend kann Schlüssel rotieren/invalidieren
// - Zentrale Kontrolle über alle Shop-Verbindungen
// - Logging und Monitoring möglich
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
// PLACEHOLDER: Backend Token Management
//
// In Produktion:
// - App sendet FIB-Credentials an Backend
// - Backend speichert sie sicher
// - App erhält ein Token das API-Aufrufe erlaubt
// - Token ist an Shop-User-ID gebunden
//
// Example production flow:
// POST /api/fib/register
// Body: { merchantId, apiKey, secretKey, userId }
// Response: { token: "xyz...", expiresAt: "..." }
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
  } catch {
    return null;
  }
}

function storeToken(shopId: string, token: BackendToken): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`fib_token_${shopId}`, JSON.stringify(token));
}

// ============================================================
// PLACEHOLDER VALIDATION
// ============================================================
function validateConfig(config: FIBConfig): string | null {
  if (!config.enabled) return 'FIB is not enabled';
  if (!config.baseUrl) return 'API Base URL is required';
  if (!config.merchantId) return 'Merchant ID is required';
  if (!config.apiKey) return 'API Key is required';
  return null;
}

// ============================================================
// 1. REGISTER SHOP WITH BACKEND
//
// Registers the shop's FIB credentials with the backend server.
// Backend stores the credentials securely and returns a token.
//
// PLACEHOLDER - Replace with actual backend endpoint:
// POST {backendUrl}/api/fib/register
// ============================================================
export async function registerShopFIB(
  backendUrl: string,
  config: FIBConfig,
  shopId: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  // TODO: Replace with actual backend registration
  //
  // const response = await fetch(`${backendUrl}/api/fib/register`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     shop_id: shopId,          // Eindeutige Shop-ID
  //     merchant_id: config.merchantId,
  //     api_key: config.apiKey,   // Verschlüsselt senden!
  //     secret_key: config.secretKey,  // Verschlüsselt senden!
  //     base_url: config.baseUrl,
  //     sandbox_mode: config.sandboxMode,
  //   }),
  // });

  return {
    success: false,
    error: 'Backend registration pending - see server/README.md',
  };
}

// ============================================================
// 2. TEST CONNECTION
//
// Tests the FIB API connection via backend (credentials on server).
//
// PLACEHOLDER - Replace with actual backend endpoint:
// POST {backendUrl}/api/fib/test-connection
// ============================================================
export async function testFIBConnection(
  config: FIBConfig,
  shopId: string
): Promise<FIBConnectionResult> {
  const validationError = validateConfig(config);
  if (validationError) {
    return { success: false, message: validationError };
  }

  // TODO: Replace with actual backend call
  //
  // const token = getStoredToken(shopId);
  // if (!token) return { success: false, message: 'Shop not registered with backend' };
  //
  // const response = await fetch(`${config.baseUrl}/merchant/validate`, {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'Authorization': `Bearer ${token.token}`,
  //     'X-Shop-Id': shopId,
  //   },
  //   body: JSON.stringify({ merchant_id: config.merchantId }),
  // });

  return {
    success: false,
    message: 'FIB API integration pending official documentation. Contact business@fib.iq for API access.',
  };
}

// ============================================================
// 3. CREATE PAYMENT
//
// Creates a payment request. Backend handles FIB API call.
//
// PLACEHOLDER - Replace with actual backend endpoint:
// POST {backendUrl}/api/fib/create-payment
// ============================================================
export async function createFIBPayment(
  config: FIBConfig,
  shopId: string,
  request: FIBPaymentRequest
): Promise<FIBPaymentResult> {
  const validationError = validateConfig(config);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // TODO: Replace with actual backend call
  //
  // const token = getStoredToken(shopId);
  // const response = await fetch(`${config.baseUrl}/payment/create`, {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${token?.token}`,
  //     'X-Shop-Id': shopId,
  //   },
  //   body: JSON.stringify({
  //     merchant_id: config.merchantId,
  //     amount: request.amount,
  //     currency: request.currency || 'IQD',
  //     order_id: request.orderId,
  //     description: request.description,
  //     webhook_url: `${config.webhookUrl}/shop/${shopId}`,  // Shop-spezifische URL!
  //   }),
  // });

  return {
    success: false,
    error: 'FIB API integration pending official documentation',
  };
}

// ============================================================
// 4. CHECK PAYMENT STATUS
//
// PLACEHOLDER - Replace with actual backend endpoint:
// GET {backendUrl}/api/fib/payment-status/:paymentId
// ============================================================
export async function checkFIBPaymentStatus(
  config: FIBConfig,
  shopId: string,
  paymentId: string
): Promise<FIBPaymentStatus> {
  const validationError = validateConfig(config);
  if (validationError) {
    return { paymentId, status: 'failed', amount: 0 };
  }

  // TODO: Replace with actual backend call
  return { paymentId, status: 'pending', amount: 0 };
}

// ============================================================
// 5. PARSE WEBHOOK CALLBACK
//
// ⚠️  WEBHOOKS REQUIRE A BACKEND SERVER!
//
// Architektur:
// ┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
// │  FIB Server  │────▶│  Backend Server   │────▶│  POS App    │
// │  (Payment    │     │  (Public URL)     │     │  (Local)    │
// │  confirmed)  │     │  /fib-webhook     │     │             │
// └──────────────┘     └──────────────────┘     └─────────────┘
//
// Webhook-URL pro Shop:
// https://dein-backend.de/fib-webhook/shop/{shopId}
//
// Der Backend-Server:
// 1. Empfängt Webhook von FIB
// 2. Verifiziert Signatur (gemäß FIB-Dokumentation)
// 3. Ordnet Zahlung dem richtigen Shop zu (shopId in URL)
// 4. Ordnet Zahlung der richtigen Bestellung zu (orderId)
// 5. Speichert Status in Datenbank
// 6. Benachrichtigt POS-App (WebSocket/Polling)
//
// ─────────────────────────────────────────────────────────────
// ZUORDNUNG: Shop + Bestellung
//
// Jede Webhook-URL enthält die Shop-ID:
// /fib-webhook/shop/{shopId}
//
// Jede Zahlungsanfrage enthält die Bestellungs-ID:
// order_id: "{shopId}-{timestamp}-{random}"
//
// So kann der Backend-Server:
// - Shop-ID aus der URL lesen
// - Order-ID aus dem Payload lesen
// - Zahlung dem richtigen Shop + der richtigen Bestellung zuordnen
// ─────────────────────────────────────────────────────────────
// ============================================================
export function parseFIBWebhook(payload: any): {
  shopId: string;
  paymentId: string;
  orderId: string;
  status: 'paid' | 'failed';
  amount: number;
  transactionRef?: string;
} | null {
  // TODO: Replace with actual FIB webhook format
  // Verify webhook signature as per FIB documentation
  //
  // Expected payload (PLACEHOLDER):
  // {
  //   "payment_id": "FIB-PAY-123",
  //   "order_id": "SHOP1-1690000000-abc",
  //   "status": "paid",
  //   "amount": 15000,
  //   "currency": "IQD",
  //   "transaction_ref": "FIB-TX-456",
  //   "timestamp": "2026-07-23T15:30:00Z",
  //   "signature": "hmac-sha256-of-payload"
  // }

  try {
    if (!payload || !payload.order_id) return null;

    // Extract shopId from order_id format: "{shopId}-{timestamp}-{random}"
    const orderParts = (payload.order_id || '').split('-');
    const shopId = orderParts.length >= 2 ? orderParts[0] : '';

    if (!shopId) return null;

    if (payload.status === 'paid' || payload.status === 'success') {
      return {
        shopId,
        paymentId: payload.payment_id || '',
        orderId: payload.order_id,
        status: 'paid',
        amount: payload.amount || 0,
        transactionRef: payload.transaction_ref,
      };
    }
    if (payload.status === 'failed' || payload.status === 'error') {
      return {
        shopId,
        paymentId: payload.payment_id || '',
        orderId: payload.order_id,
        status: 'failed',
        amount: payload.amount || 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================
// HELPER: Generate unique order ID
//
// Format: {shopId}-{timestamp}-{random}
// Ensures payment can be uniquely attributed to a shop + order
// ============================================================
export function generateFIBOrderId(shopId: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const random = Math.random().toString(36).substring(2, 8);
  return `${shopId}-${timestamp}-${random}`;
}
