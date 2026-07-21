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
      Alert.alert(t('general.error'), t('auth.shopNameRequired'));
      return;
    }
    if (!ownerName.trim()) {
      Alert.alert(t('general.error'), t('auth.ownerNameRequired'));
      return;
    }
    if (!phone.trim() || phone.trim().length < 10) {
      Alert.alert(t('general.error'), t('auth.invalidPhone'));
      return;
    }
    if (!pin || pin.length < 4) {
      Alert.alert(t('general.error'), t('auth.pinTooShort'));
      return;
    }
    if (pin !== pinConfirm) {
      Alert.alert(t('general.error'), t('auth.pinMismatch'));
      return;
    }

    try {
      const user = await registerUser(shopName.trim(), ownerName.trim(), phone.trim(), pin);
      setCurrentUser(user);
      setIsAuthenticated(true);
    } catch (err: any) {
      if (String(err).includes('PHONE_EXISTS')) {
        Alert.alert(t('general.error'), t('auth.phoneExists'));
      } else {
        Alert.alert(t('general.error'), String(err));
      }
    }
  };

  const handleLogin = async () => {
    if (!phone.trim()) {
      Alert.alert(t('general.error'), t('auth.enterPhone'));
      return;
    }
    if (!pin) {
      Alert.alert(t('general.error'), t('auth.enterPin'));
      return;
    }

    try {
      const user = await loginUser(phone.trim(), pin);
      if (user) {
        setCurrentUser(user);
        setIsAuthenticated(true);
      } else {
        Alert.alert(t('general.error'), t('auth.wrongCredentials'));
      }
    } catch (err: any) {
      Alert.alert(t('general.error'), String(err));
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="key-outline" size={48} color="#fff" />
        <Text style={styles.loadingText}>{t('app.loading')}</Text>
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
          <Text style={styles.appName}>{t('auth.appName')}</Text>
          <Text style={styles.appSubtitle}>{t('auth.shopSubtitle')}</Text>
        </View>

        {/* Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>
            {isLogin ? t('auth.login') : t('auth.registerNew')}
          </Text>

          {/* Registration fields */}
          {!isLogin && (
            <>
              <Text style={styles.label}>{t('auth.shopName')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('auth.shopNameHint')}
                placeholderTextColor="#aaa"
                value={shopName}
                onChangeText={setShopName}
                textAlign="right"
              />

              <Text style={styles.label}>{t('auth.ownerName')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('auth.ownerNameHint')}
                placeholderTextColor="#aaa"
                value={ownerName}
                onChangeText={setOwnerName}
                textAlign="right"
              />
            </>
          )}

          <Text style={styles.label}>{t('auth.phone')}</Text>
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

          <Text style={styles.label}>{t('auth.pin')}</Text>
          <View style={styles.pinRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder={isLogin ? t('auth.pinHintLogin') : t('auth.pinHintRegister')}
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
              <Text style={styles.label}>{t('auth.pinConfirm')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('auth.pinConfirmHint')}
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
              {isLogin ? t('auth.loginBtn') : t('auth.registerBtn')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          {isLogin
            ? t('auth.noAccount')
            : t('auth.hasAccount')
          }
          <Text
            style={styles.footerLink}
            onPress={() => setIsLogin(!isLogin)}
          >
            {isLogin ? t('auth.register') : t('auth.login')}
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
