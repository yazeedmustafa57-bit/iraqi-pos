/**
 * PRAXISTEST: Shop-Isolation
 * 
 * Verifiziert:
 * 1. Zwei Shops unabhängig voneinander
 * 2. Eigene FIB-Konfiguration pro Shop
 * 3. Shop A sieht keine Daten von Shop B
 * 4. Bestellungen korrekt zugeordnet
 * 5. Webhooks korrekt zugeordnet (shop_id im Payload)
 */

const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
};
(globalThis as any).localStorage = mockLocalStorage;

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface FIBConfig {
  enabled: boolean; merchantId: string; apiKey: string; secretKey: string;
  webhookUrl: string; sandboxMode: boolean; baseUrl: string;
}
const defaultFIBConfig: FIBConfig = {
  enabled: false, merchantId: '', apiKey: '', secretKey: '',
  webhookUrl: '', sandboxMode: true, baseUrl: '',
};

function loadFIBConfig(userId: string): FIBConfig {
  const stored = mockLocalStorage.getItem(`iraqi_pos_fib_config_${userId}`);
  if (stored) return { ...defaultFIBConfig, ...JSON.parse(stored) };
  return defaultFIBConfig;
}

function saveFIBConfig(userId: string, config: FIBConfig): void {
  mockLocalStorage.setItem(`iraqi_pos_fib_config_${userId}`, JSON.stringify(config));
}

function generateFIBOrderId(shopId: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const random = Math.random().toString(36).substring(2, 8);
  return `${shopId}__${timestamp}__${random}`;
}

function parseFIBWebhook(payload: any): {
  shopId: string; paymentId: string; orderId: string;
  status: 'paid' | 'failed'; amount: number;
} | null {
  try {
    if (!payload || !payload.shop_id || !payload.order_id) return null;
    if (payload.status === 'paid' || payload.status === 'success') {
      return {
        shopId: payload.shop_id, paymentId: payload.payment_id || '',
        orderId: payload.order_id, status: 'paid', amount: payload.amount || 0,
      };
    }
    if (payload.status === 'failed' || payload.status === 'error') {
      return {
        shopId: payload.shop_id, paymentId: payload.payment_id || '',
        orderId: payload.order_id, status: 'failed', amount: payload.amount || 0,
      };
    }
    return null;
  } catch { return null; }
}

let passed = 0;
let failed = 0;
function test(name: string, condition: boolean, detail?: string) {
  if (condition) { console.log(`  ✅ ${name}`); passed++; }
  else { console.log(`  ❌ ${name}${detail ? ' - ' + detail : ''}`); failed++; }
}

console.log('\n🏪 PRAXISTEST: Shop-Isolation\n');

// --- SHOP A ---
const shopAId = generateId();
saveFIBConfig(shopAId, {
  enabled: true, merchantId: 'FIB-MERCHANT-A-12345',
  apiKey: 'api-key-A-SECRET', secretKey: 'secret-A-SECRET',
  webhookUrl: `https://backend.de/fib-webhook/shop/${shopAId}`,
  sandboxMode: false, baseUrl: 'https://api.fib.iq',
});
console.log(`📋 Shop A: ${shopAId}`);

// --- SHOP B ---
const shopBId = generateId();
saveFIBConfig(shopBId, {
  enabled: true, merchantId: 'FIB-MERCHANT-B-67890',
  apiKey: 'api-key-B-SECRET', secretKey: 'secret-B-SECRET',
  webhookUrl: `https://backend.de/fib-webhook/shop/${shopBId}`,
  sandboxMode: true, baseUrl: 'https://sandbox.fib.iq',
});
console.log(`📋 Shop B: ${shopBId}\n`);

// --- TEST 1: Shop-Isolation ---
console.log('🔍 Test 1: FIB-Konfiguration pro Shop');
const loadedA = loadFIBConfig(shopAId);
const loadedB = loadFIBConfig(shopBId);
test('Shop A eigene Merchant ID', loadedA.merchantId === 'FIB-MERCHANT-A-12345');
test('Shop B eigene Merchant ID', loadedB.merchantId === 'FIB-MERCHANT-B-67890');
test('Merchant IDs unterschiedlich', loadedA.merchantId !== loadedB.merchantId);
test('API Keys unterschiedlich', loadedA.apiKey !== loadedB.apiKey);
test('Sandbox-Modus unterschiedlich', loadedA.sandboxMode === false && loadedB.sandboxMode === true);
test('Base URL unterschiedlich', loadedA.baseUrl !== loadedB.baseUrl);

// --- TEST 2: Unbekannte ID ---
console.log('\n🔍 Test 2: Unbekannte Shop-ID');
const unknown = loadFIBConfig('unknown-id');
test('Unbekannte ID → leere Config', unknown.merchantId === '' && unknown.enabled === false);

// --- TEST 3: Bestellungs-ID ---
console.log('\n🔍 Test 3: Bestellungs-ID-Zuordnung');
const orderA = generateFIBOrderId(shopAId);
const orderB = generateFIBOrderId(shopBId);
test('Order A beginnt mit Shop A ID', orderA.startsWith(shopAId + '__'));
test('Order B beginnt mit Shop B ID', orderB.startsWith(shopBId + '__'));
test('Orders unterschiedlich', orderA !== orderB);
console.log(`   Order A: ${orderA}`);
console.log(`   Order B: ${orderB}`);

// --- TEST 4: Webhook-Zuordnung (shop_id im Payload) ---
console.log('\n🔍 Test 4: Webhook-Zuordnung');
const webhookA = parseFIBWebhook({
  shop_id: shopAId, payment_id: 'FIB-PAY-001', order_id: orderA, status: 'paid', amount: 15000,
});
const webhookB = parseFIBWebhook({
  shop_id: shopBId, payment_id: 'FIB-PAY-002', order_id: orderB, status: 'paid', amount: 25000,
});
test('Webhook A gehört zu Shop A', webhookA?.shopId === shopAId);
test('Webhook B gehört zu Shop B', webhookB?.shopId === shopBId);
test('Payment IDs unterschiedlich', webhookA?.paymentId !== webhookB?.paymentId);
test('Betrag A = 15000', webhookA?.amount === 15000);
test('Betrag B = 25000', webhookB?.amount === 25000);

// --- TEST 5: Unabhängigkeit ---
console.log('\n🔍 Test 5: Unabhängigkeit');
test('Shop A config ≠ Shop B config',
  loadFIBConfig(shopAId).merchantId !== loadFIBConfig(shopBId).merchantId);

// --- TEST 6: Config-Änderung ---
console.log('\n🔍 Test 6: Config-Änderung isoliert');
saveFIBConfig(shopAId, { ...loadedA, merchantId: 'UPDATED-A' });
test('Shop A aktualisiert', loadFIBConfig(shopAId).merchantId === 'UPDATED-A');
test('Shop B unverändert', loadFIBConfig(shopBId).merchantId === 'FIB-MERCHANT-B-67890');

// --- TEST 7: Webhook mit fehlenden Daten ---
console.log('\n🔍 Test 7: Webhook mit fehlenden Daten');
test('Leerer Payload → null', parseFIBWebhook(null) === null);
test('Fehlende shop_id → null', parseFIBWebhook({ order_id: 'x', status: 'paid' }) === null);
test('Fehlende order_id → null', parseFIBWebhook({ shop_id: 'x', status: 'paid' }) === null);
test('Unbekannter Status → null', parseFIBWebhook({ shop_id: 'x', order_id: 'y', status: 'unknown' }) === null);

// --- ERGEBNIS ---
console.log('\n' + '='.repeat(50));
console.log(`\n📊 ERGEBNIS: ${passed} bestanden, ${failed} fehlgeschlagen`);
if (failed === 0) {
  console.log('\n🎉 ALLE TESTS BESTANDEN!');
  console.log('   Shop-Isolation funktioniert korrekt.');
  console.log('   Jeder Shop hat eigene FIB-Konfiguration.');
  console.log('   Webhooks korrekt dem richtigen Shop zugeordnet.');
  console.log('   Bereit für Produktion (nach FIB-Doku).\n');
} else {
  console.log('\n⚠️  TESTS FEHLGESCHLAGEN!\n');
  process.exit(1);
}
