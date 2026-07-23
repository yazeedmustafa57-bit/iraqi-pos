import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, Alert, ScrollView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCartStore } from '../stores/cartStore';
import { useAppStore } from '../stores/appStore';
import { translations } from '../i18n/translations';
import { formatIQD } from '../i18n';
import { saveTransaction, updateProduct } from '../database/db';
import { processPayment } from '../services/payments';
import CartItemRow from '../components/CartItemRow';
import ConnectivityIndicator from '../components/ConnectivityIndicator';
import { PaymentMethod, Transaction } from '../types';
import { generateId } from "../utils/uuid";
import { startPaymentPolling, stopPaymentPolling, confirmPaymentReceived, supportsAutoCheck } from '../services/paymentGateway';
import { generateQRCodeDataURL, generateMerchantId, PAYMENT_METHOD_INFO } from '../utils/qrPayment';
import { getLocalDateTimeString } from "../utils/dateHelper";
import { isConnected as isPrinterConnected, printReceipt } from "../services/bluetoothPrinter";
import { generateReceiptHTML } from "../services/receiptPrinter";

const PAYMENT_METHODS: { key: PaymentMethod; icon: string }[] = [
  { key: 'cash', icon: 'cash-outline' },
  { key: 'zaincash', icon: 'phone-portrait-outline' },
  { key: 'asia_hawala', icon: 'wallet-outline' },
  { key: 'fastpay', icon: 'flash-outline' },
  { key: 'credit_card', icon: 'card-outline' },
  { key: 'fib', icon: 'business-outline' },
];


const _isWeb = Platform.OS === 'web';
function showAlert(title: string, msg: string) {
  if (_isWeb) window.alert(title + ': ' + msg);
  else showAlert(title, msg);
}

export default function CartScreen() {
  const { items, removeItem, updateQuantity, clearCart, getTotal, getItemCount } = useCartStore();
  const isOnline = useAppStore((s) => s.isOnline);
  const lang = useAppStore((s) => s.language);
  const currentUser = useAppStore((s) => s.currentUser);
  const setLastTransaction = useAppStore((s) => s.setLastTransaction);
  const setShowPaymentSuccess = useAppStore((s) => s.setShowPaymentSuccess);

  const t = useCallback((key: string) => translations[lang]?.[key] ?? key, [lang]);
  const navigation = useNavigation<any>();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptTx, setReceiptTx] = useState<Transaction | null>(null);
  const [paymentWaiting, setPaymentWaiting] = useState(false);
  const [paymentTimer, setPaymentTimer] = useState(300);
  const [paymentTxId, setPaymentTxId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const total = getTotal();
  const itemCount = getItemCount();
  const paidAmount = amountPaid ? parseInt(amountPaid.replace(/[^0-9]/g, ''), 10) || 0 : 0;
  const change = paidAmount - total;
  const canPay = selectedMethod === 'cash' ? paidAmount >= total : true;

  const handleCheckout = () => {
    if (items.length === 0) return;
    setSelectedMethod('cash');
    setAmountPaid('');
    setShowPaymentModal(true);
  };

  const handlePay = async () => {
    if (selectedMethod === 'cash' && paidAmount < total) {
      showAlert(t('general.error'), t('cart.insufficient'));
      return;
    }

    // For non-cash methods: show waiting screen first
    if (selectedMethod !== 'cash') {
      const txId = generateId();
      setPaymentTxId(txId);
      setPaymentWaiting(true);
      setPaymentTimer(300);

      // Generate QR code
      const phone = currentUser?.paymentAccounts?.[selectedMethod as keyof typeof currentUser.paymentAccounts] || '';
      if (phone) {
        const merchantId = generateMerchantId(currentUser?.shopName || '', currentUser?.phone || '');
        try {
          const qr = await generateQRCodeDataURL({
            method: selectedMethod,
            phone,
            amount: total,
            currency: 'IQD',
            shopName: currentUser?.shopName || 'POS',
            shopId: merchantId,
            transactionId: txId,
          });
          setQrDataUrl(qr);
        } catch (e) { console.warn('QR generation failed:', e); }
      }
      setPaymentTimer(300);
      setShowPaymentModal(false);
      return;
    }

    // Cash: process immediately
    await completePayment('cash', paidAmount, change);
  };

  const completePayment = async (method: PaymentMethod, amountPaidVal: number, changeVal: number) => {
    setProcessing(true);
    try {
      const txId = paymentTxId || generateId();
      const transaction: Transaction = {
        id: txId,
        items: [...items],
        total,
        paymentMethod: method,
        amountPaid: method === 'cash' ? amountPaidVal : total,
        change: method === 'cash' ? changeVal : 0,
        status: 'completed',
        createdAt: getLocalDateTimeString(),
      };

      if (method !== 'cash') {
        const result = await processPayment(method, {
          amount: total,
          transactionId: txId,
        }, isOnline);

        if (result.pendingSync) {
          transaction.status = 'pending_sync';
        }

        if (!result.success && !result.pendingSync) {
          showAlert(t('payment.failed'), result.error || '');
          setProcessing(false);
          setPaymentWaiting(false);
          return;
        }
      }

      await saveTransaction(transaction);

      if (isPrinterConnected()) {
        try {
          await printReceipt(transaction, currentUser?.shopName || 'كاشير - POS');
        } catch (printErr) {
          console.warn('Auto-print failed:', printErr);
        }
      }

      for (const item of items) {
        try {
          await updateProduct({
            ...item.product,
            stock: item.product.stock - item.quantity,
          });
        } catch (stockError) {
          console.warn('Stock update failed for', item.product.id, stockError);
        }
      }

      setLastTransaction(transaction);
      clearCart();
      setShowPaymentModal(false);
      setPaymentWaiting(false);
      setAmountPaid('');
      setShowPaymentSuccess(true);
      setPaymentTxId(null);

      if (Platform.OS === 'web') {
        setReceiptTx(transaction);
        setShowReceipt(true);
      }

      setTimeout(() => setShowPaymentSuccess(false), 3000);
    } catch (error) {
      showAlert(t('general.error'), String(error));
    } finally {
      setProcessing(false);
    }
  };

  // Auto-polling for payment status
  React.useEffect(() => {
    if (paymentWaiting && paymentTxId && supportsAutoCheck(selectedMethod)) {
      startPaymentPolling(
        paymentTxId,
        total,
        selectedMethod,
        () => {
          // Payment received -> auto-confirm
          setPaymentTimer(0);
          completePayment(selectedMethod, total, 0);
        },
        () => {
          // Payment failed
          setPaymentWaiting(false);
          setPaymentTxId(null);
          showAlert(t('payment.failed'), '');
        },
        () => {
          // Expired
          setPaymentWaiting(false);
          setPaymentTxId(null);
          showAlert(t('payment.timeout'), '');
        }
      );
    }
    return () => { stopPaymentPolling(); };
  }, [paymentWaiting, paymentTxId]);

  // Countdown timer for visual display
  React.useEffect(() => {
    if (paymentWaiting && paymentTimer > 0) {
      timerRef.current = setInterval(() => {
        setPaymentTimer((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paymentWaiting]);

  const handleConfirmPaymentReceived = () => {
    stopPaymentPolling();
    if (timerRef.current) clearInterval(timerRef.current);
    completePayment(selectedMethod, total, 0);
  };

  const handleCancelPaymentWaiting = () => {
    stopPaymentPolling();
    if (timerRef.current) clearInterval(timerRef.current);
    setPaymentWaiting(false);
    setPaymentTimer(300);
    setPaymentTxId(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('cart.title')}</Text>
        <View style={styles.headerRight}>
          <ConnectivityIndicator />
          <Text style={styles.itemCount}>{itemCount}</Text>
        </View>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>{t('cart.empty')}</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(item) => item.product.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <CartItemRow
                item={item}
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
              />
            )}
          />

          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('cart.total')}</Text>
              <Text style={styles.totalValue}>{formatIQD(total)}</Text>
            </View>
            <TouchableOpacity style={styles.payBtn} onPress={handleCheckout}>
              <Ionicons name="cash" size={22} color="#fff" />
              <Text style={styles.payBtnText}>{t('cart.pay')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <Modal visible={showPaymentModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('payment.title')}</Text>

            <View style={styles.methodsGrid}>
              {PAYMENT_METHODS.map(({ key, icon }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.methodBtn, selectedMethod === key && styles.methodBtnActive]}
                  onPress={() => {
                    setSelectedMethod(key);
                    setAmountPaid('');
                  }}
                >
                  <Ionicons
                    name={icon as any}
                    size={24}
                    color={selectedMethod === key ? '#fff' : '#1a6b3c'}
                  />
                  <Text style={[styles.methodText, selectedMethod === key && styles.methodTextActive]}>
                    {t(`payment.${key}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedMethod === 'cash' && (
              <View style={styles.cashSection}>
                <Text style={styles.label}>{t('payment.amountPaid')}</Text>
                <TextInput
                  style={styles.cashInput}
                  placeholder="0"
                  keyboardType="numeric"
                  value={amountPaid}
                  onChangeText={setAmountPaid}
                  autoFocus
                />
                {paidAmount > 0 && (
                  <View style={styles.changeRow}>
                    <Text style={styles.changeLabel}>{t('payment.change')}</Text>
                    <Text style={[styles.changeValue, change < 0 && styles.changeNegative]}>
                      {change >= 0 ? formatIQD(change) : `-${formatIQD(Math.abs(change))}`}
                    </Text>
                  </View>
                )}
                {paidAmount > 0 && paidAmount < total && (
                  <View style={styles.insufficientRow}>
                    <Ionicons name="alert-circle" size={16} color="#e53935" />
                    <Text style={styles.insufficientText}>
                      {t('cart.insufficient')} - {formatIQD(total)} {formatIQD(total)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {selectedMethod !== 'cash' && selectedMethod !== 'credit_card' && (
              <View style={{ backgroundColor: '#f0f8f0', borderRadius: 12, padding: 16, marginTop: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Ionicons name="information-circle-outline" size={20} color="#1a6b3c" />
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1a6b3c' }}>{t('payment.payViaPhone')}</Text>
                </View>
                {(() => {
                  const accounts = currentUser?.paymentAccounts;
                  const accountMap: Record<string, string | undefined> = {
                    fib: accounts?.fib,
                    zaincash: accounts?.zaincash,
                    fastpay: accounts?.fastpay,
                    asia_hawala: accounts?.asia_hawala,
                  };
                  const accountNumber = accountMap[selectedMethod];
                  const methodLabels: Record<string, string> = {
                    fib: 'FIB', zaincash: 'ZainCash', fastpay: 'FastPay', asia_hawala: 'AsiaHawala'
                  };
                  if (accountNumber) {
                    return (
                      <>
                        <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#333', textAlign: 'center', marginVertical: 8 }}>
                          {accountNumber}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#888', textAlign: 'center' }}>
                          {methodLabels[selectedMethod]} - {t('payment.phoneNumber')}
                        </Text>
                      </>
                    );
                  } else {
                    return (
                      <Text style={{ fontSize: 13, color: '#888', textAlign: 'center', paddingVertical: 8 }}>
                        {selectedMethod === 'zaincash' && t('payment.redirectZaincash')}
                        {selectedMethod === 'asia_hawala' && t('payment.redirectAsiaHawala')}
                        {selectedMethod === 'fastpay' && t('payment.redirectFastpay')}
                        {selectedMethod === 'fib' && t('payment.redirectFib')}
                      </Text>
                    );
                  }
                })()}
              </View>
            )}
            {selectedMethod === 'credit_card' && (
              <View style={styles.methodInfoRow}>
                <Ionicons name="information-circle-outline" size={18} color="#555" />
                <Text style={styles.methodInfoText}>{t('payment.credit_card')}</Text>
              </View>
            )}

            <View style={styles.modalTotal}>
              <Text style={styles.modalTotalLabel}>{t('cart.total')}</Text>
              <Text style={styles.modalTotalValue}>{formatIQD(total)}</Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowPaymentModal(false); setAmountPaid(''); }}
              >
                <Text style={styles.cancelBtnText}>{t('general.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  (processing || (selectedMethod === 'cash' && !canPay)) && styles.confirmBtnDisabled
                ]}
                onPress={handlePay}
                disabled={processing || (selectedMethod === 'cash' && !canPay)}
              >
                <Text style={styles.confirmBtnText}>
                  {processing ? t('payment.processing') : t('payment.confirm')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Payment Waiting Modal */}
      <Modal visible={paymentWaiting} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, alignItems: 'center' }}>
            {/* Spinner animation */}
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="sync-outline" size={40} color="#1a6b3c" />
            </View>

            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8 }}>{t('payment.waitingTitle')}</Text>
            <Text style={{ fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 8 }}>{t('payment.waitingSubtitle')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#1a6b3c" />
                <Text style={{ fontSize: 12, color: '#1a6b3c', fontWeight: '600' }}>{t('payment.autoChecking')}</Text>
              </View>

            {/* Amount */}
            <View style={{ backgroundColor: '#f0f8f0', borderRadius: 12, padding: 16, width: '100%', marginBottom: 16 }}>
              <Text style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 4 }}>{t('cart.total')}</Text>
              <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#1a6b3c', textAlign: 'center' }}>{formatIQD(total)}</Text>
            </View>

            {/* QR Code + Payment Info */}
            {(() => {
              const accounts = currentUser?.paymentAccounts;
              const accountMap: Record<string, string | undefined> = {
                fib: accounts?.fib,
                zaincash: accounts?.zaincash,
                fastpay: accounts?.fastpay,
                asia_hawala: accounts?.asia_hawala,
              };
              const phone = accountMap[selectedMethod];
              const methodLabels: Record<string, string> = {
                fib: 'FIB', zaincash: 'ZainCash', fastpay: 'FastPay', asia_hawala: 'AsiaHawala'
              };
              const methodInfo = PAYMENT_METHOD_INFO[selectedMethod] || { icon: '💳', color: '#666', label: selectedMethod };
              if (phone) {
                return (
                  <View style={{ backgroundColor: '#f8f9fa', borderRadius: 16, padding: 20, width: '100%', marginBottom: 16, alignItems: 'center' }}>
                    {/* QR Code */}
                    {qrDataUrl ? (
                      <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 }}>
                        <img src={qrDataUrl} style={{ width: 200, height: 200, borderRadius: 8 }} alt="QR Code" />
                      </View>
                    ) : (
                      <View style={{ width: 200, height: 200, backgroundColor: '#eee', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={{ color: '#999' }}>{t('payment.generatingQR')}</Text>
                      </View>
                    )}

                    {/* Method badge */}
                    <View style={{ backgroundColor: methodInfo.color, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 10 }}>
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>{methodInfo.icon} {methodLabels[selectedMethod]}</Text>
                    </View>

                    {/* Phone number */}
                    <Text style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{t('payment.scanToPay')}</Text>
                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#333', letterSpacing: 2 }}>{phone}</Text>

                    {/* Merchant ID */}
                    <Text style={{ fontSize: 10, color: '#aaa', marginTop: 6 }}>
                      🏪 {generateMerchantId(currentUser?.shopName || '', currentUser?.phone || '')}
                    </Text>
                  </View>
                );
              }
              return null;
            })()}

            {/* Timer */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Ionicons name="time-outline" size={20} color={paymentTimer > 60 ? '#1a6b3c' : '#e53935'} />
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: paymentTimer > 60 ? '#1a6b3c' : '#e53935' }}>
                {Math.floor(paymentTimer / 60)}:{(paymentTimer % 60).toString().padStart(2, '0')}
              </Text>
            </View>

            {paymentTimer === 0 && (
              <Text style={{ fontSize: 13, color: '#e53935', marginBottom: 12 }}>{t('payment.timeout')}</Text>
            )}

            {/* Confirm button */}
            <TouchableOpacity
              style={{ backgroundColor: '#1a6b3c', borderRadius: 12, paddingVertical: 16, paddingHorizontal: 32, width: '100%', alignItems: 'center', marginBottom: 10 }}
              onPress={handleConfirmPaymentReceived}
            >
              <Ionicons name="checkmark-circle-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{t('payment.confirmManual')}</Text>
            </TouchableOpacity>

            {/* Cancel button */}
            <TouchableOpacity
              style={{ paddingVertical: 12, paddingHorizontal: 20 }}
              onPress={handleCancelPaymentWaiting}
            >
              <Text style={{ color: '#999', fontSize: 14 }}>{t('general.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Receipt Modal */}
      {showReceipt && receiptTx && (
        <Modal visible={showReceipt} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 0, maxHeight: '90%', overflow: 'hidden' }}>
              {/* Receipt header */}
              <View style={{ backgroundColor: '#1a6b3c', padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>🧾 {t('receipt.title')}</Text>
                <TouchableOpacity onPress={() => setShowReceipt(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Receipt content */}
              <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                <Text style={{ textAlign: 'center', fontSize: 22, fontWeight: 'bold', color: '#1a6b3c', marginBottom: 4 }}>
                  {currentUser?.shopName || 'كاشير - POS'}
                </Text>
                <Text style={{ textAlign: 'center', fontSize: 12, color: '#888', marginBottom: 12 }}>{t('auth.shopSubtitle')}</Text>
                <View style={{ borderTopWidth: 2, borderTopColor: '#333', marginVertical: 8 }} />

                <Text style={{ fontSize: 13, color: '#555', marginBottom: 2 }}>
                  {(() => { const loc = lang === 'ar' || lang === 'ku' ? 'ar-IQ' : lang === 'de' ? 'de-DE' : 'en-US'; return `📅 ${new Date(receiptTx.createdAt).toLocaleDateString(loc)} ⏰ ${new Date(receiptTx.createdAt).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}`; })()}
                </Text>
                <Text style={{ fontSize: 13, color: '#555', marginBottom: 2 }}>
                  🔖 {t('receipt.invoiceNo')}: {receiptTx.id.slice(0, 8).toUpperCase()}
                </Text>
                <Text style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
                  💳 {receiptTx.paymentMethod.toUpperCase()}
                </Text>

                <View style={{ borderTopWidth: 1, borderTopColor: '#eee', marginVertical: 4 }} />

                {(receiptTx.items as any[]).map((item: any, idx: number) => (
                  <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
                    <Text style={{ flex: 1, fontSize: 13, color: '#333' }}>{item.product.name} ×{item.quantity}</Text>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1a6b3c' }}>{formatIQD(item.subtotal)}</Text>
                  </View>
                ))}

                <View style={{ borderTopWidth: 2, borderTopColor: '#333', marginVertical: 8 }} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>{t('receipt.total')}:</Text>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1a6b3c' }}>{formatIQD(receiptTx.total)}</Text>
                </View>

                {receiptTx.paymentMethod === 'cash' && (
                  <>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, color: '#555' }}>{t('receipt.given')}:</Text>
                      <Text style={{ fontSize: 13, color: '#555' }}>{formatIQD(receiptTx.amountPaid)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, color: '#555' }}>{t('receipt.change')}:</Text>
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#e65100' }}>{formatIQD(receiptTx.change)}</Text>
                    </View>
                  </>
                )}

                <View style={{ borderTopWidth: 1, borderTopColor: '#eee', marginVertical: 12 }} />
                <Text style={{ textAlign: 'center', fontSize: 14, fontWeight: 'bold', color: '#1a6b3c' }}>{t('receipt.thankYou')}</Text>
                <Text style={{ textAlign: 'center', fontSize: 10, color: '#aaa', marginTop: 8 }}>كاشير POS v1.0.0</Text>
              </ScrollView>

              {/* Print button */}
              <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: '#eee', flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={{ flex: 1, padding: 14, backgroundColor: '#1a6b3c', borderRadius: 10, alignItems: 'center' }}
                  onPress={() => {
                    // Use browser print
                    const html = generateReceiptHTML(receiptTx, currentUser?.shopName || 'كاشير - POS', lang);
                    const w = window.open('', '_blank');
                    if (w) { w.document.write(html); w.document.close(); setTimeout(() => { try { w.print(); } catch {} }, 500); }
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>🖨️ {t('receipt.print')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, padding: 14, backgroundColor: '#f0f0f0', borderRadius: 10, alignItems: 'center' }}
                  onPress={() => setShowReceipt(false)}
                >
                  <Text style={{ color: '#333', fontWeight: '600', fontSize: 15 }}>{t('receipt.close')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#1a6b3c',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemCount: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    backgroundColor: '#145228',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
  },
  list: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#aaa',
    marginTop: 16,
  },
  footer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a6b3c',
  },
  payBtn: {
    backgroundColor: '#1a6b3c',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  payBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  methodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  methodBtn: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1a6b3c',
    width: '30%',
    minWidth: 90,
  },
  methodBtnActive: {
    backgroundColor: '#1a6b3c',
  },
  methodText: {
    fontSize: 11,
    marginTop: 4,
    color: '#1a6b3c',
    fontWeight: '600',
    textAlign: 'center',
  },
  methodTextActive: {
    color: '#fff',
  },
  cashSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
  },
  cashInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    writingDirection: 'ltr',
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  changeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  changeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a6b3c',
  },
  changeNegative: {
    color: '#e53935',
  },
  insufficientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  insufficientText: {
    fontSize: 12,
    color: '#e53935',
    fontWeight: '500',
  },
  methodInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  methodInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#555',
  },
  modalTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    marginBottom: 12,
  },
  modalTotalLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a6b3c',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  confirmBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#1a6b3c',
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
