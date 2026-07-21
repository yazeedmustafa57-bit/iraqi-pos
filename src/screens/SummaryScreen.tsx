import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, FlatList, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTransactionsByDate } from '../database/db';
import { calculateDailySummary } from '../stores/appStore';
import { useAppStore } from '../stores/appStore';
import { translations } from '../i18n/translations';
import { formatIQD } from '../i18n';
import { DailySummary, PaymentMethod, Transaction } from '../types';
import ConnectivityIndicator from '../components/ConnectivityIndicator';

const PAYMENT_LABELS: Record<PaymentMethod, { ar: string; ku: string; en: string; de: string; icon: string }> = {
  cash: { ar: 'نقدي', ku: 'ناقد', en: 'Cash', de: 'Bargeld', icon: 'cash-outline' },
  zaincash: { ar: 'ZainCash', ku: 'ZainCash', en: 'ZainCash', de: 'ZainCash', icon: 'phone-portrait-outline' },
  asia_hawala: { ar: 'آسيا هافالة', ku: 'ئاسیا هەڕالا', en: 'AsiaHawala', de: 'AsiaHawala', icon: 'wallet-outline' },
  fastpay: { ar: 'FastPay', ku: 'FastPay', en: 'FastPay', de: 'FastPay', icon: 'flash-outline' },
  credit_card: { ar: 'بطاقة ائتمان', ku: 'کارتی بانکی', en: 'Credit Card', de: 'Kreditkarte', icon: 'card-outline' },
  fib: { ar: 'فيب FIB', ku: 'FIB', en: 'FIB Bank', de: 'FIB Bank', icon: 'business-outline' },
};

function formatDateStr(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function formatTime(dateStr: string): string {
  const timePart = dateStr.split('T')[1];
  if (!timePart) return '';
  return timePart.substring(0, 5);
}

function getWeekday(dateStr: string, locale: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(locale, { weekday: 'long' });
}

export default function SummaryScreen() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDetail, setShowDetail] = useState<Transaction | null>(null);
  const lang = useAppStore((s) => s.language);
  const t = useCallback((key: string) => translations[lang]?.[key] ?? key, [lang]);

  const dateToString = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const loadData = useCallback(async () => {
    const dateStr = dateToString(selectedDate);
    const txList = await getTransactionsByDate(dateStr);
    setTransactions(txList);
    setSummary(calculateDailySummary(txList));
  }, [selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const changeDay = (offset: number) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + offset);
      return next;
    });
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const dateStr = dateToString(selectedDate);
  const isToday = dateStr === dateToString(new Date());

  const locale = lang === 'ar' || lang === 'ku' ? 'ar-IQ' : lang === 'de' ? 'de-DE' : 'en-US';
  const weekday = getWeekday(dateStr, locale);
  const fullDateStr = selectedDate.toLocaleDateString(locale, {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  // Calculate average transaction value
  const avgTransaction = summary && summary.totalTransactions > 0
    ? Math.round(summary.totalSales / summary.totalTransactions)
    : 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t('summary.title')}</Text>
        <ConnectivityIndicator />
      </View>

      {/* Date Navigation */}
      <View style={styles.dateNav}>
        <TouchableOpacity style={styles.dateArrow} onPress={() => changeDay(-1)}>
          <Ionicons name="chevron-back" size={24} color="#1a6b3c" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.dateCenter} onPress={goToToday}>
          <Ionicons name="calendar" size={18} color="#1a6b3c" />
          <View style={styles.dateTextCol}>
            <Text style={styles.dateWeekday}>{weekday}</Text>
            <Text style={styles.dateFull}>{fullDateStr}</Text>
          </View>
          {!isToday && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>{t('summary.today')}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dateArrow, isToday && styles.dateArrowDisabled]}
          onPress={() => !isToday && changeDay(1)}
          disabled={isToday}
        >
          <Ionicons name="chevron-forward" size={24} color={isToday ? '#ccc' : '#1a6b3c'} />
        </TouchableOpacity>
      </View>

      {summary && summary.totalTransactions > 0 ? (
        <>
          {/* Stats Cards */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="trending-up" size={24} color="#1a6b3c" />
              <Text style={styles.statValue}>{formatIQD(summary.totalSales)}</Text>
              <Text style={styles.statLabel}>{t('summary.totalSales')}</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="receipt" size={24} color="#1a6b3c" />
              <Text style={styles.statValue}>{summary.totalTransactions}</Text>
              <Text style={styles.statLabel}>{t('summary.totalTransactions')}</Text>
            </View>
          </View>

          {avgTransaction > 0 && (
            <View style={styles.avgRow}>
              <Ionicons name="calculator-outline" size={16} color="#888" />
              <Text style={styles.avgText}>{t('summary.average')}: {formatIQD(avgTransaction)}</Text>
            </View>
          )}

          {/* Sales by Method */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('summary.salesByMethod')}</Text>
            {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((method) => {
              const amount = summary.salesByMethod[method];
              const count = summary.transactionsByMethod[method];
              if (amount === 0) return null;
              const percentage = Math.round((amount / summary.totalSales) * 100);
              return (
                <View key={method} style={styles.methodRow}>
                  <View style={styles.methodLeft}>
                    <Ionicons name={PAYMENT_LABELS[method].icon as any} size={20} color="#1a6b3c" />
                    <Text style={styles.methodName}>{PAYMENT_LABELS[method]?.[lang] || PAYMENT_LABELS[method]?.en}</Text>
                  </View>
                  <View style={styles.methodRight}>
                    <Text style={styles.methodPct}>{percentage}%</Text>
                    <Text style={styles.methodAmount}>{formatIQD(amount)}</Text>
                    <Text style={styles.methodCount}>{count}×</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Transactions List */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('summary.recentTransactions')} ({transactions.length})</Text>
            {transactions.map((tx) => (
              <TouchableOpacity
                key={tx.id}
                style={styles.txRow}
                onPress={() => setShowDetail(tx)}
              >
                <View style={styles.txLeft}>
                  <View style={styles.txTimeRow}>
                    <Ionicons name="time-outline" size={14} color="#888" />
                    <Text style={styles.txTime}>{formatTime(tx.createdAt)}</Text>
                  </View>
                  <Text style={styles.txMethod}>
                    {PAYMENT_LABELS[tx.paymentMethod]?.[lang] || PAYMENT_LABELS[tx.paymentMethod]?.en}
                  </Text>
                </View>
                <View style={styles.txRight}>
                  <Text style={styles.txTotal}>{formatIQD(tx.total)}</Text>
                  {tx.paymentMethod === 'cash' && tx.change > 0 && (
                    <Text style={styles.txChange}>↻ {formatIQD(tx.change)}</Text>
                  )}
                  <View style={[
                    styles.txStatusDot,
                    { backgroundColor: tx.status === 'completed' ? '#1a6b3c' : '#e65100' }
                  ]} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="analytics-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>{t('summary.noData')}</Text>
        </View>
      )}

      {/* Transaction Detail Modal */}
      <Modal visible={showDetail !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {showDetail && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t('summary.transactionDetail')}</Text>
                  <TouchableOpacity onPress={() => setShowDetail(null)}>
                    <Ionicons name="close" size={24} color="#333" />
                  </TouchableOpacity>
                </View>

                <View style={styles.detailCard}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('summary.time')}</Text>
                    <Text style={styles.detailValue}>{formatTime(showDetail.createdAt)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('summary.paymentMethod')}</Text>
                    <Text style={styles.detailValue}>
                      {PAYMENT_LABELS[showDetail.paymentMethod]?.[lang] || showDetail.paymentMethod}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('summary.total')}</Text>
                    <Text style={[styles.detailValue, styles.detailTotal]}>{formatIQD(showDetail.total)}</Text>
                  </View>
                  {showDetail.paymentMethod === 'cash' && (
                    <>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>{t('payment.amountPaid')}</Text>
                        <Text style={styles.detailValue}>{formatIQD(showDetail.amountPaid)}</Text>
                      </View>
                      {showDetail.change > 0 && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>{t('payment.change')}</Text>
                          <Text style={[styles.detailValue, { color: '#e65100' }]}>{formatIQD(showDetail.change)}</Text>
                        </View>
                      )}
                    </>
                  )}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('summary.status')}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: showDetail.status === 'completed' ? '#1a6b3c' : '#e65100' }]}>
                      <Text style={styles.statusText}>
                        {showDetail.status === 'completed' ? t('summary.completed') : t('general.pendingSync')}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>{t('summary.items')}</Text>
                {showDetail.items.map((item, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={styles.itemName}>{item.product.name}</Text>
                    <Text style={styles.itemQty}>×{item.quantity}</Text>
                    <Text style={styles.itemPrice}>{formatIQD(item.subtotal)}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, backgroundColor: '#1a6b3c',
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },

  // Date navigation
  dateNav: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    marginHorizontal: 16, marginTop: 12, borderRadius: 12, paddingVertical: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2,
  },
  dateArrow: {
    paddingHorizontal: 12, paddingVertical: 12,
  },
  dateArrowDisabled: { opacity: 0.4 },
  dateCenter: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4,
  },
  dateTextCol: { flex: 1 },
  dateWeekday: { fontSize: 15, fontWeight: '700', color: '#333' },
  dateFull: { fontSize: 12, color: '#888', marginTop: 1 },
  todayBadge: {
    backgroundColor: '#1a6b3c', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  todayBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },

  // Stats
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginTop: 12 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#1a6b3c', marginTop: 6 },
  statLabel: { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'center' },

  avgRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 8, paddingHorizontal: 16,
  },
  avgText: { fontSize: 13, color: '#888' },

  // Sections
  section: { marginHorizontal: 16, marginTop: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 8 },

  // Payment methods
  methodRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 6,
  },
  methodLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  methodName: { fontSize: 14, fontWeight: '500', color: '#333' },
  methodRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  methodPct: { fontSize: 12, color: '#888', width: 32, textAlign: 'right' },
  methodAmount: { fontSize: 14, fontWeight: 'bold', color: '#1a6b3c' },
  methodCount: { fontSize: 12, color: '#888', backgroundColor: '#f0f0f0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },

  // Transactions
  txRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 6,
  },
  txLeft: { flex: 1 },
  txTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  txTime: { fontSize: 13, fontWeight: '700', color: '#333' },
  txMethod: { fontSize: 11, color: '#888', marginTop: 2 },
  txRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  txTotal: { fontSize: 14, fontWeight: 'bold', color: '#1a6b3c' },
  txChange: { fontSize: 11, color: '#e65100' },
  txStatusDot: { width: 8, height: 8, borderRadius: 4 },

  // Empty
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 16, color: '#aaa', marginTop: 12 },

  // Detail modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  detailCard: {
    backgroundColor: '#f9f9f9', borderRadius: 12, padding: 14,
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  detailLabel: { fontSize: 14, color: '#888' },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#333' },
  detailTotal: { fontSize: 18, fontWeight: 'bold', color: '#1a6b3c' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Items in detail
  itemRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    padding: 10, borderRadius: 8, marginBottom: 4,
  },
  itemName: { flex: 1, fontSize: 14, color: '#333' },
  itemQty: { fontSize: 13, color: '#888', marginHorizontal: 10 },
  itemPrice: { fontSize: 14, fontWeight: '600', color: '#1a6b3c' },
});
