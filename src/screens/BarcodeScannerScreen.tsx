import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Keyboard, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getProductByBarcode } from '../database/db';
import { useCartStore } from '../stores/cartStore';
import { useAppStore } from '../stores/appStore';
import { translations } from '../i18n/translations';
import { formatIQD } from '../i18n';
import { Product } from '../types';
import { playScanBeep } from '../services/scannerSound';

const isWeb = Platform.OS === 'web';

let CameraView: any = null;
let useCameraPermissionsFn: any = null;
if (!isWeb) {
  try {
    const cam = require('expo-camera');
    CameraView = cam.CameraView;
    useCameraPermissionsFn = cam.useCameraPermissions;
  } catch {}
}

// ====== WEB: Kamera mit BarcodeDetector ======
function WebCameraView({ onScan }: { onScan: (code: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(true);
  const timeoutRef = useRef<any>(null);
  const [status, setStatus] = useState('starting');

  useEffect(() => {
    scanningRef.current = true;
    let cancelled = false;

    async function start() {
      try {
        if (!('BarcodeDetector' in window)) {
          setStatus('error');
          return;
        }
        // Timeout after 8 seconds
        timeoutRef.current = setTimeout(() => {
          if (!cancelled && status === 'starting') {
            setStatus('error');
          }
        }, 8000);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        const track = stream.getVideoTracks()[0];
        if (track) {
          try {
            const caps: any = track.getCapabilities ? track.getCapabilities() : {};
            const adv: any[] = [];
            if (caps.focusMode?.includes('continuous')) adv.push({ focusMode: 'continuous' });
            if (caps.exposureMode?.includes('continuous')) adv.push({ exposureMode: 'continuous' });
            if (adv.length > 0) await track.applyConstraints({ advanced: adv });
          } catch {}
        }
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        const video = document.createElement('video');
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('autoplay', 'true');
        video.muted = true;
        video.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;background:#000;';

        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          containerRef.current.appendChild(video);
        }
        await video.play();
        if (cancelled) return;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setStatus('active');

        const detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
        });

        async function scan() {
          if (cancelled || !scanningRef.current) return;
          try {
            if (video.readyState >= 2) {
              const barcodes = await detector.detect(video);
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                scanningRef.current = false;
                try { navigator.vibrate(50); } catch {}
                onScan(barcodes[0].rawValue);
                return;
              }
            }
          } catch {}
          if (!cancelled && scanningRef.current) requestAnimationFrame(scan);
        }
        requestAnimationFrame(scan);
      } catch (err: any) {
        if (!cancelled) { if (timeoutRef.current) clearTimeout(timeoutRef.current); setStatus('error'); }
      }
    }
    start();
    return () => {
      cancelled = true; scanningRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [onScan]);

  if (status === 'error') {
    return (
      <View style={styles.noPermission}>
        <Ionicons name="camera-outline" size={48} color="#888" />
        <Text style={[styles.noPermissionText, { paddingHorizontal: 30 }]}>
          Kamera nicht verfügbar. Nutze manuelle Eingabe.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <div ref={(el) => { containerRef.current = el as HTMLDivElement; }} style={{ width: '100%', height: '100%', position: 'relative' } as any} />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View style={styles.scanFrame} />
        </View>
        <View style={{ position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
            <Text style={{ color: '#fff', fontSize: 14, textAlign: 'center' }}>
              {status === 'starting' ? 'Kamera startet...' : 'Barcode vor die Kamera halten'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ====== WEB: Manuelles Eingabefeld ======
function ManualInput({ onScan }: { onScan: (code: string) => void }) {
  const [val, setVal] = useState('');
  return (
    <View style={styles.noPermission}>
      <Ionicons name="keypad-outline" size={48} color="#555" />
      <Text style={{ color: '#aaa', fontSize: 14, marginTop: 12, textAlign: 'center' }}>Barcode manuell eingeben</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, width: '100%', maxWidth: 400 }}>
        <TextInput style={[styles.barcodeInput, { flex: 1 }]} placeholder="z.B. 6281001001001" placeholderTextColor="#aaa"
          keyboardType="numeric" value={val} onChangeText={setVal}
          onSubmitEditing={() => { if (val.trim()) { onScan(val.trim()); setVal(''); } }} returnKeyType="search" autoFocus />
        <TouchableOpacity style={styles.submitBtn} onPress={() => { if (val.trim()) { onScan(val.trim()); setVal(''); } }}>
          <Ionicons name="checkmark-circle" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ====== WEB: Scanner ======
function WebScanner() {
  const [lastScanned, setLastScanned] = useState<Product | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [flashAnim] = useState(new Animated.Value(0));
  const [scanResult, setScanResult] = useState('');
  const [useCamera, setUseCamera] = useState(true);
  const addItem = useCartStore((s) => s.addItem);
  const items = useCartStore((s) => s.items);
  const getTotal = useCartStore((s) => s.getTotal);
  const navigation = useNavigation<any>();
  const lang = useAppStore((s) => s.language);
  const t = useCallback((key: string) => translations[lang]?.[key] ?? key, [lang]);

  const triggerFlash = useCallback(() => {
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 40, useNativeDriver: false }),
      Animated.timing(flashAnim, { toValue: 0, duration: 150, useNativeDriver: false }),
    ]).start();
    playScanBeep();
  }, [flashAnim]);

  const handleBarcodeScan = useCallback(async (code: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setScanResult('🔍 ' + code);
    try {
      const product = await getProductByBarcode(code);
      if (product) {
        triggerFlash(); addItem(product); setLastScanned(product);
        setScanResult('✅ ' + product.name);
        setTimeout(() => { setLastScanned(null); setScanResult(''); }, 3000);
        setTimeout(() => setIsProcessing(false), 2000);
      } else {
        setScanResult('❌ ' + code + ' – nicht gefunden');
        setTimeout(() => { setScanResult(''); setIsProcessing(false); }, 2000);
      }
    } catch { setIsProcessing(false); }
  }, [addItem, triggerFlash, isProcessing]);

  const total = getTotal();
  const itemCount = items.reduce((sum: number, i: any) => sum + i.quantity, 0);
  const flashOpacity = flashAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
        <Text style={styles.title}>{t('barcode.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {useCamera ? <WebCameraView onScan={handleBarcodeScan} /> : <ManualInput onScan={handleBarcodeScan} />}

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#4CAF50', opacity: flashOpacity, zIndex: 50 }]} />

      {scanResult ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 100, left: 16, right: 16, zIndex: 100,
          backgroundColor: scanResult.startsWith('✅') ? '#2e7d32' : scanResult.startsWith('❌') ? '#c62828' : '#1565c0',
          padding: 14, borderRadius: 12, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{scanResult}</Text>
        </View>
      ) : null}

      {lastScanned && (
        <View pointerEvents="none" style={[styles.lastScannedCard, { zIndex: 60 }]}>
          <Ionicons name="checkmark-circle" size={28} color="#fff" />
          <View style={styles.lastScannedInfo}>
            <Text style={styles.lastScannedName}>{lastScanned.name}</Text>
            <Text style={styles.lastScannedPrice}>{formatIQD(lastScanned.price)}</Text>
          </View>
        </View>
      )}

      <View style={{ backgroundColor: '#145228', paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', gap: 6 }}>
        <TouchableOpacity style={[{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' }, useCamera ? { backgroundColor: '#4CAF50' } : { backgroundColor: 'rgba(255,255,255,0.15)' }]} onPress={() => setUseCamera(true)}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>📷 Kamera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' }, !useCamera ? { backgroundColor: '#4CAF50' } : { backgroundColor: 'rgba(255,255,255,0.15)' }]} onPress={() => setUseCamera(false)}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>⌨️ Manuel</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.totalBar}>
        <View style={styles.totalBarLeft}><Text style={styles.totalBarCount}>{itemCount}</Text><Text style={styles.totalBarLabel}>{t('cart.itemCount')}</Text></View>
        <Text style={styles.totalBarTotal}>{formatIQD(total)}</Text>
        <TouchableOpacity style={styles.totalBarBtn} onPress={() => { navigation.goBack(); setTimeout(() => navigation.navigate('Cart'), 100); }}>
          <Ionicons name="cart" size={20} color="#fff" /><Text style={styles.totalBarBtnText}>{t('cart.pay')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ====== NATIVE: Camera Scanner ======
function NativeScanner() {
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
  const [permission, requestPermission] = useCameraPermissionsFn ? useCameraPermissionsFn() : [null, () => {}];
  const barcodeRef = useRef('');
  const lastScanTime = useRef(0);
  const inputRef = useRef<any>(null);

  const triggerFlash = useCallback(() => {
    Animated.sequence([Animated.timing(flashAnim, { toValue: 1, duration: 40, useNativeDriver: false }), Animated.timing(flashAnim, { toValue: 0, duration: 150, useNativeDriver: false })]).start();
    playScanBeep();
  }, [flashAnim]);

  const handleBarcodeScan = useCallback(async (code: string) => {
    const now = Date.now(); if (now - lastScanTime.current < 1500) return; lastScanTime.current = now; setIsProcessing(true);
    try { const product = await getProductByBarcode(code); if (product) { triggerFlash(); addItem(product); setLastScanned(product); setTimeout(() => setLastScanned(null), 3000); } } catch {} finally { setIsProcessing(false); }
  }, [addItem, triggerFlash]);

  const handleManualSubmit = useCallback(() => { if (manualBarcode.trim()) { Keyboard.dismiss(); handleBarcodeScan(manualBarcode.trim()); setManualBarcode(''); } }, [manualBarcode, handleBarcodeScan]);
  const handleBarCodeScanned = useCallback(({ data }: { data: string }) => { if (data !== barcodeRef.current || Date.now() - lastScanTime.current > 1500) { barcodeRef.current = data; handleBarcodeScan(data); } }, [handleBarcodeScan]);

  const total = getTotal();
  const itemCount = items.reduce((sum: number, i: any) => sum + i.quantity, 0);
  const flashOpacity = flashAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] });

  if (!permission) return <View style={styles.container}><View style={styles.header}><TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity><Text style={styles.title}>{t('barcode.title')}</Text><View style={{ width: 24 }} /></View><View style={styles.noPermission}><Text style={styles.loadingText}>...</Text></View></View>;
  if (!permission.granted) return <View style={styles.container}><View style={styles.header}><TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity><Text style={styles.title}>{t('barcode.title')}</Text><View style={{ width: 24 }} /></View><View style={styles.noPermission}><Ionicons name="camera-outline" size={48} color="#888" /><Text style={styles.noPermissionText}>{t('barcode.scanHint')}</Text><TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}><Text style={styles.permissionBtnText}>{t("barcode.grantPermission")}</Text></TouchableOpacity></View></View>;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}><TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity><Text style={styles.title}>{t('barcode.title')}</Text><TouchableOpacity onPress={() => setCameraEnabled(!cameraEnabled)}><Ionicons name={cameraEnabled ? 'pause-circle-outline' : 'play-circle-outline'} size={24} color="#fff" /></TouchableOpacity></View>
      <View style={styles.cameraContainer}>
        {cameraEnabled && CameraView && <CameraView style={styles.camera} barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] }} onBarcodeScanned={isProcessing ? undefined : handleBarCodeScanned}><View style={styles.scanOverlay}><View style={styles.scanFrame} /></View><Animated.View style={[styles.flashOverlay, { opacity: flashOpacity }]} /><Text style={styles.scanHint}>{t('barcode.scanHint')}</Text></CameraView>}
        {!cameraEnabled && <View style={{ flex: 1, backgroundColor: '#000' }} />}
      </View>
      {lastScanned && <View style={styles.lastScannedCard}><Ionicons name="checkmark-circle" size={28} color="#fff" /><View style={styles.lastScannedInfo}><Text style={styles.lastScannedName}>{lastScanned.name}</Text><Text style={styles.lastScannedPrice}>{formatIQD(lastScanned.price)}</Text></View></View>}
      <View style={styles.totalBar}><View style={styles.totalBarLeft}><Text style={styles.totalBarCount}>{itemCount}</Text><Text style={styles.totalBarLabel}>{t('cart.itemCount')}</Text></View><Text style={styles.totalBarTotal}>{formatIQD(total)}</Text><TouchableOpacity style={styles.totalBarBtn} onPress={() => { navigation.goBack(); setTimeout(() => navigation.navigate('Cart'), 100); }}><Ionicons name="cart" size={20} color="#fff" /><Text style={styles.totalBarBtnText}>{t('cart.pay')}</Text></TouchableOpacity></View>
      <View style={styles.inputSection}><View style={styles.inputRow}><TextInput ref={inputRef} style={styles.barcodeInput} placeholder={t('barcode.enterBarcode')} placeholderTextColor="#aaa" keyboardType="numeric" value={manualBarcode} onChangeText={setManualBarcode} onSubmitEditing={handleManualSubmit} returnKeyType="search" /><TouchableOpacity style={styles.submitBtn} onPress={handleManualSubmit}><Ionicons name="checkmark-circle" size={24} color="#fff" /></TouchableOpacity></View></View>
    </KeyboardAvoidingView>
  );
}

export default function BarcodeScannerScreen() { return isWeb ? <WebScanner /> : <NativeScanner />; }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingText: { color: '#fff', textAlign: 'center', marginTop: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, backgroundColor: '#1a6b3c' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  cameraContainer: { flex: 1, position: 'relative' },
  camera: { flex: 1 },
  scanOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center' },
  scanFrame: { width: 280, height: 160, borderWidth: 2, borderColor: '#4CAF50', borderRadius: 12, backgroundColor: 'transparent' },
  flashOverlay: { ...StyleSheet.absoluteFill, backgroundColor: '#4CAF50' },
  scanHint: { position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 13, textShadowColor: '#000', textShadowRadius: 4 },
  noPermission: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' },
  noPermissionText: { fontSize: 16, color: '#888', marginTop: 12, textAlign: 'center' },
  permissionBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#1a6b3c', borderRadius: 8 },
  permissionBtnText: { color: '#fff', fontWeight: '600' },
  lastScannedCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a6b3c', marginHorizontal: 12, marginVertical: 8, padding: 14, borderRadius: 12, gap: 10 },
  lastScannedInfo: { flex: 1 },
  lastScannedName: { fontSize: 17, fontWeight: 'bold', color: '#fff' },
  lastScannedPrice: { fontSize: 15, color: '#c8e6c9', fontWeight: '700' },
  totalBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#145228', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  totalBarLeft: { alignItems: 'center', marginRight: 4 },
  totalBarCount: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  totalBarLabel: { fontSize: 10, color: '#c8e6c9' },
  totalBarTotal: { flex: 1, fontSize: 22, fontWeight: 'bold', color: '#fff', textAlign: 'right' },
  totalBarBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4CAF50', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, gap: 6 },
  totalBarBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  inputSection: { backgroundColor: '#fff', padding: 12, paddingBottom: 12 },
  inputRow: { flexDirection: 'row', gap: 8 },
  barcodeInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 18, writingDirection: 'ltr', textAlign: 'center' },
  submitBtn: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#1a6b3c', justifyContent: 'center', alignItems: 'center' },
});
