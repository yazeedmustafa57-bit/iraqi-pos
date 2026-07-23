import QRCode from 'qrcode';

export interface QRPaymentData {
  method: string;
  phone: string;
  amount: number;
  currency: string;
  shopName: string;
  shopId: string;
  transactionId: string;
}

export function generateMerchantId(shopName: string, shopPhone: string): string {
  let hash = 0;
  const str = shopName + shopPhone;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'IQ-' + Math.abs(hash).toString(10).padStart(8, '0');
}

// Universal QR format that works with Iraqi payment apps
// FIB/ZainCash/FastPay all accept phone numbers as payment target
export function formatQRPaymentData(data: QRPaymentData): string {
  // Option 1: Simple phone number (works with ALL payment apps when scanned)
  // The amount is entered manually in the payment app
  return data.phone;
}

// Generate QR code as data URL
export async function generateQRCodeDataURL(
  data: QRPaymentData,
  width: number = 250
): Promise<string> {
  // QR contains just the phone number - universal compatibility
  const qrText = data.phone;
  try {
    const dataURL = await QRCode.toDataURL(qrText, {
      width,
      margin: 2,
      color: {
        dark: '#1a1a1a',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    });
    return dataURL;
  } catch (err) {
    console.error('QR generation failed:', err);
    return '';
  }
}

export const PAYMENT_METHOD_INFO: Record<string, { icon: string; color: string; label: string }> = {
  fib: { icon: '🏦', color: '#1565C0', label: 'FIB' },
  zaincash: { icon: '📱', color: '#ED1C24', label: 'ZainCash' },
  fastpay: { icon: '⚡', color: '#FF9800', label: 'FastPay' },
  asia_hawala: { icon: '👛', color: '#4CAF50', label: 'AsiaHawala' },
};
