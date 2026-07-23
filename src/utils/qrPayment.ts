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

// Generate unique merchant ID for each shop (based on shop name + phone)
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

// Format payment data for QR code
// Standard format: METHOD:PHONE:AMOUNT:CURRENCY:MERCHANT:SHOP:TXID
export function formatQRPaymentData(data: QRPaymentData): string {
  const parts = [
    data.method.toUpperCase(),
    data.phone,
    data.amount.toString(),
    data.currency,
    data.shopId,
    data.shopName,
    data.transactionId,
  ];
  return parts.join(':');
}

// Generate QR code as data URL (for web)
export async function generateQRCodeDataURL(
  data: QRPaymentData,
  width: number = 250
): Promise<string> {
  const qrText = formatQRPaymentData(data);
  try {
    const dataURL = await QRCode.toDataURL(qrText, {
      width,
      margin: 2,
      color: {
        dark: '#333333',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });
    return dataURL;
  } catch (err) {
    console.error('QR generation failed:', err);
    return '';
  }
}

// Generate QR code as SVG string (for React Native)
export async function generateQRCodeSVG(
  data: QRPaymentData,
  size: number = 200
): Promise<string> {
  const qrText = formatQRPaymentData(data);
  try {
    const svg = await QRCode.toString(qrText, {
      type: 'svg',
      width: size,
      margin: 2,
      color: {
        dark: '#333333',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });
    return svg;
  } catch (err) {
    console.error('QR generation failed:', err);
    return '';
  }
}

// Payment method labels for QR display
export const PAYMENT_METHOD_INFO: Record<string, { icon: string; color: string; label: string }> = {
  fib: { icon: '🏦', color: '#1565C0', label: 'FIB' },
  zaincash: { icon: '📱', color: '#ED1C24', label: 'ZainCash' },
  fastpay: { icon: '⚡', color: '#FF9800', label: 'FastPay' },
  asia_hawala: { icon: '👛', color: '#4CAF50', label: 'AsiaHawala' },
};
