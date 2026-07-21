import { Platform, PermissionsAndroid } from 'react-native';
import { Transaction } from '../types';
import { formatIQD } from '../i18n';
import { generateReceiptContent } from './printer';

let bleManagerInstance: any = null;

function getManager(): any {
  if (!bleManagerInstance) {
    try {
      const { BleManager } = require('react-native-ble-plx');
      bleManagerInstance = new BleManager();
    } catch (e) {
      console.warn('BLE module not available:', e);
      return null;
    }
  }
  return bleManagerInstance;
}

let connectedDevice: any = null;
let writeCharacteristic: any = null;

export interface PrinterDevice {
  id: string;
  name: string;
  rssi: number;
}

export async function requestBluetoothPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  if (Platform.Version >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return (
      result['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
      result['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
      result['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
    );
  } else {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
}

export async function scanForPrinters(
  onFound: (device: PrinterDevice) => void,
  durationMs: number = 10000
): Promise<void> {
  const hasPermission = await requestBluetoothPermission();
  if (!hasPermission) {
    throw new Error('Bluetooth permission denied');
  }

  const mgr = getManager();
  if (!mgr) throw new Error('Bluetooth not available on this device');
  mgr.startDeviceScan(null, null, (error: any, device: any) => {
    if (error) {
      console.warn('Scan error:', error);
      return;
    }
    if (device && device.name) {
      onFound({
        id: device.id,
        name: device.name,
        rssi: device.rssi || 0,
      });
    }
  });

  setTimeout(() => {
    const m = getManager();
    if (m) m.stopDeviceScan();
  }, durationMs);
}

export async function connectToPrinter(
  deviceId: string,
  deviceName: string
): Promise<boolean> {
  try {
    const mgr = getManager();
    if (mgr) mgr.stopDeviceScan();
    if (!mgr) throw new Error('Bluetooth not available');

    const device = await mgr.connectToDevice(deviceId);
    await device.discoverAllServicesAndCharacteristics();

    const services = await device.services();
    let foundWriteChar: any = null;

    for (const service of services) {
      const chars = await service.characteristics();
      for (const char of chars) {
        if (char.isWritableWithoutResponse || char.isWritableWithResponse) {
          foundWriteChar = char;
          break;
        }
      }
      if (foundWriteChar) break;
    }

    if (!foundWriteChar) {
      await device.cancelConnection();
      throw new Error('No writable characteristic found');
    }

    connectedDevice = device;
    writeCharacteristic = foundWriteChar;

    device.onDisconnected(() => {
      connectedDevice = null;
      writeCharacteristic = null;
    });

    return true;
  } catch (err) {
    console.warn('Connect error:', err);
    connectedDevice = null;
    writeCharacteristic = null;
    throw err;
  }
}

export async function disconnectPrinter(): Promise<void> {
  if (connectedDevice) {
    try {
      await connectedDevice.cancelConnection();
    } catch {}
    connectedDevice = null;
    writeCharacteristic = null;
  }
}

export function isConnected(): boolean {
  return connectedDevice !== null && writeCharacteristic !== null;
}

export function getConnectedPrinterName(): string | null {
  return connectedDevice?.name || null;
}

async function sendRawData(data: Uint8Array): Promise<void> {
  if (!writeCharacteristic) {
    throw new Error('Printer not connected');
  }

  const chunkSize = 20;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    const bytes = Array.from(chunk);
    if (writeCharacteristic.isWritableWithResponse) {
      await writeCharacteristic.writeWithResponse(bytes);
    } else {
      await writeCharacteristic.writeWithoutResponse(bytes);
    }
    await new Promise((r) => setTimeout(r, 30));
  }
}

function stringToBytes(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

export async function printReceipt(transaction: Transaction, storeName: string = 'كاشير - POS'): Promise<void> {
  if (!isConnected()) {
    throw new Error('Printer not connected');
  }

  const receipt = generateReceiptContent(transaction, storeName);
  const data = stringToBytes(receipt);
  await sendRawData(data);
}

export async function printTestPage(storeName: string = 'كاشير - POS'): Promise<void> {
  if (!isConnected()) {
    throw new Error('Printer not connected');
  }

  const lines = [
    '\x1b\x40',
    '\x1b\x61\x01',
    '\x1b\x45\x01',
    storeName + '\n',
    '\x1b\x45\x00',
    '================================\n',
    '\x1b\x61\x01',
    'اختبار الطباعة\n',
    'Test Print\n',
    new Date().toLocaleString('en-US') + '\n',
    '================================\n',
    '\x1b\x61\x01',
    'الطابعة تعمل بشكل صحيح ✅\n',
    'Printer is working correctly\n',
    '================================\n',
    '\x1b\x61\x01',
    'شكرا لتسوقكم\n',
    'Thank you!\n',
    '\n\n\n',
  ];

  const text = lines.join('');
  const data = stringToBytes(text);
  await sendRawData(data);
}
