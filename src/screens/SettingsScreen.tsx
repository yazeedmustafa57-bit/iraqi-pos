import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Platform, ScrollView, Modal, FlatList, ActivityIndicator,
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
import { getPendingSyncItems, updatePaymentAccounts, getPaymentAccounts } from '../database/db';
import { TextInput } from 'react-native';
import ConnectivityIndicator from '../components/ConnectivityIndicator';
import { Language } from '../types';
import Svg, { Rect, Polygon, Circle, G } from 'react-native-svg';

const KurdistanFlag = () => (
  <Svg width={30} height={20} viewBox="0 0 240 160" style={{ borderRadius: 3 }}>
    <Rect width="240" height="53.3" fill="#ED2024" />
    <Rect y="53.3" width="240" height="53.3" fill="#FFFFFF" />
    <Rect y="106.6" width="240" height="53.4" fill="#21B24B" />
    <G transform="translate(120,80)">
      <Circle cx="0" cy="0" r="18" fill="#F9DD16" />
      <Polygon points="17.8,-2.6 42.0,0.0 17.8,2.8 40.1,12.4 16.2,7.9 34.7,23.7 13.1,12.3 26.2,32.8 8.9,15.6 15.3,39.1 3.9,17.6 3.1,41.9 -1.5,17.9 -9.3,40.9 -6.7,16.7 -21.0,36.4 -11.3,14.0 -30.8,28.6 -14.9,10.1 -37.8,18.2 -17.2,5.2 -41.5,6.3 -18.0,-0.1 -41.5,-6.3 -17.2,-5.4 -37.8,-18.2 -14.8,-10.2 -30.8,-28.6 -11.1,-14.1 -21.0,-36.4 -6.5,-16.8 -9.3,-40.9 -1.2,-18.0 3.1,-41.9 4.1,-17.5 15.3,-39.1 9.1,-15.5 26.2,-32.8 13.3,-12.2 34.7,-23.7 16.3,-7.7 40.1,-12.4" fill="#F9DD16" />
    </G>
  </Svg>
);

const LANGUAGES: { key: Language; label: string; flag: string | 'ku_flag' }[] = [
  { key: 'ar', label: 'العربية', flag: '🇮🇶' },
  { key: 'ku', label: 'کوردی (سۆرانی)', flag: 'ku_flag' as any },
  { key: 'en', label: 'English', flag: '🇬🇧' },
  { key: 'de', label: 'Deutsch', flag: '🇩🇪' },
];


const _isWeb = Platform.OS === 'web';
function showAlert(title: string, msg: string) {
  if (_isWeb) window.alert(title + ': ' + msg);
  else Alert.alert(title, msg);
}

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

  // Payment accounts state
  const [paymentAccounts, setPaymentAccountsState] = useState({ fib: '' });
  const [savingAccounts, setSavingAccounts] = useState(false);

  const loadPaymentAccounts = async () => {
    if (!currentUser) return;
    const accounts = await getPaymentAccounts(currentUser.id);
    if (accounts) setPaymentAccountsState(accounts);
  };

  const handleSaveAccounts = async () => {
    if (!currentUser) return;
    setSavingAccounts(true);
    try {
      await updatePaymentAccounts(currentUser.id, paymentAccounts);
      // Also update currentUser in store
      setCurrentUser({ ...currentUser, paymentAccounts });
      showAlert('✅', t('payment.accountsSaved'));
    } catch (e: any) {
      showAlert(t('general.error'), String(e?.message || e));
    } finally {
      setSavingAccounts(false);
    }
  };

  const checkPendingSync = async () => {
    const items = await getPendingSyncItems();
    setPendingCount(items.length);
  };

  React.useEffect(() => {
    checkPendingSync();
    loadPaymentAccounts();
    if (isConnected()) {
      setConnectedName(getConnectedPrinterName());
      setPrinterConnected(true);
    }
  }, []);

  const handleLanguageChange = (lang: Language) => {
    if (lang === language) return;
    setAppLanguage(lang);
    setI18nLanguage(lang);
    showAlert(t('general.languageChanged'), t('general.restartRequired'));
  };

  const handleLogout = () => {
    showAlert(t('settings.logout'), t('settings.logoutConfirm'));
  };

  const handleTestPrint = async () => {
    if (!isConnected()) {
      showAlert(t('general.error'), t('settings.printerNotConnected'));
      return;
    }
    try {
      await printTestPage();
      showAlert('✅', t('settings.testPageSent'));
    } catch (error: any) {
      showAlert(t('general.error'), String(error?.message || error));
    }
  };

  const handleStartScan = async () => {
    // On web, skip native Bluetooth permission check
    if (Platform.OS === 'web') {
      showAlert('Info', 'Bluetooth-Drucker ist nur in der Native-App verfügbar.');
      return;
    }
    const hasPerm = await requestBluetoothPermission();
    if (!hasPerm) {
      showAlert(t('general.error'), t('settings.bluetoothPermissionRequired'));
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
      showAlert(t('general.error'), String(err?.message || err));
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
      showAlert('✅', `${t('settings.printerConnected')}: ${device.name}`);
    } catch (err: any) {
      showAlert(t('general.error'), String(err?.message || ''));
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
      showAlert('✅', t('settings.printerDisconnectedOk'));
    } catch {}
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('settings.title')}</Text>
        <ConnectivityIndicator />
      </View>

      {/* Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <Ionicons name={isOnline ? 'wifi' : 'wifi'} size={20} color={isOnline ? '#1a6b3c' : '#e53935'} />
          <Text style={styles.statusText}>{isOnline ? t('general.online') : t('general.offline')}</Text>
        </View>
        {pendingCount > 0 && (
          <View style={styles.statusRow}>
            <Ionicons name="sync" size={16} color="#e65100" />
            <Text style={[styles.statusText, { color: '#e65100' }]}>{pendingCount} {t('general.pendingSync')}</Text>
          </View>
        )}
      </View>

      {/* Language */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
        {LANGUAGES.map((l) => (
          <TouchableOpacity
            key={l.key}
            style={[styles.optionRow, language === l.key && styles.optionRowActive]}
            onPress={() => handleLanguageChange(l.key)}
          >
            {l.key === 'ku' ? <KurdistanFlag /> : <Text style={styles.flagText}>{l.flag}</Text>}
            <Text style={[styles.optionText, language === l.key && styles.optionTextActive]}>{l.label}</Text>
            {language === l.key && <Ionicons name="checkmark-circle" size={22} color="#1a6b3c" />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Bluetooth Printer */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.printer')}</Text>
        <TouchableOpacity style={styles.optionRow} onPress={handleStartScan}>
          <Ionicons name="bluetooth" size={22} color="#1a6b3c" />
          <Text style={styles.optionText}>{t('settings.printerConnect')}</Text>
          <Ionicons name="scan-outline" size={20} color="#1a6b3c" />
        </TouchableOpacity>

        {printerConnected && (
          <>
            <View style={styles.optionRow}>
              <Ionicons name="print" size={22} color="#1a6b3c" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionText, { color: '#1a6b3c', fontWeight: '700' }]}>{t('settings.printerConnected')}</Text>
                {connectedName && <Text style={{ fontSize: 12, color: '#888' }}>{connectedName}</Text>}
              </View>
              <View style={[styles.statusDot, { backgroundColor: '#1a6b3c' }]} />
            </View>
            <TouchableOpacity style={styles.optionRow} onPress={handleTestPrint}>
              <Ionicons name="document-text-outline" size={22} color="#1a6b3c" />
              <Text style={styles.optionText}>{t('settings.testPrint')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionRow} onPress={handleDisconnect}>
              <Ionicons name="close-circle-outline" size={22} color="#e53935" />
              <Text style={[styles.optionText, { color: '#e53935' }]}>{t('settings.printerDisconnect')}</Text>
            </TouchableOpacity>
          </>
        )}

        {!printerConnected && (
          <View style={styles.optionRow}>
            <Ionicons name="print-outline" size={22} color="#888" />
            <Text style={[styles.optionText, { color: '#888' }]}>{t('settings.printerDisconnected')}</Text>
            <View style={[styles.statusDot, { backgroundColor: '#888' }]} />
          </View>
        )}
      </View>

      {/* Shop Info */}
      {currentUser && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.shopInfo')}</Text>
          <View style={styles.optionRow}>
            <Ionicons name="storefront-outline" size={22} color="#1a6b3c" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionText, { fontWeight: '700' }]}>{currentUser.shopName}</Text>
              <Text style={{ fontSize: 12, color: '#888' }}>{currentUser.ownerName} - {currentUser.phone}</Text>
            </View>
          </View>
        </View>
      )}


      {/* Payment Accounts */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('payment.accountsTitle')}</Text>
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>🏦 FIB {t('payment.phoneNumber')}</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14 }}
              placeholder={t('payment.phonePlaceholder')}
              value={paymentAccounts.fib}
              onChangeText={(v: string) => setPaymentAccountsState(p => ({ ...p, fib: v }))}
              keyboardType="phone-pad"
            />
          </View>
          <TouchableOpacity
            style={{ backgroundColor: '#1a6b3c', borderRadius: 10, padding: 14, alignItems: 'center' }}
            onPress={handleSaveAccounts}
            disabled={savingAccounts}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>
              {savingAccounts ? '...' : t('general.save')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Logout */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.optionRow} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#e53935" />
          <Text style={[styles.optionText, { color: '#e53935' }]}>{t('settings.logout')}</Text>
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
            <Text style={styles.modalTitle}>{t('settings.scanning')}</Text>
            <Text style={{ fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 16 }}>
              {t('settings.scanningHint')}
            </Text>

            {scanning && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
                <ActivityIndicator size="small" color="#1a6b3c" />
                <Text style={{ color: '#1a6b3c' }}>{t('general.searching')}</Text>
              </View>
            )}

            {!scanning && foundDevices.length === 0 && (
              <Text style={{ textAlign: 'center', color: '#888', padding: 20 }}>
                {t('general.noPrinters')}
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
              <Text style={styles.closeBtnText}>{t('settings.close')}</Text>
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
