// Web QR scanning: browsers without a built-in barcode reader (iPhone Safari, desktop Firefox) use expo-camera's
// zxing-wasm fallback. Load its reader from this site rather than a public CDN, so the gate doesn't depend on one.
import { setZXingModuleOverrides } from 'barcode-detector';

const wasmPath = process.env.EXPO_PUBLIC_ZXING_WASM_PATH;
if (wasmPath) {
  setZXingModuleOverrides({
    locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmPath : prefix + path),
  });
}

export {};
