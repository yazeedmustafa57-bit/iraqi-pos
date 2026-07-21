import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTodayTransactions } from '../database/db';
import { calculateDailySummary } from '../stores/appStore';
import { useAppStore } from '../stores/appStore';
import { translations } from '../i18n/translations';
import { formatIQD } from '../i18n';
import { DailySummary, PaymentMethod, Transaction } from '../types';
import ConnectivityIndicator from '../components/ConnectivityIndicator';

const PAYMENT_LABELS: Record<PaymentMethod, { ar: string; icon: string }> = {
  cash: { ar: 'نقدي', icon: 'cash-outline' },
  zaincash: { ar: 'ZainCash', icon: 'phone-portrait-outline' },
  asia_hawala: { ar: 'آسيا هавالة', icon: 'wallet-outline' },
  fastpay: { ar: 'FastPay', icon: 'flash-outline' },
  credit_card: { ar: 'بطاقة ائتمان', icon: 'card-outline' },
  fib: { ar: 'فيب FIB', icon: 'business-outline' },
};

export default function SummaryScreen() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const lang = useAppStore((s) => s.language);
  const t = useCallback((key: string) => translations[lang]?.[key] ?? key, [lang]);

  const loadData = async () => {
    const txList = await getTodayTransactions();
    setTransactions(txList);
    setSummary(calculateDailySummary(txList));
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString(
    lang === 'ar' ? 'ar-IQ' : lang === 'ku' ? 'ar-IQ' : 'en-US',
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t('summary.title')}</Text>
        <ConnectivityIndicator />
      </View>

      {/* Date */}
      <View style={styles.dateCard}>
        <Ionicons name="calendar" size={20} color="#1a6b3c" />
        <Text style={styles.dateText}>{dateStr}</Text>
      </View>

      {summary && summary.totalTransactions > 0 ? (
        <>
          {/* Stats Cards */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="trending-up" size={28} color="#1a6b3c" />
              <Text style={styles.statValue}>{formatIQD(summary.totalSales)}</Text>
              <Text style={styles.statLabel}>{t('summary.totalSales')}</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="receipt" size={28} color="#1a6b3c" />
              <Text style={styles.statValue}>{summary.totalTransactions}</Text>
              <Text style={styles.statLabel}>{t('summary.totalTransactions')}</Text>
            </View>
          </View>

          {/* Sales by Method */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('summary.salesByMethod')}</Text>
            {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((method) => {
              const amount = summary.salesByMethod[method];
              const count = summary.transactionsByMethod[method];
              if (amount === 0) return null;
              return (
                <View key={method} style={styles.methodRow}>
                  <View style={styles.methodLeft}>
                    <Ionicons
                      name={PAYMENT_LABELS[method].icon as any}
                      size={20}
                      color="#1a6b3c"
                    />
                    <Text style={styles.methodName}>{PAYMENT_LABELS[method].ar}</Text>
                  </View>
                  <View style={styles.methodRight}>
                    <Text style={styles.methodAmount}>{formatIQD(amount)}</Text>
                    <Text style={styles.methodCount}>{count}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Recent Transactions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>آخر المعاملات</Text>
            {transactions.slice(0, 10).map((tx) => (
              <View key={tx.id} style={styles.txRow}>
                <View style={styles.txLeft}>
                  <Text style={styles.txId}>#{tx.id.slice(0, 8)}</Text>
                  <Text style={styles.txMethod}>{PAYMENT_LABELS[tx.paymentMethod]?.ar}</Text>
                </View>
                <View style={styles.txRight}>
                  <Text style={styles.txTotal}>{formatIQD(tx.total)}</Text>
                  <View style={[
                    styles.txStatusDot,
                    { backgroundColor: tx.status === 'completed' ? '#1a6b3c' : '#e65100' }
                  ]} />
                </View>
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="analytics-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>{t('summary.noData')}</Text>
        </View>
      )}
    </ScrollView>
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
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a6b3c',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  methodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  methodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  methodName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  methodRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  methodAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a6b3c',
  },
  methodCount: {
    fontSize: 12,
    color: '#888',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  txLeft: {
    flex: 1,
  },
  txId: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  txMethod: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  txRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  txTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a6b3c',
  },
  txStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#aaa',
    marginTop: 12,
  },
});
