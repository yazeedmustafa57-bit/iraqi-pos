import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Product } from '../types';
import { getAllProducts, getProductsByCategory, searchProducts } from '../database/db';
import { useCartStore } from '../stores/cartStore';
import { useAppStore } from '../stores/appStore';
import { translations } from '../i18n/translations';
import ProductCard from '../components/ProductCard';
import ConnectivityIndicator from '../components/ConnectivityIndicator';

const CATEGORIES = ['all', 'food', 'drinks', 'snacks', 'household', 'electronics', 'other'];

export default function CatalogScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const addItem = useCartStore((s) => s.addItem);
  const navigation = useNavigation<any>();
  const lang = useAppStore((s) => s.language);
  const t = useCallback((key: string) => translations[lang]?.[key] ?? key, [lang]);

  const loadProducts = useCallback(async (category: string, search: string) => {
    try {
      const prods = search.trim()
        ? await searchProducts(search)
        : await getProductsByCategory(category);
      setProducts(prods);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  }, []);

  useEffect(() => {
    loadProducts(selectedCategory, searchQuery);
  }, [selectedCategory, searchQuery, loadProducts]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleProductPress = useCallback((product: Product) => {
    addItem(product);
    Alert.alert(t('catalog.addedToCart'), product.name, [{ text: 'OK' }]);
  }, [addItem, t]);

  const handleBarcodePress = () => {
    navigation.navigate('BarcodeScanner');
  };

  const handleManagePress = () => {
    navigation.navigate('ProductManagement');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts(selectedCategory, searchQuery);
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>{t('catalog.title')}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleManagePress} style={{ marginRight: 12 }}>
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <ConnectivityIndicator />
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#888" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('catalog.search')}
            placeholderTextColor="#aaa"
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={18} color="#888" />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity style={styles.barcodeBtn} onPress={handleBarcodePress}>
          <Ionicons name="barcode-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        horizontal
        data={CATEGORIES}
        showsHorizontalScrollIndicator={false}
        style={styles.categoryList}
        contentContainerStyle={styles.categoryContent}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === item && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(item)}
          >
            <Text style={[styles.categoryText, selectedCategory === item && styles.categoryTextActive]}>
              {t(`cat.${item}`)}
            </Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={products}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.productGrid}
        columnWrapperStyle={styles.productRow}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cart-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>{t('catalog.noProducts')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ProductCard product={item} onPress={() => handleProductPress(item)} />
        )}
      />
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
    paddingBottom: 10,
    backgroundColor: '#1a6b3c',
  },
  headerLeft: {},
  headerRight: { flexDirection: "row" as const, alignItems: "center" as const },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1a6b3c',
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    writingDirection: 'ltr',
  },
  barcodeBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#145228',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  categoryList: {
    maxHeight: 50,
    backgroundColor: '#fff',
  },
  categoryContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 4,
  },
  categoryChipActive: {
    backgroundColor: '#1a6b3c',
  },
  categoryText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#fff',
  },
  productGrid: {
    paddingVertical: 8,
  },
  productRow: {
    justifyContent: 'center',
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
