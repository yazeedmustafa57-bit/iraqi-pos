import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../stores/appStore';
import { setLanguage as setI18nLanguage } from '../i18n';
import { translations } from '../i18n/translations';
import {
  scanForPrinters, connectToPrinter, disconnectPrinter,
  isConnected, getConnectedPrinterName, printTestPage,
  PrinterDevice, requestBluetoothPermission,
} from '../services/bluetoothPrinter';
import { getPendingSyncItems } from '../database/db';
import ConnectivityIndicator from '../components/ConnectivityIndicator';
import { Language } from '../types';

const LANGUAGES: { key: Language; label: string; flag: string }[] = [
  { key: 'ar', label: 'العربية', flag: '🇮🇶' },
  { key: 'ku', label: 'کوردی (سۆرانی)', flag: '🇸🇩' },
  { key: 'en', label: 'English', flag: '🇬🇧' },
];

export default function SettingsScreen() {
  const { language, setLanguage: setAppLanguage, printerConnected, setPrinterConnected, setPrinterDeviceId, currentUser, setIsAuthenticated, setCurrentUser } = useAppStore();
  const isOnline = useAppStore((s) => s.isOnline);
  const t = useCallback((key: string) => translations[language]?.[key] ?? key, [language]);
  const [pendingCount, setPendingCount] = useState(0);

  // Bluetooth printer state
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [foundDevices, setFoundDevices] = useState<PrinterDevice[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectedName, setConnectedName] = useState<string | null>(null);

  const checkPendingSync = async () => {
    const items = await getPendingSyncItems();
    setPendingCount(items.length);
  };

  React.useEffect(() => {
    checkPendingSync();
    // Check if already connected
    if (isConnected()) {
      setConnectedName(getConnectedPrinterName());
      setPrinterConnected(true);
    }
  }, []);

  const handleLanguageChange = (lang: Language) => {
    if (lang === language) return;
    setAppLanguage(lang);
    setI18nLanguage(lang);
    Alert.alert(
      'تم تغيير اللغة',
      'يجب إعادة تشغيل التطبيق لتطبيق التغييرات بالكامل\nLanguage changed. Please restart the app for full effect.',
      [{ text: 'OK' }]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'تسجيل الخروج',
      'هل تريد تسجيل الخروج؟',
      [
        { text: t('general.cancel'), style: 'cancel' },
        {
          text: 'خروج',
          style: 'destructive',
          onPress: () => {
            setCurrentUser(null);
            setIsAuthenticated(false);
          },
        },
      ]
    );
  };

  const handleTestPrint = async () => {
    if (!isConnected()) {
      Alert.alert(t('general.error'), 'الطابعة غير متصلة / Printer not connected');
      return;
    }
    try {
      await printTestPage();
      Alert.alert('✅', 'تم إرسال صفحة الاختبار / Test page sent');
    } catch (error: any) {
      Alert.alert(t('general.error'), String(error?.message || error));
    }
  };

  const handleStartScan = async () => {
    const hasPerm = await requestBluetoothPermission();
    if (!hasPerm) {
      Alert.alert('خطأ', 'يرجى تفعيل صلاحيات البلوتوث / Please grant Bluetooth permissions');
      return;
    }

    setShowScanModal(true);
    setFoundDevices([]);
    setScanning(true);

    try {
      await scanForPrinters(
        (device) => {
          setFoundDevices((prev) => {
            if (prev.find((d) => d.id === device.id)) return prev;
            return [...prev, device].sort((a, b) => (b.rssi || 0) - (a.rssi || 0));
          });
        },
        10000
      );
    } catch (err: any) {
      Alert.alert('خطأ', String(err?.message || err));
    } finally {
      setScanning(false);
    }
  };

  const handleConnectDevice = async (device: PrinterDevice) => {
    setConnecting(device.id);
    try {
      await connectToPrinter(device.id, device.name);
      setConnectedName(device.name);
      setPrinterConnected(true);
      setPrinterDeviceId(device.id);
      setShowScanModal(false);
      Alert.alert('✅', `تم توصيل الطابعة: ${device.name}`);
    } catch (err: any) {
      Alert.alert('خطأ الاتصال', String(err?.message || 'تعذر الاتصال بالطابعة'));
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectPrinter();
      setConnectedName(null);
      setPrinterConnected(false);
      setPrinterDeviceId(null);
      Alert.alert('تم', 'تم فصل الطابعة / Printer disconnected');
    } catch {}
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('settings.title')}</Text>
        <ConnectivityIndicator />
      </View>

      {/* Status */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          {isOnline ? (
            <Ionicons name="wifi" size={20} color="#1a6b3c" />
          ) : (
            <Ionicons name="close-circle" size={20} color="#e65100" />
          )}
          <Text style={styles.statusText}>
            {isOnline ? t('general.online') : t('general.offline')}
          </Text>
        </View>
        {pendingCount > 0 && (
          <View style={styles.statusRow}>
            <Ionicons name="sync" size={20} color="#e65100" />
            <Text style={[styles.statusText, { color: '#e65100' }]}>
              {pendingCount} {t('general.pendingSync')}
            </Text>
          </View>
        )}
      </View>

      {/* Language */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
        {LANGUAGES.map(({ key, label, flag }) => (
          <TouchableOpacity
            key={key}
            style={[styles.optionRow, language === key && styles.optionRowActive]}
            onPress={() => handleLanguageChange(key)}
          >
            <Text style={styles.flagText}>{flag}</Text>
            <Text style={[styles.optionText, language === key && styles.optionTextActive]}>
              {label}
            </Text>
            {language === key && (
              <Ionicons name="checkmark-circle" size={22} color="#1a6b3c" />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Printer */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.printer')}</Text>

        {connectedName ? (
          <>
            <View style={[styles.optionRow, { borderColor: '#1a6b3c', borderWidth: 2 }]}>
              <Ionicons name="bluetooth" size={20} color="#1a6b3c" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionText, { color: '#1a6b3c', fontWeight: '700' }]}>
                  {connectedName}
                </Text>
                <Text style={{ fontSize: 11, color: '#1a6b3c', marginTop: 2 }}>متصل ✓</Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: '#1a6b3c' }]} />
            </View>

            <TouchableOpacity style={styles.optionRow} onPress={handleTestPrint}>
              <Ionicons name="print-outline" size={20} color="#1a6b3c" />
              <Text style={styles.optionText}>{t('settings.testPrint')}</Text>
              <Ionicons name="chevron-forward" size={18} color="#888" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionRow} onPress={handleDisconnect}>
              <Ionicons name="close-circle-outline" size={20} color="#e53935" />
              <Text style={[styles.optionText, { color: '#e53935' }]}>فصل الطابعة</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.optionRow} onPress={handleStartScan}>
            <Ionicons name="bluetooth-outline" size={20} color="#1a6b3c" />
            <Text style={styles.optionText}>بحث عن طابعة بلوتوث...</Text>
            <Ionicons name="search" size={18} color="#888" />
          </TouchableOpacity>
        )}
      </View>

      {/* Logout */}
      <View style={styles.section}>
        <TouchableOpacity style={[styles.optionRow, { borderColor: '#e53935', borderWidth: 1.5 }]} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#e53935" />
          <Text style={[styles.optionText, { color: '#e53935' }]}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </View>

      {/* About */}
      <View style={styles.section}>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>كاشير - POS</Text>
          <Text style={styles.aboutSubtitle}>Iraqi Point of Sale</Text>
          <Text style={styles.aboutVersion}>v1.0.0</Text>
        </View>
      </View>

      {/* Bluetooth Scan Modal */}
      <Modal visible={showScanModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>بحث عن طابعات</Text>
            <Text style={{ fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 16 }}>
              قم بتوصيل الطابعة أولاً من إعدادات البلوتوث
            </Text>

            {scanning && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
                <ActivityIndicator size="small" color="#1a6b3c" />
                <Text style={{ color: '#1a6b3c' }}>جاري البحث...</Text>
              </View>
            )}

            {!scanning && foundDevices.length === 0 && (
              <Text style={{ textAlign: 'center', color: '#888', padding: 20 }}>
                لم يتم العثور على طابعات. تأكد من تفعيل البلوتوث
              </Text>
            )}

            <FlatList
              data={foundDevices}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.deviceRow}
                  onPress={() => handleConnectDevice(item)}
                  disabled={connecting !== null}
                >
                  <Ionicons name="print-outline" size={24} color="#1a6b3c" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#333' }}>{item.name}</Text>
                    <Text style={{ fontSize: 11, color: '#888' }}>RSSI: {item.rssi}</Text>
                  </View>
                  {connecting === item.id ? (
                    <ActivityIndicator size="small" color="#1a6b3c" />
                  ) : (
                    <Ionicons name="link-outline" size={20} color="#1a6b3c" />
                  )}
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => { setShowScanModal(false); }}
            >
              <Text style={styles.closeBtnText}>إغلاق</Text>
            </TouchableOpacity>
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
  statusCard: {
    backgroundColor: '#fff', margin: 16, borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  statusText: { fontSize: 14, fontWeight: '500', color: '#333' },
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 8 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    padding: 14, borderRadius: 10, marginBottom: 6, gap: 10,
  },
  optionRowActive: { borderWidth: 2, borderColor: '#1a6b3c' },
  flagText: { fontSize: 22 },
  optionText: { flex: 1, fontSize: 15, color: '#333', fontWeight: '500' },
  optionTextActive: { color: '#1a6b3c', fontWeight: '700' },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  aboutCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, alignItems: 'center' },
  aboutTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a6b3c' },
  aboutSubtitle: { fontSize: 14, color: '#888', marginTop: 4 },
  aboutVersion: { fontSize: 12, color: '#aaa', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 4 },
  deviceRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9',
    padding: 12, borderRadius: 10, marginBottom: 6,
  },
  closeBtn: { padding: 14, borderRadius: 12, backgroundColor: '#f0f0f0', alignItems: 'center', marginTop: 12 },
  closeBtnText: { fontSize: 16, fontWeight: '600', color: '#666' },
});
