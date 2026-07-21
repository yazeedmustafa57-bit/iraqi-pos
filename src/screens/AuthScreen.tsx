import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerUser, loginUser, hasAnyUser } from '../database/db';
import { useAppStore } from '../stores/appStore';
import { translations } from '../i18n/translations';

export default function AuthScreen() {
  const { setCurrentUser, setIsAuthenticated, language } = useAppStore();
  const t = (key: string) => translations[language]?.[key] ?? key;
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(true);

  // Registration fields
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    checkExistingUser();
  }, []);

  const checkExistingUser = async () => {
    try {
      const hasUsers = await hasAnyUser();
      setIsLogin(hasUsers);
    } catch (e) {
      console.warn('Auth check error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!shopName.trim()) {
      Alert.alert('خطأ', t('general.error') + ': Shop name required');
      return;
    }
    if (!ownerName.trim()) {
      Alert.alert('خطأ', t('general.error') + ': Owner name required');
      return;
    }
    if (!phone.trim() || phone.trim().length < 10) {
      Alert.alert('خطأ', t('general.error') + ': Invalid phone number');
      return;
    }
    if (!pin || pin.length < 4) {
      Alert.alert('خطأ', t('general.error') + ': PIN must be 4+ digits');
      return;
    }
    if (pin !== pinConfirm) {
      Alert.alert('خطأ', t('general.error') + ': PINs do not match');
      return;
    }

    try {
      const user = await registerUser(shopName.trim(), ownerName.trim(), phone.trim(), pin);
      setCurrentUser(user);
      setIsAuthenticated(true);
    } catch (err: any) {
      if (String(err).includes('PHONE_EXISTS')) {
        Alert.alert('خطأ', t('general.error') + ': Phone already registered');
      } else {
        Alert.alert('خطأ', String(err));
      }
    }
  };

  const handleLogin = async () => {
    if (!phone.trim()) {
      Alert.alert('خطأ', t('general.error') + ': Enter phone number');
      return;
    }
    if (!pin) {
      Alert.alert('خطأ', t('general.error') + ': Enter PIN');
      return;
    }

    try {
      const user = await loginUser(phone.trim(), pin);
      if (user) {
        setCurrentUser(user);
        setIsAuthenticated(true);
      } else {
        Alert.alert('خطأ', t('general.error') + ': Wrong phone or PIN');
      }
    } catch (err: any) {
      Alert.alert('خطأ', String(err));
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="key-outline" size={48} color="#fff" />
        <Text style={styles.loadingText}>جاري التحميل...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="storefront" size={48} color="#fff" />
          </View>
          <Text style={styles.appName}>كاشير</Text>
          <Text style={styles.appSubtitle}>نظام نقاط البيع العراقي</Text>
        </View>

        {/* Toggle Login/Register */}
        {!isLogin && (
          <View style={styles.toggleRow}>
            <TouchableOpacity onPress={() => setIsLogin(true)}>
              <Text style={[styles.toggleText, styles.toggleActive]}>تسجيل الدخول</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsLogin(false)}>
              <Text style={[styles.toggleText, !isLogin ? styles.toggleActive : {}]}>حساب جديد</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>
            {isLogin ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
          </Text>

          {/* Registration fields */}
          {!isLogin && (
            <>
              <Text style={styles.label}>اسم المتجر *</Text>
              <TextInput
                style={styles.input}
                placeholder="مثال: محل آقا حسین"
                placeholderTextColor="#aaa"
                value={shopName}
                onChangeText={setShopName}
                textAlign="right"
              />

              <Text style={styles.label}>اسم صاحب المتجر *</Text>
              <TextInput
                style={styles.input}
                placeholder="مثال: حسین محمد"
                placeholderTextColor="#aaa"
                value={ownerName}
                onChangeText={setOwnerName}
                textAlign="right"
              />
            </>
          )}

          <Text style={styles.label}>رقم الهاتف *</Text>
          <TextInput
            style={styles.input}
            placeholder="07701234567"
            placeholderTextColor="#aaa"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            maxLength={15}
            textAlign="left"
          />

          <Text style={styles.label}>الـ PIN *</Text>
          <View style={styles.pinRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder={isLogin ? t('general.error') + ': Enter PIN' : 'اختر PIN (4-6 أرقام)'}
              placeholderTextColor="#aaa"
              keyboardType="number-pad"
              secureTextEntry={!showPin}
              value={pin}
              onChangeText={setPin}
              maxLength={6}
              textAlign="center"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPin(!showPin)}
            >
              <Ionicons name={showPin ? 'eye-off' : 'eye'} size={22} color="#888" />
            </TouchableOpacity>
          </View>

          {!isLogin && (
            <>
              <Text style={styles.label}>تأكيد الـ PIN *</Text>
              <TextInput
                style={styles.input}
                placeholder="أعد إدخال الـ PIN"
                placeholderTextColor="#aaa"
                keyboardType="number-pad"
                secureTextEntry={!showPin}
                value={pinConfirm}
                onChangeText={setPinConfirm}
                maxLength={6}
                textAlign="center"
              />
            </>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={isLogin ? handleLogin : handleRegister}
          >
            <Ionicons name={isLogin ? 'log-in-outline' : 'person-add-outline'} size={20} color="#fff" />
            <Text style={styles.submitBtnText}>
              {isLogin ? 'دخول' : 'إنشاء حساب'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          {isLogin
            ? 'لا يوجد حساب؟ '
            : 'لديك حساب بالفعل؟ '
          }
          <Text
            style={styles.footerLink}
            onPress={() => setIsLogin(!isLogin)}
          >
            {isLogin ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a6b3c',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a6b3c',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  appSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 20,
  },
  toggleText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
  },
  toggleActive: {
    color: '#fff',
    textDecorationLine: 'underline',
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fafafa',
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyeBtn: {
    padding: 12,
  },
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: '#1a6b3c',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 20,
    fontSize: 14,
  },
  footerLink: {
    color: '#fff',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});
