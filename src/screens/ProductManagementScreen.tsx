import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, Alert, ScrollView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAppStore } from '../stores/appStore';
import { translations } from '../i18n/translations';
import { formatIQD } from '../i18n';
import { getAllProducts, addProduct, updateProduct, deleteProduct } from '../database/db';
import { Product } from '../types';

const CATEGORIES = ['food', 'drinks', 'snacks', 'household', 'electronics', 'other'];

export default function ProductManagementScreen() {
  const lang = useAppStore((s) => s.language);
  const t = useCallback((key: string) => translations[lang]?.[key] ?? key, [lang]);
  const navigation = useNavigation<any>();

  const [products, setProducts] = useState<Product[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Barcode scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const lastScanTime = useRef(0);

  // Form state
  const [name, setName] = useState('');
  const [nameKu, setNameKu] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [category, setCategory] = useState('other');

  const loadProducts = async () => {
    const all = await getAllProducts();
    setProducts(all);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.nameEn || '').toLowerCase().includes(q) ||
      (p.barcode || '').includes(q)
    );
  });

  const openAddModal = () => {
    setEditingProduct(null);
    setName('');
    setNameKu('');
    setNameEn('');
    setBarcode('');
    setPrice('');
    setStock('');
    setCategory('other');
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setNameKu(product.nameKu || '');
    setNameEn(product.nameEn || '');
    setBarcode(product.barcode || '');
    setPrice(String(product.price));
    setStock(String(product.stock));
    setCategory(product.category);
    setShowModal(true);
  };

  const handleScanBarcode = async () => {
    if (!cameraPermission) {
      const perm = await requestCameraPermission();
      if (!perm.granted) {
        Alert.alert(t('general.error'), t('settings.bluetoothPermissionRequired'));
        return;
      }
    }
    if (!cameraPermission?.granted) {
      const perm = await requestCameraPermission();
      if (!perm.granted) {
        Alert.alert(t('general.error'), t('settings.bluetoothPermissionRequired'));
        return;
      }
    }
    setShowScanner(true);
  };

  const handleBarcodeScanned = useCallback(({ data }: { data: string }) => {
    const now = Date.now();
    if (now - lastScanTime.current < 1500) return;
    lastScanTime.current = now;
    setBarcode(data);
    setShowScanner(false);
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('general.error'), t('pm.nameRequired'));
      return;
    }
    const priceNum = parseInt(price.replace(/[^0-9]/g, ''), 10);
    if (!priceNum || priceNum <= 0) {
      Alert.alert(t('general.error'), t('pm.priceInvalid'));
      return;
    }
    const stockNum = parseInt(stock.replace(/[^0-9]/g, ''), 10) || 0;

    try {
      if (editingProduct) {
        await updateProduct({
          ...editingProduct,
          name: name.trim(),
          nameKu: nameKu.trim() || undefined,
          nameEn: nameEn.trim() || undefined,
          barcode: barcode.trim() || undefined,
          price: priceNum,
          stock: stockNum,
          category,
        });
      } else {
        await addProduct({
          name: name.trim(),
          nameKu: nameKu.trim() || undefined,
          nameEn: nameEn.trim() || undefined,
          barcode: barcode.trim() || undefined,
          price: priceNum,
          stock: stockNum,
          category,
        });
      }
      setShowModal(false);
      loadProducts();
    } catch (error: any) {
      const msg = String(error);
      if (msg.includes('UNIQUE')) {
        Alert.alert(t('general.error'), t('pm.barcodeUsed'));
      } else {
        Alert.alert(t('general.error'), msg);
      }
    }
  };

  const handleDelete = (product: Product) => {
    Alert.alert(
      t('pm.deleteTitle'),
      `${t('pm.deleteConfirm')} "${product.name}"?`,
      [
        { text: t('general.cancel'), style: 'cancel' },
        {
          text: t('pm.deleteBtn'),
          style: 'destructive',
          onPress: async () => {
            await deleteProduct(product.id);
            loadProducts();
          },
        },
      ]
    );
  };

  const getCategoryLabel = (cat: string) => {
    const key = `cat.${cat}`;
    const label = t(key);
    return label !== key ? label : cat;
  };

  const renderItem = ({ item }: { item: Product }) => (
    <TouchableOpacity style={styles.productCard} onPress={() => openEditModal(item)}>
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        {item.nameEn ? <Text style={styles.productSub}>{item.nameEn}</Text> : null}
        <View style={styles.productMeta}>
          <Text style={styles.productPrice}>{formatIQD(item.price)}</Text>
          <Text style={styles.productCategory}>{getCategoryLabel(item.category)}</Text>
        </View>
        <View style={styles.productMeta}>
          {item.barcode ? <Text style={styles.productBarcode}>#{item.barcode}</Text> : null}
          <Text style={[styles.productStock, item.stock === 0 && styles.stockZero]}>
            {item.stock === 0 ? '!' : `${item.stock} ${t('pm.stock')}`}
          </Text>
        </View>
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
        <Ionicons name="trash-outline" size={20} color="#e53935" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('pm.title')}</Text>
        <TouchableOpacity onPress={openAddModal}>
          <Ionicons name="add-circle" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color="#888" />
        <TextInput
          style={styles.searchInput}
          placeholder={t('catalog.search')}
          placeholderTextColor="#aaa"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <Text style={styles.countText}>
        {filteredProducts.length} {t('pm.results')}
      </Text>

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cart-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>{t('catalog.noProducts')}</Text>
          </View>
        }
      />

      {/* Add/Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingProduct ? t('pm.editProduct') : t('pm.addProduct')}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>{t('pm.productName')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('pm.productName')}
                placeholderTextColor="#aaa"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>{t('pm.productNameKu')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('pm.productNameKu')}
                placeholderTextColor="#aaa"
                value={nameKu}
                onChangeText={setNameKu}
              />

              <Text style={styles.label}>{t('pm.productNameEn')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('pm.productNameEn')}
                placeholderTextColor="#aaa"
                value={nameEn}
                onChangeText={setNameEn}
              />

              <Text style={styles.label}>{t('pm.barcode')}</Text>
              <View style={styles.barcodeRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder={t('barcode.enterBarcode')}
                  placeholderTextColor="#aaa"
                  keyboardType="numeric"
                  value={barcode}
                  onChangeText={setBarcode}
                />
                <TouchableOpacity style={styles.scanBtn} onPress={handleScanBarcode}>
                  <Ionicons name="barcode-outline" size={24} color="#fff" />
                  <Text style={styles.scanBtnText}>{t('barcode.title')}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>{t('pm.price')}</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor="#aaa"
                keyboardType="number-pad"
                value={price}
                onChangeText={setPrice}
              />

              <Text style={styles.label}>{t('pm.stock')}</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor="#aaa"
                keyboardType="number-pad"
                value={stock}
                onChangeText={setStock}
              />

              <Text style={styles.label}>{t('pm.category')}</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryBtn,
                      category === cat && styles.categoryBtnActive,
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        category === cat && styles.categoryTextActive,
                      ]}
                    >
                      {getCategoryLabel(cat)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setShowModal(false)}
                >
                  <Text style={styles.cancelBtnText}>{t('general.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>{t('general.save')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Barcode Scanner Modal */}
      <Modal visible={showScanner} transparent={false} animationType="slide">
        <View style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <TouchableOpacity onPress={() => setShowScanner(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>{t('barcode.title')}</Text>
            <View style={{ width: 28 }} />
          </View>

          {cameraPermission?.granted ? (
            <CameraView
              style={styles.scannerCamera}
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }}
              onBarcodeScanned={showScanner ? handleBarcodeScanned : undefined}
            >
              <View style={styles.scanOverlay}>
                <View style={styles.scanFrame} />
              </View>
              <Text style={styles.scanHint}>{t('barcode.scanHint')}</Text>
            </CameraView>
          ) : (
            <View style={styles.scannerNoAccess}>
              <Ionicons name="camera-outline" size={64} color="#888" />
              <Text style={styles.scannerNoAccessText}>{t('settings.bluetoothPermissionRequired')}</Text>
              <TouchableOpacity style={styles.scannerPermBtn} onPress={requestCameraPermission}>
                <Text style={styles.scannerPermBtnText}>{t('barcode.grantPermission')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#1a6b3c',
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    gap: 8,
  },
  searchInput: { flex: 1, padding: 10, fontSize: 15, color: '#333' },
  countText: { fontSize: 13, color: '#888', marginHorizontal: 16, marginTop: 8, marginBottom: 4 },
  list: { padding: 12 },
  productCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
  },
  productInfo: { flex: 1 },
  productName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  productSub: { fontSize: 13, color: '#888', marginBottom: 4 },
  productMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, gap: 12 },
  productPrice: { fontSize: 15, fontWeight: 'bold', color: '#1a6b3c' },
  productCategory: { fontSize: 12, color: '#888', backgroundColor: '#f0f0f0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  productBarcode: { fontSize: 12, color: '#888' },
  productStock: { fontSize: 12, color: '#1a6b3c', fontWeight: '600' },
  stockZero: { color: '#e53935' },
  deleteBtn: { padding: 8 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 16, color: '#aaa', marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12,
    fontSize: 16, color: '#333',
  },
  barcodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a6b3c',
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, gap: 6,
  },
  scanBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  categoryBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#fafafa',
  },
  categoryBtnActive: { backgroundColor: '#1a6b3c', borderColor: '#1a6b3c' },
  categoryText: { fontSize: 13, fontWeight: '600', color: '#666' },
  categoryTextActive: { color: '#fff' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#f0f0f0', alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: '#666' },
  saveBtn: {
    flex: 2, flexDirection: 'row', padding: 14, borderRadius: 12,
    backgroundColor: '#1a6b3c', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  saveBtnText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  // Scanner styles
  scannerContainer: { flex: 1, backgroundColor: '#000' },
  scannerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, backgroundColor: '#1a6b3c',
  },
  scannerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  scannerCamera: { flex: 1, position: 'relative' },
  scanOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center' },
  scanFrame: { width: 280, height: 160, borderWidth: 2, borderColor: '#4CAF50', borderRadius: 12, backgroundColor: 'transparent' },
  scanHint: {
    position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center',
    color: '#fff', fontSize: 14, textShadowColor: '#000', textShadowRadius: 4,
  },
  scannerNoAccess: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' },
  scannerNoAccessText: { fontSize: 16, color: '#888', marginTop: 12, textAlign: 'center', paddingHorizontal: 40 },
  scannerPermBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#1a6b3c', borderRadius: 10 },
  scannerPermBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
