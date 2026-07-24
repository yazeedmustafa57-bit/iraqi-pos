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
import { getPendingSyncItems, updatePaymentAccounts, getPaymentAccounts, getUserByPhone } from '../database/db';
import { verifyPINForDeletion, deleteAllShopData, getDeletableDataSummary } from '../services/accountDeletion';
import { TextInput } from 'react-native';
import ConnectivityIndicator from '../components/ConnectivityIndicator';
import { Language } from '../types';
import { testFIBConnection } from '../services/fibApi';
import { FIBConfig, loadFIBConfig, saveFIBConfig } from '../stores/appStore';

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

  // FIB Config state
  const fibConfig = useAppStore((s) => s.fibConfig);
  const setFIBConfig = useAppStore((s) => s.setFIBConfig);
  const [fibForm, setFibForm] = useState<FIBConfig>(fibConfig);
  const [savingFIB, setSavingFIB] = useState(false);
  const [fibTestStatus, setFibTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'warning' | 'pin' | 'confirm' | 'done'>('warning');
  const [deletePin, setDeletePin] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteSummary, setDeleteSummary] = useState({ products: 0, transactions: 0, pendingSync: 0 });
  const [deleting, setDeleting] = useState(false);

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

  // Load FIB config when user logs in
  React.useEffect(() => {
    if (currentUser) {
      const config = loadFIBConfig(currentUser.id);
      setFibForm(config);
    }
  }, [currentUser?.id]);

  const handleSaveFIB = async () => {
    if (!currentUser) return;
    setSavingFIB(true);
    try {
      saveFIBConfig(currentUser.id, fibForm);
      setFIBConfig(fibForm);
      showAlert('✅', t('payment.fibSaved'));
    } catch (e: any) {
      showAlert(t('general.error'), String(e?.message || e));
    } finally {
      setSavingFIB(false);
    }
  };

  const handleTestFIB = async () => {
    setFibTestStatus('testing');
    try {
      const result = await testFIBConnection(fibForm, currentUser?.id || 'unknown');
      if (result.success) {
        setFibTestStatus('success');
        if (result.merchantInfo) {
          showAlert('✅', `${result.merchantInfo.merchantName}\n${t('payment.fibStatusSuccess')}`);
        }
      } else {
        setFibTestStatus('error');
        showAlert('❌', result.message);
      }
    } catch (e: any) {
      setFibTestStatus('error');
      showAlert('❌', e.message || 'Connection failed');
    }
  };

  const handleDeleteAccount = () => {
    if (!currentUser) return;
    const summary = getDeletableDataSummary(currentUser.id);
    setDeleteSummary(summary);
    setDeleteStep('warning');
    setDeletePin('');
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };

  const handleDeleteVerifyPin = async () => {
    if (!currentUser || !deletePin) return;
    try {
      const user = await getUserByPhone(currentUser.phone);
      if (user) {
        const valid = await verifyPINForDeletion(currentUser.phone, deletePin, user.pin);
        if (valid) {
          setDeleteStep('confirm');
        } else {
          showAlert(t('general.error'), t('auth.wrongCredentials'));
        }
      }
    } catch (e: any) {
      showAlert(t('general.error'), String(e?.message || e));
    }
  };

  const handleDeleteConfirm = async () => {
    if (!currentUser || deleteConfirmText !== 'LÖSCHEN' && deleteConfirmText !== 'DELETE' && deleteConfirmText !== 'سڕینەوە' && deleteConfirmText !== 'حذف') return;
    setDeleting(true);
    try {
      const result = await deleteAllShopData(currentUser.id, currentUser.phone);
      if (result.success) {
        setDeleteStep('done');
        setTimeout(() => {
          setCurrentUser(null);
          setIsAuthenticated(false);
        }, 2000);
      } else {
        showAlert(t('general.error'), result.error || 'Deletion failed');
      }
    } catch (e: any) {
      showAlert(t('general.error'), String(e?.message || e));
    } finally {
      setDeleting(false);
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
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(t('settings.logout') + ': ' + t('settings.logoutConfirm'));
      if (confirmed) {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    } else {
      Alert.alert(t('settings.logout'), t('settings.logoutConfirm'), [
        { text: t('general.cancel'), style: 'cancel' },
        { text: t('settings.logoutBtn'), style: 'destructive', onPress: () => {
          setCurrentUser(null);
          setIsAuthenticated(false);
        }},
      ]);
    }
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


      {/* FIB Configuration */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('payment.fibConfigTitle')}</Text>
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
          {/* Enable/Disable Toggle */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#333' }}>🏦 FIB {t('payment.fibEnable')}</Text>
              <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{t('payment.fibEnableDesc')}</Text>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: fibForm.enabled ? '#1a6b3c' : '#ddd', borderRadius: 20, width: 50, height: 28, justifyContent: 'center', alignItems: 'center' }}
              onPress={() => setFibForm(p => ({ ...p, enabled: !p.enabled }))}
            >
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', marginLeft: fibForm.enabled ? 12 : -12 }} />
            </TouchableOpacity>
          </View>

          {fibForm.enabled && (
            <>
              {/* Sandbox Mode */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, backgroundColor: '#fff3e0', borderRadius: 8, padding: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#e65100' }}>⚠️ {t('payment.fibSandbox')}</Text>
                  <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{t('payment.fibSandboxDesc')}</Text>
                </View>
                <TouchableOpacity
                  style={{ backgroundColor: fibForm.sandboxMode ? '#FF9800' : '#ddd', borderRadius: 20, width: 44, height: 24, justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => setFibForm(p => ({ ...p, sandboxMode: !p.sandboxMode }))}
                >
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', marginLeft: fibForm.sandboxMode ? 10 : -10 }} />
                </TouchableOpacity>
              </View>

              {/* Base URL */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>{t('payment.fibBaseUrl')}</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14 }}
                  placeholder={fibForm.sandboxMode ? 'https://sandbox.fib.iq/api' : 'https://api.fib.iq/api'}
                  value={fibForm.baseUrl}
                  onChangeText={(v: string) => setFibForm(p => ({ ...p, baseUrl: v }))}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Merchant ID */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>{t('payment.fibMerchantId')}</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14 }}
                  placeholder="z.B. MERCHANT-12345"
                  value={fibForm.merchantId}
                  onChangeText={(v: string) => setFibForm(p => ({ ...p, merchantId: v }))}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>

              {/* API Key */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>{t('payment.fibApiKey')}</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14 }}
                  placeholder={t('payment.fibApiKeyPlaceholder')}
                  value={fibForm.apiKey}
                  onChangeText={(v: string) => setFibForm(p => ({ ...p, apiKey: v }))}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
              </View>

              {/* Secret Key */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>{t('payment.fibSecretKey')}</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14 }}
                  placeholder={t('payment.fibSecretKeyPlaceholder')}
                  value={fibForm.secretKey}
                  onChangeText={(v: string) => setFibForm(p => ({ ...p, secretKey: v }))}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
              </View>

              {/* Webhook URL */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>{t('payment.fibWebhookUrl')}</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14 }}
                  placeholder="https://deine-app.de/api/fib-callback"
                  value={fibForm.webhookUrl}
                  onChangeText={(v: string) => setFibForm(p => ({ ...p, webhookUrl: v }))}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Connection Status */}
              <View style={{ backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: fibTestStatus === 'success' ? '#4CAF50' : fibTestStatus === 'error' ? '#e53935' : fibTestStatus === 'testing' ? '#FF9800' : '#ccc' }} />
                  <Text style={{ fontSize: 13, color: '#555' }}>
                    {fibTestStatus === 'idle' && t('payment.fibStatusIdle')}
                    {fibTestStatus === 'testing' && t('payment.fibStatusTesting')}
                    {fibTestStatus === 'success' && t('payment.fibStatusSuccess')}
                    {fibTestStatus === 'error' && t('payment.fibStatusError')}
                  </Text>
                </View>
              </View>

              {/* Test Connection Button */}
              <TouchableOpacity
                style={{ backgroundColor: '#1565C0', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 12 }}
                onPress={handleTestFIB}
                disabled={fibTestStatus === 'testing'}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>
                  {fibTestStatus === 'testing' ? '...' : t('payment.fibTestConnection')}
                </Text>
              </TouchableOpacity>

              {/* Save Button */}
              <TouchableOpacity
                style={{ backgroundColor: '#1a6b3c', borderRadius: 10, padding: 14, alignItems: 'center' }}
                onPress={handleSaveFIB}
                disabled={savingFIB}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>
                  {savingFIB ? '...' : t('general.save')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

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

      {/* Privacy Policy */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => (navigation as any).getParent()?.navigate('Privacy')}
        >
          <Ionicons name="shield-checkmark-outline" size={22} color="#1565C0" />
          <Text style={styles.optionText}>{t('settings.privacy')}</Text>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.optionRow} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#e53935" />
          <Text style={[styles.optionText, { color: '#e53935' }]}>{t('settings.logout')}</Text>
        </TouchableOpacity>
      </View>

      {/* Delete Account */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.optionRow, { backgroundColor: '#fff0f0' }]}
          onPress={handleDeleteAccount}
        >
          <Ionicons name="trash-outline" size={22} color="#e53935" />
          <Text style={[styles.optionText, { color: '#e53935', fontWeight: '600' }]}>{t('settings.deleteAccount')}</Text>
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

      {/* Delete Account Modal */}
      <Modal visible={showDeleteModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, maxHeight: '80%' }}>
            {deleteStep === 'warning' && (
              <>
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  <Ionicons name="warning" size={48} color="#e53935" />
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#e53935', marginTop: 8 }}>{t('settings.deleteAccountWarning')}</Text>
                </View>
                <Text style={{ fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 12 }}>{t('settings.deleteAccountDesc')}</Text>
                <View style={{ backgroundColor: '#fff3e0', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <Text style={{ fontSize: 13, color: '#e65100', fontWeight: '600' }}>{t('settings.deleteAccountWillDelete')}:</Text>
                  <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>• {t('settings.deleteShopData')} ({deleteSummary.products})</Text>
                  <Text style={{ fontSize: 12, color: '#666' }}>• {t('settings.deleteTransactions')} ({deleteSummary.transactions})</Text>
                  <Text style={{ fontSize: 12, color: '#666' }}>• {t('settings.deleteFibConfig')}</Text>
                  <Text style={{ fontSize: 12, color: '#666' }}>• {t('settings.deleteAccountSettings')}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={{ flex: 1, padding: 14, backgroundColor: '#f0f0f0', borderRadius: 10, alignItems: 'center' }} onPress={() => setShowDeleteModal(false)}>
                    <Text style={{ color: '#666', fontWeight: '600' }}>{t('general.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flex: 1, padding: 14, backgroundColor: '#e53935', borderRadius: 10, alignItems: 'center' }} onPress={() => setDeleteStep('pin')}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>{t('settings.deleteAccountContinue')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            {deleteStep === 'pin' && (
              <>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 12 }}>{t('settings.deleteAccountVerifyPin')}</Text>
                <Text style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 16 }}>{t('settings.deleteAccountPinDesc')}</Text>
                <TextInput style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 18, textAlign: 'center', letterSpacing: 8 }} placeholder="••••" value={deletePin} onChangeText={setDeletePin} keyboardType="numeric" secureTextEntry maxLength={6} />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                  <TouchableOpacity style={{ flex: 1, padding: 14, backgroundColor: '#f0f0f0', borderRadius: 10, alignItems: 'center' }} onPress={() => setDeleteStep('warning')}>
                    <Text style={{ color: '#666', fontWeight: '600' }}>{t('general.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flex: 1, padding: 14, backgroundColor: '#e53935', borderRadius: 10, alignItems: 'center' }} onPress={handleDeleteVerifyPin} disabled={!deletePin}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>{t('settings.deleteAccountContinue')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            {deleteStep === 'confirm' && (
              <>
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  <Ionicons name="alert-circle" size={48} color="#e53935" />
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#e53935', marginTop: 8 }}>{t('settings.deleteAccountFinalConfirm')}</Text>
                </View>
                <Text style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 12 }}>{t('settings.deleteAccountTypeDelete')}</Text>
                <TextInput style={{ borderWidth: 1, borderColor: '#e53935', borderRadius: 8, padding: 12, fontSize: 16, textAlign: 'center' }} placeholder="LÖSCHEN / DELETE" value={deleteConfirmText} onChangeText={setDeleteConfirmText} autoCapitalize="characters" />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                  <TouchableOpacity style={{ flex: 1, padding: 14, backgroundColor: '#f0f0f0', borderRadius: 10, alignItems: 'center' }} onPress={() => setDeleteStep('pin')}>
                    <Text style={{ color: '#666', fontWeight: '600' }}>{t('general.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flex: 1, padding: 14, backgroundColor: '#e53935', borderRadius: 10, alignItems: 'center' }} onPress={handleDeleteConfirm} disabled={deleting || (deleteConfirmText !== 'LÖSCHEN' && deleteConfirmText !== 'DELETE' && deleteConfirmText !== 'سڕینەوە' && deleteConfirmText !== 'حذف')}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>{deleting ? '...' : t('settings.deleteAccountFinal')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            {deleteStep === 'done' && (
              <View style={{ alignItems: 'center', padding: 20 }}>
                <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#4CAF50', marginTop: 8 }}>{t('settings.deleteAccountDone')}</Text>
                <Text style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{t('settings.deleteAccountRedirecting')}</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

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
