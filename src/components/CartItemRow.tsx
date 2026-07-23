import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CartItem } from '../types';
import { formatIQD } from '../i18n';
import { useAppStore } from '../stores/appStore';
import { translations } from '../i18n/translations';

interface Props {
  item: CartItem;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}

export default function CartItemRow({ item, onUpdateQuantity, onRemove }: Props) {
  const lang = useAppStore((s) => s.language);
  const t = (key: string) => translations[lang]?.[key] ?? key;

  const displayName =
    lang === 'en' ? item.product.nameEn || item.product.name :
    lang === 'ku' ? item.product.nameKu || item.product.name :
    item.product.name;

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
        <Text style={styles.price}>{formatIQD(item.product.price)}</Text>
      </View>
      <View style={styles.quantityContainer}>
        <TouchableOpacity
          style={styles.qtyBtn}
          onPress={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
        >
          <Ionicons name="remove" size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.qtyText}>{item.quantity}</Text>
        <TouchableOpacity
          style={styles.qtyBtn}
          onPress={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
        >
          <Ionicons name="add" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={styles.subtotalContainer}>
        <Text style={styles.subtotal}>{formatIQD(item.subtotal)}</Text>
      </View>
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => onRemove(item.product.id)}
        activeOpacity={0.6}
      >
        <Ionicons name="trash" size={20} color="#e53935" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  price: {
    fontSize: 12,
    color: '#888',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a6b3c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 8,
    color: '#333',
    minWidth: 24,
    textAlign: 'center',
  },
  subtotalContainer: {
    minWidth: 70,
    alignItems: 'flex-end',
  },
  subtotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a6b3c',
  },
  removeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffebee',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
});
