import { CartItem, Transaction, PaymentMethod } from '../types';
import { formatIQD } from '../i18n';

// ESC/POS commands
const ESC = '\x1b';
const GS = '\x1d';
const InitializePrinter = ESC + '@';
const BoldOn = ESC + 'E' + '\x01';
const BoldOff = ESC + 'E' + '\x00';
const CenterAlign = ESC + 'a' + '\x01';
const LeftAlign = ESC + 'a' + '\x00';
const CutPaper = GS + 'V' + '\x01';

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'نقدي / Cash',

  fib: 'FIB Bank',
};

export function generateReceiptContent(transaction: Transaction, storeName: string = 'كاشير - POS'): string {
  let receipt = '';
  receipt += InitializePrinter;
  receipt += CenterAlign;
  receipt += BoldOn;
  receipt += storeName + '\n';
  receipt += BoldOff;
  receipt += '--------------------------------\n';

  receipt += LeftAlign;
  const date = new Date(transaction.createdAt);
  receipt += `التاريخ: ${date.toLocaleDateString('en-US')}\n`;
  receipt += `الوقت: ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}\n`;
  receipt += `رقم المعاملة: ${transaction.id.slice(0, 8)}\n`;
  receipt += '--------------------------------\n';

  transaction.items.forEach((item: CartItem) => {
    receipt += `${item.product.name}\n`;
    receipt += `  ${item.quantity} x ${formatIQD(item.product.price)}\n`;
    receipt += `  المجموع: ${formatIQD(item.subtotal)}\n`;
  });

  receipt += '--------------------------------\n';
  receipt += BoldOn;
  receipt += `المجموع الكلي: ${formatIQD(transaction.total)}\n`;
  receipt += `طريقة الدفع: ${paymentMethodLabels[transaction.paymentMethod]}\n`;

  if (transaction.paymentMethod === 'cash') {
    receipt += `المبلغ المدفوع: ${formatIQD(transaction.amountPaid)}\n`;
    receipt += `المتبقي: ${formatIQD(transaction.change)}\n`;
  }

  receipt += BoldOff;
  receipt += '--------------------------------\n';
  receipt += CenterAlign;
  receipt += 'شكرا لتسوقكم\n';
  receipt += 'Thank you!\n';
  receipt += '--------------------------------\n';
  receipt += CutPaper;

  return receipt;
}

// For Expo, we'll generate the receipt as printable HTML
export function generateReceiptHTML(transaction: Transaction, storeName: string = 'كاشير - POS'): string {
  const date = new Date(transaction.createdAt);
  let html = `
<!DOCTYPE html>
<html dir="rtl">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: monospace; width: 300px; margin: 0 auto; padding: 10px; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .line { border-top: 1px dashed #000; margin: 5px 0; }
  table { width: 100%; font-size: 12px; }
  .total { font-size: 14px; font-weight: bold; margin-top: 5px; }
</style>
</head>
<body>
  <div class="center bold" style="font-size:16px">${storeName}</div>
  <div class="line"></div>
  <div style="font-size:11px">
    <div>التاريخ: ${date.toLocaleDateString('en-US')}</div>
    <div>الوقت: ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
    <div>رقم المعاملة: ${transaction.id.slice(0, 8)}</div>
  </div>
  <div class="line"></div>
  <table>
    <tr><th>الصنف</th><th>الكمية</th><th>المجموع</th></tr>`;

  transaction.items.forEach((item) => {
    html += `<tr>
      <td>${item.product.name}</td>
      <td>${item.quantity}</td>
      <td>${formatIQD(item.subtotal)}</td>
    </tr>`;
  });

  html += `</table>
  <div class="line"></div>
  <div class="total">المجموع الكلي: ${formatIQD(transaction.total)}</div>
  <div>طريقة الدفع: ${paymentMethodLabels[transaction.paymentMethod]}</div>`;

  if (transaction.paymentMethod === 'cash') {
    html += `<div>المبلغ المدفوع: ${formatIQD(transaction.amountPaid)}</div>`;
    html += `<div>المتبقي: ${formatIQD(transaction.change)}</div>`;
  }

  html += `<div class="line"></div>
  <div class="center">شكرا لتسوقكم</div>
  <div class="center">Thank you!</div>
  <div class="line"></div>
</body></html>`;

  return html;
}

export function generateTestPrintHTML(storeName: string = 'كاشير - POS'): string {
  const now = new Date();
  return `
<!DOCTYPE html>
<html dir="rtl">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: monospace; width: 300px; margin: 0 auto; padding: 10px; }
  .center { text-align: center; }
  .line { border-top: 1px dashed #000; margin: 5px 0; }
</style>
</head>
<body>
  <div class="center" style="font-size:16px;font-weight:bold">${storeName}</div>
  <div class="line"></div>
  <div class="center">اختبار الطباعة</div>
  <div class="center">Test Print</div>
  <div style="font-size:11px;text-align:center">
    ${now.toLocaleDateString('en-US')} ${now.toLocaleTimeString('en-US')}
  </div>
  <div class="line"></div>
  <div class="center">✅ الطابعة تعمل بشكل صحيح</div>
  <div class="center">Printer is working correctly</div>
  <div class="line"></div>
</body></html>`;
}
