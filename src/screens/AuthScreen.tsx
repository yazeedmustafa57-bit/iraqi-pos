import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../stores/appStore';
import { registerUser, loginUser, hasAnyUser, resetPIN, getUserByPhone, updateUserEmail, verifyEmail } from '../database/db';
import { translations } from '../i18n/translations';
import { hashPIN, verifyPIN, isAlreadyHashed } from '../utils/crypto';
import { isLockedOut, recordFailedAttempt, clearLoginAttempts, getRemainingLockoutTime } from '../utils/crypto';

type AuthMode = 'login' | 'register' | 'forgot' | 'verify-email';

export default function AuthScreen() {
  const { setCurrentUser, setIsAuthenticated, language } = useAppStore();
  const t = useCallback((key: string) => translations[language]?.[key] ?? key, [language]);

  // Form state
  const [isLogin, setIsLogin] = useState(true);
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  
  // Forgot password state
  const [mode, setMode] = useState<AuthMode>('login');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotAnswer, setForgotAnswer] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [userSecurityQuestion, setUserSecurityQuestion] = useState('');
  const [showNewPin, setShowNewPin] = useState(false);

  // Lockout state
  const [lockoutTime, setLockoutTime] = useState(0);

  // Check for first user
  const [isFirstUser, setIsFirstUser] = useState(true);

  useEffect(() => {
    hasAnyUser().then(has => setIsFirstUser(!has));
  }, []);

  // Lockout timer
  useEffect(() => {
    if (lockoutTime > 0) {
      const timer = setInterval(() => {
        const remaining = getRemainingLockoutTime(phone);
        if (remaining <= 0) {
          setLockoutTime(0);
          clearInterval(timer);
        } else {
          setLockoutTime(remaining);
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutTime, phone]);

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(title + ': ' + msg);
    else Alert.alert(title, msg);
  };

  const formatLockoutTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // ---- REGISTER ----
  const handleRegister = async () => {
    if (!shopName.trim()) { showAlert(t('general.error'), t('auth.shopNameRequired')); return; }
    if (!ownerName.trim()) { showAlert(t('general.error'), t('auth.ownerNameRequired')); return; }
    if (!phone.trim() || phone.trim().length < 10) { showAlert(t('general.error'), t('auth.invalidPhone')); return; }
    if (!pin || pin.length < 4) { showAlert(t('general.error'), t('auth.pinTooShort')); return; }
    if (pin !== pinConfirm) { showAlert(t('general.error'), t('auth.pinMismatch')); return; }
    if (!securityQuestion.trim()) { showAlert(t('general.error'), t('auth.securityQuestionRequired')); return; }
    if (!securityAnswer.trim()) { showAlert(t('general.error'), t('auth.securityAnswerRequired')); return; }

    try {
      const pinHash = await hashPIN(pin);
      const user = await registerUser(
        shopName.trim(), ownerName.trim(), phone.trim(), pinHash,
        email.trim() || undefined,
        { question: securityQuestion.trim(), answer: securityAnswer.trim() }
      );
      setCurrentUser(user);
      setIsAuthenticated(true);
    } catch (err: any) {
      if (String(err).includes('PHONE_EXISTS')) {
        showAlert(t('general.error'), t('auth.phoneExists'));
      } else {
        showAlert(t('general.error'), String(err));
      }
    }
  };

  // ---- LOGIN ----
  const handleLogin = async () => {
    if (!phone.trim()) { showAlert(t('general.error'), t('auth.enterPhone')); return; }
    if (!pin) { showAlert(t('general.error'), t('auth.enterPin')); return; }

    // Check lockout
    if (isLockedOut(phone)) {
      const remaining = getRemainingLockoutTime(phone);
      setLockoutTime(remaining);
      showAlert(t('general.error'), t('auth.lockedOut') + ' ' + formatLockoutTime(remaining));
      return;
    }

    try {
      const pinHash = await hashPIN(pin);
      const user = await loginUser(phone.trim(), pinHash);
      if (user) {
        clearLoginAttempts(phone);
        setCurrentUser(user);
        setIsAuthenticated(true);
      } else {
        const attempts = recordFailedAttempt(phone);
        if (attempts.lockedUntil) {
          setLockoutTime(getRemainingLockoutTime(phone));
          showAlert(t('general.error'), t('auth.lockedOut'));
        } else {
          const remaining = 5 - attempts.count;
          showAlert(t('general.error'), t('auth.wrongCredentials') + ` (${remaining} ${t('auth.attemptsLeft')})`);
        }
      }
    } catch (err: any) {
      showAlert(t('general.error'), String(err));
    }
  };

  // ---- FORGOT PASSWORD ----
  const handleForgotPassword = async () => {
    if (!forgotPhone.trim()) { showAlert(t('general.error'), t('auth.enterPhone')); return; }

    try {
      const user = await getUserByPhone(forgotPhone.trim());
      if (user && user.securityQuestion) {
        setUserSecurityQuestion(user.securityQuestion.question);
        setShowNewPin(true);
      } else {
        showAlert(t('general.error'), t('auth.noSecurityQuestion'));
      }
    } catch (err: any) {
      showAlert(t('general.error'), String(err));
    }
  };

  const handleResetPIN = async () => {
    if (!forgotAnswer.trim()) { showAlert(t('general.error'), t('auth.enterAnswer')); return; }
    if (!newPin || newPin.length < 4) { showAlert(t('general.error'), t('auth.pinTooShort')); return; }
    if (newPin !== newPinConfirm) { showAlert(t('general.error'), t('auth.pinMismatch')); return; }

    try {
      const newPinHash = await hashPIN(newPin);
      const success = await resetPIN(forgotPhone.trim(), forgotAnswer.trim(), newPinHash);
      if (success) {
        showAlert('✅', t('auth.pinResetSuccess'));
        setMode('login');
        setForgotPhone('');
        setForgotAnswer('');
        setNewPin('');
        setNewPinConfirm('');
        setShowNewPin(false);
      } else {
        showAlert(t('general.error'), t('auth.wrongAnswer'));
      }
    } catch (err: any) {
      showAlert(t('general.error'), String(err));
    }
  };

  // ---- RENDER ----
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Ionicons name="storefront" size={60} color="#1a6b3c" />
          <Text style={styles.appName}>{t('auth.appName')}</Text>
          <Text style={styles.subtitle}>{t('auth.shopSubtitle')}</Text>
        </View>

        {/* ---- LOGIN MODE ---- */}
        {mode === 'login' && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{t('auth.login')}</Text>

            <Text style={styles.label}>{t('auth.phone')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.enterPhone')}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              editable={lockoutTime <= 0}
            />

            <Text style={styles.label}>{t('auth.pin')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.enterPin')}
              value={pin}
              onChangeText={setPin}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              editable={lockoutTime <= 0}
            />

            {lockoutTime > 0 && (
              <View style={styles.lockoutBox}>
                <Ionicons name="lock-closed" size={16} color="#e53935" />
                <Text style={styles.lockoutText}>{t('auth.lockedOut')} {formatLockoutTime(lockoutTime)}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, lockoutTime > 0 && styles.submitBtnDisabled]}
              onPress={handleLogin}
              disabled={lockoutTime > 0}
            >
              <Text style={styles.submitBtnText}>{t('auth.loginBtn')}</Text>
            </TouchableOpacity>

            <View style={styles.linksRow}>
              <TouchableOpacity onPress={() => setMode('forgot')}>
                <Text style={styles.linkText}>{t('auth.forgotPin')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setIsLogin(false); setMode('login'); }}>
                <Text style={styles.linkText}>{t('auth.noAccount')}{t('auth.registerBtn')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ---- REGISTER MODE ---- */}
        {mode === 'login' && !isLogin && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{t('auth.registerNew')}</Text>

            <Text style={styles.label}>{t('auth.shopName')}</Text>
            <TextInput style={styles.input} placeholder={t('auth.shopNameHint')} value={shopName} onChangeText={setShopName} />

            <Text style={styles.label}>{t('auth.ownerName')}</Text>
            <TextInput style={styles.input} placeholder={t('auth.ownerNameHint')} value={ownerName} onChangeText={setOwnerName} />

            <Text style={styles.label}>{t('auth.phone')}</Text>
            <TextInput style={styles.input} placeholder={t('auth.enterPhone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

            <Text style={styles.label}>{t('auth.email')} ({t('auth.optional')})</Text>
            <TextInput style={styles.input} placeholder="email@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.label}>{t('auth.pin')} *</Text>
            <TextInput style={styles.input} placeholder={t('auth.pinHintRegister')} value={pin} onChangeText={setPin} keyboardType="numeric" secureTextEntry maxLength={6} />

            <Text style={styles.label}>{t('auth.pinConfirm')} *</Text>
            <TextInput style={styles.input} placeholder={t('auth.pinConfirmHint')} value={pinConfirm} onChangeText={setPinConfirm} keyboardType="numeric" secureTextEntry maxLength={6} />

            <Text style={styles.label}>{t('auth.securityQuestion')} *</Text>
            <TextInput style={styles.input} placeholder={t('auth.securityQuestionHint')} value={securityQuestion} onChangeText={setSecurityQuestion} />

            <Text style={styles.label}>{t('auth.securityAnswer')} *</Text>
            <TextInput style={styles.input} placeholder={t('auth.securityAnswerHint')} value={securityAnswer} onChangeText={setSecurityAnswer} autoCapitalize="none" />

            <TouchableOpacity style={styles.submitBtn} onPress={handleRegister}>
              <Text style={styles.submitBtnText}>{t('auth.registerBtn')}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setIsLogin(true); setMode('login'); }}>
              <Text style={[styles.linkText, { textAlign: 'center', marginTop: 12 }]}>{t('auth.hasAccount')}{t('auth.loginBtn')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ---- FORGOT PASSWORD MODE ---- */}
        {mode === 'forgot' && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{t('auth.forgotPin')}</Text>

            {!showNewPin ? (
              <>
                <Text style={styles.label}>{t('auth.phone')}</Text>
                <TextInput style={styles.input} placeholder={t('auth.enterPhone')} value={forgotPhone} onChangeText={setForgotPhone} keyboardType="phone-pad" />
                <TouchableOpacity style={styles.submitBtn} onPress={handleForgotPassword}>
                  <Text style={styles.submitBtnText}>{t('auth.continue')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.securityBox}>
                  <Ionicons name="help-circle" size={20} color="#1565C0" />
                  <Text style={styles.securityQuestionText}>{userSecurityQuestion}</Text>
                </View>

                <Text style={styles.label}>{t('auth.securityAnswer')}</Text>
                <TextInput style={styles.input} placeholder={t('auth.securityAnswerHint')} value={forgotAnswer} onChangeText={setForgotAnswer} autoCapitalize="none" />

                <Text style={styles.label}>{t('auth.newPin')}</Text>
                <TextInput style={styles.input} placeholder={t('auth.pinHintRegister')} value={newPin} onChangeText={setNewPin} keyboardType="numeric" secureTextEntry maxLength={6} />

                <Text style={styles.label}>{t('auth.newPinConfirm')}</Text>
                <TextInput style={styles.input} placeholder={t('auth.pinConfirmHint')} value={newPinConfirm} onChangeText={setNewPinConfirm} keyboardType="numeric" secureTextEntry maxLength={6} />

                <TouchableOpacity style={styles.submitBtn} onPress={handleResetPIN}>
                  <Text style={styles.submitBtnText}>{t('auth.resetPin')}</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity onPress={() => { setMode('login'); setShowNewPin(false); setForgotPhone(''); setForgotAnswer(''); setNewPin(''); setNewPinConfirm(''); }} style={{ marginTop: 12 }}>
              <Text style={[styles.linkText, { textAlign: 'center' }]}>{t('auth.backToLogin')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { padding: 20, paddingTop: 60 },
  logoContainer: { alignItems: 'center', marginBottom: 30 },
  appName: { fontSize: 28, fontWeight: 'bold', color: '#1a6b3c', marginTop: 10 },
  subtitle: { fontSize: 14, color: '#888', marginTop: 4 },
  formCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  formTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 16, textAlign: 'center' },
  label: { fontSize: 13, color: '#555', marginBottom: 4, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 12, backgroundColor: '#fafafa' },
  submitBtn: { backgroundColor: '#1a6b3c', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 },
  submitBtnDisabled: { backgroundColor: '#ccc' },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  linksRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  linkText: { color: '#1565C0', fontSize: 14, fontWeight: '500' },
  lockoutBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ffebee', borderRadius: 8, padding: 10, marginBottom: 8 },
  lockoutText: { color: '#e53935', fontSize: 13, fontWeight: '500' },
  securityBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#e3f2fd', borderRadius: 8, padding: 12, marginBottom: 12 },
  securityQuestionText: { fontSize: 14, color: '#1565C0', fontWeight: '600', flex: 1 },
});
