import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../stores/appStore';
import { privacyTranslations } from '../i18n/privacyTranslations';

export default function PrivacyScreen() {
  const navigation = useNavigation<any>();
  const language = useAppStore((s) => s.language);
  const t = useCallback((key: string) => privacyTranslations[language]?.[key] ?? key, [language]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('privacy.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>{t('privacy.lastUpdated')}: 24.07.2026</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.introTitle')}</Text>
          <Text style={styles.sectionText}>{t('privacy.introText')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.dataCollectedTitle')}</Text>
          <Text style={styles.sectionText}>{t('privacy.dataCollectedText')}</Text>
          {[
            { icon: 'storefront-outline', title: t('privacy.shopData'), desc: t('privacy.shopDataDesc') },
            { icon: 'person-outline', title: t('privacy.userData'), desc: t('privacy.userDataDesc') },
            { icon: 'call-outline', title: t('privacy.phoneData'), desc: t('privacy.phoneDataDesc') },
            { icon: 'cube-outline', title: t('privacy.productData'), desc: t('privacy.productDataDesc') },
            { icon: 'receipt-outline', title: t('privacy.orderData'), desc: t('privacy.orderDataDesc') },
            { icon: 'card-outline', title: t('privacy.paymentData'), desc: t('privacy.paymentDataDesc') },
          ].map((item, i) => (
            <View key={i} style={styles.dataItem}>
              <Ionicons name={item.icon as any} size={20} color="#1a6b3c" />
              <View style={{ flex: 1 }}>
                <Text style={styles.dataItemTitle}>{item.title}</Text>
                <Text style={styles.dataItemText}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.purposeTitle')}</Text>
          <Text style={styles.sectionText}>{t('privacy.purposeText')}</Text>
          {[
            t('privacy.purposeAccount'),
            t('privacy.purposeShop'),
            t('privacy.purposeOrders'),
            t('privacy.purposePayment'),
          ].map((text, i) => (
            <View key={i} style={styles.purposeItem}>
              <Text style={styles.purposeBullet}>•</Text>
              <Text style={styles.purposeText}>{text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.protectionTitle')}</Text>
          <Text style={styles.sectionText}>{t('privacy.protectionText')}</Text>
          {[
            { icon: 'lock-closed-outline', title: t('privacy.protectionEncryption'), desc: t('privacy.protectionEncryptionDesc') },
            { icon: 'shield-checkmark-outline', title: t('privacy.protectionStorage'), desc: t('privacy.protectionStorageDesc') },
            { icon: 'people-outline', title: t('privacy.protectionSeparation'), desc: t('privacy.protectionSeparationDesc') },
          ].map((item, i) => (
            <View key={i} style={styles.protectionItem}>
              <Ionicons name={item.icon as any} size={20} color="#1a6b3c" />
              <View style={{ flex: 1 }}>
                <Text style={styles.protectionItemTitle}>{item.title}</Text>
                <Text style={styles.protectionItemText}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.thirdPartyTitle')}</Text>
          <Text style={styles.sectionText}>{t('privacy.thirdPartyText')}</Text>
          <View style={styles.thirdPartyItem}>
            <Text style={styles.thirdPartyName}>🏦 FIB (Finance International Bank)</Text>
            <Text style={styles.thirdPartyDesc}>{t('privacy.thirdPartyFib')}</Text>
          </View>
          <View style={styles.thirdPartyItem}>
            <Text style={styles.thirdPartyName}>🖨️ Bluetooth-Drucker</Text>
            <Text style={styles.thirdPartyDesc}>{t('privacy.thirdPartyBluetooth')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.deletionTitle')}</Text>
          <Text style={styles.sectionText}>{t('privacy.deletionText')}</Text>
          {[t('privacy.deletionStep1'), t('privacy.deletionStep2'), t('privacy.deletionStep3')].map((text, i) => (
            <View key={i} style={styles.deletionStep}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{i + 1}</Text></View>
              <Text style={styles.deletionStepText}>{text}</Text>
            </View>
          ))}
          <View style={styles.contactBox}>
            <Ionicons name="mail-outline" size={20} color="#1565C0" />
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>{t('privacy.contactLabel')}</Text>
              <Text style={styles.contactEmail}>privacy@iraqi-pos.app</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.childrenTitle')}</Text>
          <Text style={styles.sectionText}>{t('privacy.childrenText')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.changesTitle')}</Text>
          <Text style={styles.sectionText}>{t('privacy.changesText')}</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, backgroundColor: '#1a6b3c',
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  content: { flex: 1, padding: 16 },
  lastUpdated: { fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 16 },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  sectionText: { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 12 },
  dataItem: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-start' },
  dataItemTitle: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 2 },
  dataItemText: { fontSize: 13, color: '#666', lineHeight: 18 },
  purposeItem: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  purposeBullet: { fontSize: 14, color: '#1a6b3c', fontWeight: 'bold' },
  purposeText: { fontSize: 14, color: '#555', flex: 1, lineHeight: 20 },
  protectionItem: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-start' },
  protectionItemTitle: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 2 },
  protectionItemText: { fontSize: 13, color: '#666', lineHeight: 18 },
  thirdPartyItem: { backgroundColor: '#f8f9fa', borderRadius: 8, padding: 12, marginBottom: 8 },
  thirdPartyName: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 },
  thirdPartyDesc: { fontSize: 13, color: '#666', lineHeight: 18 },
  deletionStep: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'center' },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1a6b3c', justifyContent: 'center', alignItems: 'center' },
  stepNumberText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  deletionStepText: { fontSize: 14, color: '#555', flex: 1, lineHeight: 20 },
  contactBox: { flexDirection: 'row', gap: 12, backgroundColor: '#e3f2fd', borderRadius: 8, padding: 12, marginTop: 8, alignItems: 'center' },
  contactLabel: { fontSize: 13, color: '#666', marginBottom: 2 },
  contactEmail: { fontSize: 15, fontWeight: '600', color: '#1565C0' },
});
