import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Keyboard, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { getProductByBarcode } from '../database/db';
import { useCartStore } from '../stores/cartStore';
import { useAppStore } from '../stores/appStore';
import { translations } from '../i18n/translations';
import { formatIQD } from '../i18n';
import { Product } from '../types';
import { playScanBeep } from '../services/scannerSound';


export default function BarcodeScannerScreen() {

  const [manualBarcode, setManualBarcode] = useState('');
  const [lastScanned, setLastScanned] = useState<Product | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [flashAnim] = useState(new Animated.Value(0));
  const addItem = useCartStore((s) => s.addItem);
  const items = useCartStore((s) => s.items);
  const getTotal = useCartStore((s) => s.getTotal);
  const navigation = useNavigation<any>();
  const lang = useAppStore((s) => s.language);
  const t = useCallback((key: string) => translations[lang]?.[key] ?? key, [lang]);

  const [permission, requestPermission] = useCameraPermissions();
  const barcodeRef = useRef('');
  const lastScanTime = useRef(0);
  const inputRef = useRef(manualBarcode);
  inputRef.current = manualBarcode;

  const triggerFlash = useCallback(() => {
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 40, useNativeDriver: false }),
      Animated.timing(flashAnim, { toValue: 0, duration: 150, useNativeDriver: false }),
    ]).start();
    playScanBeep();
  }, [flashAnim]);

  const handleBarcodeScan = useCallback(async (code: string) => {
    const now = Date.now();
    if (now - lastScanTime.current < 1500) return;
    lastScanTime.current = now;

    setIsProcessing(true);
    try {
      const product = await getProductByBarcode(code);
      if (product) {
        triggerFlash();
        addItem(product);
        setLastScanned(product);
        setTimeout(() => setLastScanned(null), 3000);
      }
    } catch {
    } finally {
      setIsProcessing(false);
    }
  }, [addItem, triggerFlash]);

  useEffect(() => {
    const keyboardDidHide = Keyboard.addListener('keyboardDidHide', () => {
      const val = inputRef.current.trim();
      if (val) {
        handleBarcodeScan(val);
        setManualBarcode('');
      }
    });
    return () => keyboardDidHide.remove();
  }, [handleBarcodeScan]);

  const handleBarCodeScanned = useCallback(({ data }: { data: string }) => {
    if (data !== barcodeRef.current || Date.now() - lastScanTime.current > 1500) {
      barcodeRef.current = data;
      handleBarcodeScan(data);
    }
  }, [handleBarcodeScan]);

  const handleManualSubmit = useCallback(() => {
    if (manualBarcode.trim()) {
      Keyboard.dismiss();
      handleBarcodeScan(manualBarcode.trim());
      setManualBarcode('');
    }
  }, [manualBarcode, handleBarcodeScan]);

  const total = getTotal();
  const itemCount = items.reduce((sum: number, i: any) => sum + i.quantity, 0);
  const flashOpacity = flashAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] });

  if (!permission) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
          <Text style={styles.title}>{t('barcode.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.noPermission}><Text style={styles.loadingText}>...</Text></View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
          <Text style={styles.title}>{t('barcode.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.noPermission}>
          <Ionicons name="camera-outline" size={48} color="#888" />
          <Text style={styles.noPermissionText}>{t('barcode.scanHint')}</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>{t("barcode.grantPermission")}</Text>
          </TouchableOpacity>
          <Text style={styles.scannerHint}>{t('barcode.orConnect')}</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
        <Text style={styles.title}>{t('barcode.title')}</Text>
        <TouchableOpacity onPress={() => setCameraEnabled(!cameraEnabled)}>
          <Ionicons name={cameraEnabled ? 'pause-circle-outline' : 'play-circle-outline'} size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {cameraEnabled && (
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }}
            onBarcodeScanned={isProcessing ? undefined : handleBarCodeScanned}
          />
          <View style={styles.scanOverlay}>
            <View style={styles.scanFrame} />
          </View>
          <Animated.View style={[styles.flashOverlay, { opacity: flashOpacity }]} />
          <Text style={styles.scanHint}>{t('barcode.scanHint')}</Text>
        </View>
      )}

      {!cameraEnabled && <View style={{ flex: 1, backgroundColor: '#000' }} />}

      {lastScanned && (
        <View style={styles.lastScannedCard}>
          <Ionicons name="checkmark-circle" size={28} color="#fff" />
          <View style={styles.lastScannedInfo}>
            <Text style={styles.lastScannedName}>{lastScanned.name}</Text>
            <Text style={styles.lastScannedPrice}>{formatIQD(lastScanned.price)}</Text>
          </View>
        </View>
      )}

      <View style={styles.totalBar}>
        <View style={styles.totalBarLeft}>
          <Text style={styles.totalBarCount}>{itemCount}</Text>
          <Text style={styles.totalBarLabel}>{t('cart.itemCount')}</Text>
        </View>
        <Text style={styles.totalBarTotal}>{formatIQD(total)}</Text>
        <TouchableOpacity
          style={styles.totalBarBtn}
          onPress={() => { navigation.goBack(); setTimeout(() => navigation.navigate('Cart'), 100); }}
        >
          <Ionicons name="cart" size={20} color="#fff" />
          <Text style={styles.totalBarBtnText}>{t('cart.pay')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputSection}>
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef as any}
            style={styles.barcodeInput}
            placeholder={t('barcode.enterBarcode')}
            placeholderTextColor="#aaa"
            keyboardType="numeric"
            value={manualBarcode}
            onChangeText={setManualBarcode}
            onSubmitEditing={handleManualSubmit}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.submitBtn} onPress={handleManualSubmit}>
            <Ionicons name="checkmark-circle" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingText: { color: '#fff', textAlign: 'center', marginTop: 100 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, backgroundColor: '#1a6b3c',
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  cameraContainer: { flex: 1, position: 'relative' },
  camera: { flex: 1 },
  scanOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center' },
  scanFrame: { width: 280, height: 160, borderWidth: 2, borderColor: '#4CAF50', borderRadius: 12, backgroundColor: 'transparent' },
  flashOverlay: { ...StyleSheet.absoluteFill, backgroundColor: '#4CAF50' },
  scanHint: {
    position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center',
    color: '#fff', fontSize: 13, textShadowColor: '#000', textShadowRadius: 4,
  },
  noPermission: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  noPermissionText: { fontSize: 16, color: '#888', marginTop: 12 },
  permissionBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#1a6b3c', borderRadius: 8 },
  permissionBtnText: { color: '#fff', fontWeight: '600' },
  lastScannedCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a6b3c',
    marginHorizontal: 12, padding: 14, borderRadius: 12, gap: 10,
  },
  lastScannedInfo: { flex: 1 },
  lastScannedName: { fontSize: 17, fontWeight: 'bold', color: '#fff' },
  lastScannedPrice: { fontSize: 15, color: '#c8e6c9', fontWeight: '700' },
  totalBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#145228',
    paddingHorizontal: 16, paddingVertical: 10, gap: 12,
  },
  totalBarLeft: { alignItems: 'center', marginRight: 4 },
  totalBarCount: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  totalBarLabel: { fontSize: 10, color: '#c8e6c9' },
  totalBarTotal: { flex: 1, fontSize: 22, fontWeight: 'bold', color: '#fff', textAlign: 'right' },
  totalBarBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#4CAF50',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, gap: 6,
  },
  totalBarBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  inputSection: { backgroundColor: '#fff', padding: 12, paddingBottom: Platform.OS === 'ios' ? 32 : 12 },
  inputRow: { flexDirection: 'row', gap: 8 },
  barcodeInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 18, writingDirection: 'ltr', textAlign: 'center' },
  submitBtn: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#1a6b3c', justifyContent: 'center', alignItems: 'center' },
  scannerHint: { fontSize: 12, color: '#888', textAlign: 'center', marginTop: 8 },
});
