import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, Alert,
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
import { getLocalDateTimeString } from "../utils/dateHelper";
import { isConnected as isPrinterConnected, printReceipt } from "../services/bluetoothPrinter";

const PAYMENT_METHODS: { key: PaymentMethod; icon: string }[] = [
  { key: 'cash', icon: 'cash-outline' },
  { key: 'zaincash', icon: 'phone-portrait-outline' },
  { key: 'asia_hawala', icon: 'wallet-outline' },
  { key: 'fastpay', icon: 'flash-outline' },
  { key: 'credit_card', icon: 'card-outline' },
  { key: 'fib', icon: 'business-outline' },
];

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
      Alert.alert(t('general.error'), t('cart.insufficient'));
      return;
    }

    setProcessing(true);
    try {
      const txId = generateId();
      const transaction: Transaction = {
        id: txId,
        items: [...items],
        total,
        paymentMethod: selectedMethod,
        amountPaid: selectedMethod === 'cash' ? paidAmount : total,
        change: selectedMethod === 'cash' ? change : 0,
        status: 'completed',
        createdAt: getLocalDateTimeString(),
      };

      if (selectedMethod !== 'cash') {
        const result = await processPayment(selectedMethod, {
          amount: total,
          transactionId: txId,
        }, isOnline);

        if (result.pendingSync) {
          transaction.status = 'pending_sync';
        }

        if (!result.success && !result.pendingSync) {
          Alert.alert(t('payment.failed'), result.error || '');
          setProcessing(false);
          return;
        }
      }

      await saveTransaction(transaction);

      // Auto-print receipt if Bluetooth printer is connected
      if (isPrinterConnected()) {
        try {
          await printReceipt(transaction, currentUser?.shopName || 'كاشير - POS');
        } catch (printErr) {
          console.warn('Auto-print failed:', printErr);
        }
      }

      // Update stock individually, wrapping each in try/catch so one failure
      // doesn't crash the whole payment flow
      for (const item of items) {
        try {
          await updateProduct({
            ...item.product,
            stock: item.product.stock - item.quantity,
          });
        } catch (stockError) {
          console.warn('Stock update failed for', item.product.id, stockError);
          // Continue even if stock update fails - transaction is already saved
        }
      }

      setLastTransaction(transaction);
      clearCart();
      setShowPaymentModal(false);
      setAmountPaid('');
      setShowPaymentSuccess(true);

      setTimeout(() => setShowPaymentSuccess(false), 3000);
    } catch (error) {
      Alert.alert(t('general.error'), String(error));
    } finally {
      setProcessing(false);
    }
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

            {selectedMethod !== 'cash' && (
              <View style={styles.methodInfoRow}>
                <Ionicons name="information-circle-outline" size={18} color="#555" />
                <Text style={styles.methodInfoText}>
                  {selectedMethod === 'zaincash' && t('payment.redirectZaincash')}
                  {selectedMethod === 'asia_hawala' && t('payment.redirectAsiaHawala')}
                  {selectedMethod === 'fastpay' && t('payment.redirectFastpay')}
                  {selectedMethod === 'credit_card' && t('payment.credit_card')}
                </Text>
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
