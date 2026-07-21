import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../stores/appStore';
import { translations } from '../i18n/translations';

export default function ConnectivityIndicator() {
  const isOnline = useAppStore((s) => s.isOnline);
  const lang = useAppStore((s) => s.language);
  const t = (key: string) => translations[lang]?.[key] ?? key;

  return (
    <View style={[styles.container, isOnline ? styles.online : styles.offline]}>
      <Ionicons
        name={isOnline ? 'wifi' as any : 'wifi-off' as any}
        size={14}
        color="#fff"
      />
      <Text style={styles.text}>
        {isOnline ? t('general.online') : t('general.offline')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  online: {
    backgroundColor: '#1a6b3c',
  },
  offline: {
    backgroundColor: '#e65100',
  },
  text: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});
