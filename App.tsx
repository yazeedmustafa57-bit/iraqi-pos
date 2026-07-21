import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  I18nManager, StatusBar, Platform,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Network from 'expo-network';

import CatalogScreen from './src/screens/CatalogScreen';
import CartScreen from './src/screens/CartScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SummaryScreen from './src/screens/SummaryScreen';
import BarcodeScannerScreen from './src/screens/BarcodeScannerScreen';
import ProductManagementScreen from './src/screens/ProductManagementScreen';
import AuthScreen from './src/screens/AuthScreen';
import { useAppStore } from './src/stores/appStore';
import { useCartStore } from './src/stores/cartStore';
import { getDatabase, seedDemoProducts } from './src/database/db';
import { formatIQD } from './src/i18n';
import { syncPendingPayments } from './src/services/payments';
import { ScannerAudioView } from './src/services/scannerSound';

// Force RTL for Arabic
I18nManager.forceRTL(true);
I18nManager.allowRTL(true);

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();


class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 24 }}>
          <Ionicons name="warning-outline" size={48} color="#e65100" />
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 16, color: '#333', textAlign: 'center' }}>حدث خطأ</Text>
          <Text style={{ fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center' }}>{this.state.error}</Text>
          <TouchableOpacity
            style={{ marginTop: 20, backgroundColor: '#1a6b3c', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}
            onPress={() => this.setState({ hasError: false, error: '' })}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

function PaymentSuccessOverlay() {
  const show = useAppStore((s) => s.showPaymentSuccess);
  const lastTx = useAppStore((s) => s.lastTransaction);

  if (!show || !lastTx) return null;

  return (
    <View style={styles.successOverlay}>
      <View style={styles.successCard}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={56} color="#fff" />
        </View>
        <Text style={styles.successTitle}>تم الدفع بنجاح</Text>
        <Text style={styles.successAmount}>{formatIQD(lastTx.total)}</Text>
        <Text style={styles.successMethod}>{lastTx.paymentMethod.toUpperCase()}</Text>
        {lastTx.paymentMethod === 'cash' && lastTx.change > 0 && (
          <Text style={styles.successChange}>المتبقي: {formatIQD(lastTx.change)}</Text>
        )}
        {lastTx.status === 'pending_sync' && (
          <View style={styles.pendingBadge}>
            <Ionicons name="sync" size={14} color="#fff" />
            <Text style={styles.pendingText}> في انتظار المزامنة</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function MainTabs() {
  const itemCount = useCartStore((s) => s.getItemCount());

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any;
          if (route.name === 'Catalog') iconName = focused ? 'grid' : 'grid-outline';
          else if (route.name === 'Cart') iconName = focused ? 'cart' : 'cart-outline';
          else if (route.name === 'Summary') iconName = focused ? 'analytics' : 'analytics-outline';
          else if (route.name === 'Settings') iconName = focused ? 'settings' : 'settings-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1a6b3c',
        tabBarInactiveTintColor: '#888',
        headerShown: false,
        tabBarStyle: {
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 6,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen name="Catalog" component={CatalogScreen} options={{ tabBarLabel: 'المنتجات' }} />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          tabBarLabel: 'السلة',
          tabBarBadge: itemCount > 0 ? itemCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#1a6b3c' },
        }}
      />
      <Tab.Screen name="Summary" component={SummaryScreen} options={{ tabBarLabel: 'ملخص' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'إعدادات' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const setIsOnline = useAppStore((s) => s.setIsOnline);
  const isOnline = useAppStore((s) => s.isOnline);

  useEffect(() => {
    const init = async () => {
      try {
        await getDatabase();
        try {
          await seedDemoProducts();
        } catch (seedErr) {
          console.warn('Seed error (non-fatal):', seedErr);
        }
        setDbReady(true);
      } catch (dbErr) {
        console.error('Database init failed:', dbErr);
        setDbReady(true);
      }
    };
    init();
  }, []);

  // Network monitoring
  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        setIsOnline(state.isConnected === true);
      } catch {
        setIsOnline(false);
      }
    };

    checkNetwork();
    const interval = setInterval(checkNetwork, 5000);
    return () => clearInterval(interval);
  }, []);

  // Sync pending payments when coming online
  useEffect(() => {
    if (isOnline) {
      syncPendingPayments().catch(() => {});
    }
  }, [isOnline]);

  if (!dbReady) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>جاري التحميل...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary><View style={{ flex: 1 }}>
      {!isAuthenticated ? (
        <AuthScreen />
      ) : (
      <><ScannerAudioView />
      <NavigationContainer>
        <StatusBar barStyle="light-content" backgroundColor="#1a6b3c" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="BarcodeScanner"
            component={BarcodeScannerScreen}
            options={{ presentation: 'fullScreenModal' }}
          />
          <Stack.Screen
            name="ProductManagement"
            component={ProductManagementScreen}
            options={{ presentation: 'fullScreenModal' }}
          />
        </Stack.Navigator>
        <PaymentSuccessOverlay />
      </NavigationContainer>
      </>)}
    </View></ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a6b3c',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  successOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  successCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: 280,
  },
  successIcon: {
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a6b3c',
    marginBottom: 8,
  },
  successAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  successMethod: {
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
  },
  successChange: {
    fontSize: 16,
    color: '#e65100',
    fontWeight: '600',
    marginTop: 8,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e65100',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 12,
  },
  pendingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
