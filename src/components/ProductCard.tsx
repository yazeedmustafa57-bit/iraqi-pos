import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Product } from '../types';
import { formatIQD } from '../i18n';
import { useAppStore } from '../stores/appStore';
import { translations } from '../i18n/translations';

interface Props {
  product: Product;
  onPress: () => void;
}

export default function ProductCard({ product, onPress }: Props) {
  const lang = useAppStore((s) => s.language);
  const t = (key: string) => translations[lang]?.[key] ?? key;

  const displayName =
    lang === 'en' ? product.nameEn || product.name :
    lang === 'ku' ? product.nameKu || product.name :
    product.name;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.iconContainer}>
        <Ionicons name="cart-outline" size={28} color="#1a6b3c" />
      </View>
      <Text style={styles.name} numberOfLines={2}>{displayName}</Text>
      <Text style={styles.price}>{formatIQD(product.price)}</Text>
      <Text style={styles.stock}>{product.stock} {t('cart.quantity')}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    margin: 6,
    width: '46%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    color: '#333',
    marginBottom: 4,
  },
  price: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1a6b3c',
    marginBottom: 2,
  },
  stock: {
    fontSize: 11,
    color: '#888',
  },
});
