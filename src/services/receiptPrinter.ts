import { Transaction, CartItem } from '../types';
import { formatIQD } from '../i18n';
import { Platform } from 'react-native';

const paymentLabels: Record<string, string> = {
  cash: '💵 Bargeld',

  fib: '🏦 FIB',
};

export function generateReceiptHTML(transaction: Transaction, shopName: string, lang: string = 'ar'): string {
  const r: Record<string, Record<string, string>> = {
    ar: { article: 'العناصر', stk: 'العدد', sum: 'المجموع', total: 'المجموع', given: 'المبلغ المدفوع', change: 'المتبقي', thanks: 'شكراً لتسوقكم!', print: 'طباعة', close: 'إغلاق', no: 'رقم', subtitle: 'نظام نقاط البيع العراقي' },
    ku: { article: 'شتێکان', stk: 'ژمارە', sum: 'کۆی', total: 'کۆی', given: 'پارەی دراو', change: 'گۆڕاوە', thanks: 'سوپاس بۆ کڕینەکەت!', print: 'پرینت', close: 'داخستن', no: 'ژمارە', subtitle: 'سیستەمی فرۆشتنی عێراق' },
    en: { article: 'Items', stk: 'Qty', sum: 'Total', total: 'Total', given: 'Given', change: 'Change', thanks: 'Thank you for shopping!', print: 'Print', close: 'Close', no: 'No.', subtitle: 'Iraqi Point of Sale System' },
    de: { article: 'Artikel', stk: 'Stk', sum: 'Summe', total: 'Gesamt', given: 'Gegeben', change: 'Rückgeld', thanks: 'Danke für Ihren Einkauf!', print: 'Drucken', close: 'Schließen', no: 'Nr.', subtitle: 'Irrakisches Kassensystem' },
  };
  const t = r[lang] || r['ar'];
  const loc = lang === 'ar' || lang === 'ku' ? 'ar-IQ' : lang === 'de' ? 'de-DE' : 'en-US';
  const date = new Date(transaction.createdAt);
  const items = transaction.items as CartItem[];

  let itemsHTML = '';
  items.forEach((item) => {
    itemsHTML += `
      <tr>
        <td style="padding:6px 0;border-bottom:1px dashed #ddd">${item.product.name}</td>
        <td style="padding:6px 0;border-bottom:1px dashed #ddd;text-align:center">${item.quantity}</td>
        <td style="padding:6px 0;border-bottom:1px dashed #ddd;text-align:right">${formatIQD(item.subtotal)}</td>
      </tr>`;
  });

  return `<!DOCTYPE html>
<html dir="rtl">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: monospace; background: #fff; display: flex; justify-content: center; padding: 20px; }
  .receipt { width: 300px; border: 1px solid #ddd; border-radius: 12px; padding: 20px; }
  .center { text-align: center; }
  .shop-name { font-size: 22px; font-weight: bold; color: #1a6b3c; margin-bottom: 4px; }
  .subtitle { font-size: 12px; color: #888; margin-bottom: 12px; }
  .line { border-top: 2px dashed #333; margin: 12px 0; }
  .line-light { border-top: 1px dashed #ccc; margin: 8px 0; }
  table { width: 100%; font-size: 13px; }
  th { text-align: right; padding: 4px 0; font-size: 11px; color: #888; }
  .total-row { font-size: 18px; font-weight: bold; color: #1a6b3c; padding: 8px 0; }
  .detail { font-size: 12px; color: #555; padding: 3px 0; }
  .thanks { font-size: 14px; color: #1a6b3c; font-weight: bold; margin-top: 12px; }
  .footer { font-size: 10px; color: #aaa; margin-top: 8px; }
  @media print {
    body { padding: 0; }
    .receipt { border: none; width: 100%; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <div class="receipt">
    <div class="center">
      <div class="shop-name">${shopName}</div>
      <div class="subtitle">${t.subtitle}</div>
    </div>

    <div class="line"></div>

    <div class="detail">📅 ${date.toLocaleDateString(loc)} ⏰ ${date.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}</div>
    <div class="detail">🔢 ${t.no}: ${transaction.id.slice(0, 8).toUpperCase()}</div>
    <div class="detail">💳 ${paymentLabels[transaction.paymentMethod] || transaction.paymentMethod}</div>

    <div class="line-light"></div>

    <table>
      <tr><th style="text-align:right">${t.article}</th><th style="text-align:center">${t.stk}</th><th style="text-align:left">${t.sum}</th></tr>
      ${itemsHTML}
    </table>

    <div class="line"></div>

    <div class="detail" style="display:flex;justify-content:space-between"><span>${t.total}:</span><span class="total-row" style="font-size:16px">${formatIQD(transaction.total)}</span></div>

    ${transaction.paymentMethod === 'cash' ? `
    <div class="detail" style="display:flex;justify-content:space-between"><span>${t.given}:</span><span>${formatIQD(transaction.amountPaid)}</span></div>
    <div class="detail" style="display:flex;justify-content:space-between"><span>${t.change}:</span><span style="color:#e65100;font-weight:bold">${formatIQD(transaction.change)}</span></div>
    ` : ''}

    <div class="line-light"></div>

    <div class="center thanks">${t.thanks}</div>
    <div class="center" style="font-size:12px;color:#888">${t.thanks}</div>

    <div class="center footer">كاشير POS v1.0.0</div>
  </div>

  <div class="center no-print" style="margin-top:20px">
    <button onclick="window.print()" style="padding:16px 32px;font-size:18px;background:#1a6b3c;color:#fff;border:none;border-radius:12px;cursor:pointer;font-weight:bold">
      🖨️ ${t.print}
    </button>
    <br><br>
    <button onclick="window.close()" style="padding:12px 24px;font-size:14px;background:#f0f0f0;border:none;border-radius:8px;cursor:pointer">
      ${t.close}
    </button>
  </div>
</body>
</html>`;
}

export function printReceiptWeb(transaction: Transaction, shopName: string = 'كاشير - POS'): void {
  const html = generateReceiptHTML(transaction, shopName);

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // Open in same tab to avoid popup blocker
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(html);
      newWindow.document.close();
      // Auto-trigger print dialog
      setTimeout(() => { try { newWindow.print(); } catch {} }, 800);
    } else {
      // Fallback: replace current page
      const originalContent = document.documentElement.innerHTML;
      document.documentElement.innerHTML = html;
      document.querySelector('button[onclick="window.print()"]')?.addEventListener('click', () => {
        window.print();
        document.documentElement.innerHTML = originalContent;
      });
    }
  }
}

export async function printReceiptNative(transaction: Transaction, shopName: string = 'كاشير - POS'): Promise<boolean> {
  try {
    const { isConnected, printReceipt } = require('./bluetoothPrinter');
    if (isConnected()) {
      await printReceipt(transaction, shopName);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
