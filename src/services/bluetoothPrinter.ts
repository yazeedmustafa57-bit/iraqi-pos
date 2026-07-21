import { BleManager, Device, Characteristic } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { Transaction } from '../types';
import { formatIQD } from '../i18n';
import { generateReceiptContent } from './printer';

const manager = new BleManager();

let connectedDevice: Device | null = null;
let writeCharacteristic: Characteristic | null = null;

// Common thermal printer service/characteristic UUIDs
const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb',  // Common ESC/POS
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',  // Microair
  '0000ffe0-0000-1000-8000-00805f9b34fb',  // CC2540
  '0000fee7-0000-1000-8000-00805f9b34fb',  // Chinese printers
];

const PRINTER_WRITE_CHAR_UUIDS = [
  '00002af0-0000-1000-8000-00805f9b34fb',
  '49535343-1e8d-4ae5-8fa9-9fafd205e455',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '0000fee9-0000-1000-8000-00805f9b34fb',
];

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

  manager.startDeviceScan(null, null, (error, device) => {
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
    manager.stopDeviceScan();
  }, durationMs);
}

export async function connectToPrinter(
  deviceId: string,
  deviceName: string
): Promise<boolean> {
  try {
    manager.stopDeviceScan();

    const device = await manager.connectToDevice(deviceId);
    await device.discoverAllServicesAndCharacteristics();

    const services = await device.services();
    let foundWriteChar: Characteristic | null = null;

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

    // Monitor disconnection
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

  // Send in chunks of 20 bytes (BLE MTU limitation)
  const chunkSize = 20;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    const bytes = Array.from(chunk);
    if (writeCharacteristic.isWritableWithResponse) {
      await (writeCharacteristic as any).writeWithResponse(bytes);
    } else {
      await (writeCharacteristic as any).writeWithoutResponse(bytes);
    }
    // Small delay between chunks
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
    '\x1b\x40',           // Initialize
    '\x1b\x61\x01',       // Center align
    '\x1b\x45\x01',       // Bold on
    storeName + '\n',
    '\x1b\x45\x00',       // Bold off
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
