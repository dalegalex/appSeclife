import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerOptions,
  CapacitorBarcodeScannerScanResult,
} from '@capacitor/barcode-scanner';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface SeclifeQrScannerPlugin {
  scan(options: { scanInstructions?: string }): Promise<CapacitorBarcodeScannerScanResult>;
}

const SeclifeQrScanner = registerPlugin<SeclifeQrScannerPlugin>('SeclifeQrScanner');

export function scanQrCode(
  options: CapacitorBarcodeScannerOptions
): Promise<CapacitorBarcodeScannerScanResult> {
  if (Capacitor.getPlatform() === 'ios') {
    return SeclifeQrScanner.scan({ scanInstructions: options.scanInstructions });
  }

  return CapacitorBarcodeScanner.scanBarcode(options);
}
