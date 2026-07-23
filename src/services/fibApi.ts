import { FIBConfig } from '../stores/appStore';

// ============================================================
// FIB OFFICIAL API SERVICE
// Architecture ready for real FIB integration
// Replace endpoint paths when official documentation is received
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
// 1. TEST CONNECTION
// Validates merchant credentials with FIB API
// ============================================================
export async function testFIBConnection(config: FIBConfig): Promise<FIBConnectionResult> {
  if (!config.baseUrl || !config.merchantId || !config.apiKey) {
    return {
      success: false,
      message: 'Missing required fields: baseUrl, merchantId, apiKey',
    };
  }

  try {
    // Official FIB API endpoint for merchant validation
    // TODO: Replace with actual FIB endpoint when documentation received
    const response = await fetch(`${config.baseUrl}/merchant/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Merchant-Id': config.merchantId,
        'X-Api-Key': config.apiKey,
        'X-Api-Secret': config.secretKey,
      },
      body: JSON.stringify({
        merchant_id: config.merchantId,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: 'Connection successful',
        merchantInfo: {
          merchantId: data.merchant_id || config.merchantId,
          merchantName: data.merchant_name || 'Unknown',
          accountStatus: data.status || 'active',
        },
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: errorData.message || `HTTP ${response.status}: Connection failed`,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Network error - check connection and URL',
    };
  }
}

// ============================================================
// 2. CREATE PAYMENT
// Initiates a payment request via FIB API
// ============================================================
export async function createFIBPayment(
  config: FIBConfig,
  request: FIBPaymentRequest
): Promise<FIBPaymentResult> {
  if (!config.enabled) {
    return { success: false, error: 'FIB is not enabled' };
  }

  try {
    // Official FIB API endpoint for creating payment
    // TODO: Replace with actual FIB endpoint when documentation received
    const response = await fetch(`${config.baseUrl}/payment/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Merchant-Id': config.merchantId,
        'X-Api-Key': config.apiKey,
        'X-Api-Secret': config.secretKey,
      },
      body: JSON.stringify({
        merchant_id: config.merchantId,
        amount: request.amount,
        currency: request.currency || 'IQD',
        order_id: request.orderId,
        description: request.description,
        customer_phone: request.customerPhone,
        webhook_url: config.webhookUrl,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        paymentId: data.payment_id || data.id,
        status: data.status || 'pending',
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || `HTTP ${response.status}`,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error',
    };
  }
}

// ============================================================
// 3. CHECK PAYMENT STATUS
// Polls FIB API for payment confirmation
// ============================================================
export async function checkFIBPaymentStatus(
  config: FIBConfig,
  paymentId: string
): Promise<FIBPaymentStatus> {
  try {
    // Official FIB API endpoint for payment status
    // TODO: Replace with actual FIB endpoint when documentation received
    const response = await fetch(`${config.baseUrl}/payment/status/${paymentId}`, {
      method: 'GET',
      headers: {
        'X-Merchant-Id': config.merchantId,
        'X-Api-Key': config.apiKey,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        paymentId,
        status: data.status || 'pending',
        amount: data.amount || 0,
        paidAt: data.paid_at,
      };
    }
    return { paymentId, status: 'pending', amount: 0 };
  } catch {
    return { paymentId, status: 'pending', amount: 0 };
  }
}

// ============================================================
// 4. HANDLE WEBHOOK CALLBACK
// Processes payment confirmation from FIB
// ============================================================
export function parseFIBWebhook(payload: any): {
  paymentId: string;
  status: 'paid' | 'failed';
  amount: number;
  transactionRef?: string;
} | null {
  try {
    // TODO: Replace with actual FIB webhook format when documentation received
    if (payload.status === 'paid' || payload.status === 'success') {
      return {
        paymentId: payload.payment_id || payload.order_id,
        status: 'paid',
        amount: payload.amount || 0,
        transactionRef: payload.transaction_ref || payload.reference,
      };
    }
    if (payload.status === 'failed' || payload.status === 'error') {
      return {
        paymentId: payload.payment_id || payload.order_id,
        status: 'failed',
        amount: payload.amount || 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}
