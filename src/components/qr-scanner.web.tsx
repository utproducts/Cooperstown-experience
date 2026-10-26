// Web QR scanner: the camera through getUserMedia, read with the browser's own BarcodeDetector when it has one
// (Chrome on Android, Safari 17+ on Mac) or the zxing reader shipped with the site otherwise (src/lib/scanner-setup).
// Every failure is shown on screen with what to do, and "Use a photo" works even where live video doesn't.
import { BarcodeDetector as ZxingDetector, setZXingModuleOverrides } from 'barcode-detector';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { C, R, S } from '@/constants/theme';

import { Button, Caption } from './ui';

const wasmPath = process.env.EXPO_PUBLIC_ZXING_WASM_PATH;
if (wasmPath) setZXingModuleOverrides({ locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmPath : prefix + path) });

interface Detector {
  detect(source: CanvasImageSource | ImageBitmap): Promise<{ rawValue: string }[]>;
}

async function makeDetector(): Promise<Detector> {
  const Native = (globalThis as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<readonly string[]> } }).BarcodeDetector;
  if (Native) {
    try {
      const formats = (await Native.getSupportedFormats?.()) ?? ['qr_code'];
      if (formats.includes('qr_code')) return new Native({ formats: ['qr_code'] });
    } catch {
      // fall through to zxing
    }
  }
  return new ZxingDetector({ formats: ['qr_code'] });
}

function cameraError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Camera access is blocked for this site. On iPhone: Settings → Safari → Camera → Allow (or tap “aA” in the address bar → Website Settings → Camera). On Android Chrome: tap the lock icon by the address → Permissions → Camera. Then tap Start scanner again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this device. Tap “Use a photo”, or check players in by hand below.';
  if (name === 'NotReadableError' || name === 'AbortError') return 'The camera is busy in another app or tab. Close it there, then tap Start scanner again.';
  return `The camera didn’t start (${name ?? String(e)}). Try “Use a photo”, or check players in by hand below.`;
}

export function QrScanner({ onScan, onStop }: { onScan: (value: string) => void; onStop: () => void }) {
  const video = useRef<HTMLVideoElement | null>(null);
  const file = useRef<HTMLInputElement | null>(null);
  const detector = useRef<Promise<Detector> | null>(null);
  const onScanRef = useRef(onScan);
  const [state, setState] = useState<'starting' | 'live' | 'error'>('starting');
  const [error, setError] = useState<string | null>(null);
  const [photoNote, setPhotoNote] = useState<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  });

  const getDetector = () => (detector.current ??= makeDetector());

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(window.isSecureContext ? 'This browser can’t use the camera. Tap “Use a photo” instead.' : 'The camera only works on a secure (https) page.');
        setState('error');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      } catch (e) {
        if ((e as { name?: string }).name === 'OverconstrainedError') {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
          } catch (e2) {
            setError(cameraError(e2));
            setState('error');
            return;
          }
        } else {
          setError(cameraError(e));
          setState('error');
          return;
        }
      }
      if (stopped || !video.current) return stream?.getTracks().forEach((t) => t.stop());
      const v = video.current;
      v.srcObject = stream;
      try {
        await v.play();
      } catch {
        // iOS can refuse autoplay until the element is muted and inline (it is); the frames still arrive.
      }
      setState('live');
      const d = await getDetector();
      const tick = async () => {
        if (stopped) return;
        try {
          if (v.readyState >= 2 && v.videoWidth > 0) {
            const codes = await d.detect(v);
            if (codes[0]?.rawValue) onScanRef.current(codes[0].rawValue);
          }
        } catch {
          // a frame that can't be read; keep going
        }
        timer = setTimeout(tick, 250);
      };
      tick();
    })();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function fromPhoto(f: File | undefined) {
    if (!f) return;
    setPhotoNote('Reading the photo…');
    try {
      const bitmap = await createImageBitmap(f);
      const codes = await (await getDetector()).detect(bitmap);
      if (codes[0]?.rawValue) {
        setPhotoNote(null);
        onScanRef.current(codes[0].rawValue);
      } else setPhotoNote('No QR code found in that photo. Fill the frame with the code and try again.');
    } catch (e) {
      setPhotoNote(`Couldn’t read that photo (${(e as Error).message}).`);
    }
  }

  return (
    <View style={{ gap: S.sm }}>
      <View style={styles.box}>
        <video ref={video} muted playsInline autoPlay style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: state === 'error' ? 'none' : 'block' }} />
        {state === 'live' && <View pointerEvents="none" style={styles.reticle} />}
        {state === 'starting' && <Text style={styles.overlay}>Starting the camera…</Text>}
        {state === 'error' && (
          <View style={styles.errorBox}>
            <Text style={[styles.overlay, { position: 'relative' }]}>Camera not available</Text>
            <Caption style={{ color: '#C9D4E5', textAlign: 'center' }}>{error}</Caption>
          </View>
        )}
      </View>
      <input ref={file} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => fromPhoto(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
      <View style={{ flexDirection: 'row', gap: S.sm }}>
        <Button title="Use a photo" icon="camera" variant="secondary" small style={{ flex: 1 }} onPress={() => file.current?.click()} />
        <Button title="Stop scanner" icon="stop-circle" variant="secondary" small style={{ flex: 1 }} onPress={onStop} />
      </View>
      {photoNote && <Caption>{photoNote}</Caption>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 320, backgroundColor: C.navy, borderRadius: R.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  reticle: { position: 'absolute', top: 60, left: '50%', marginLeft: -100, width: 200, height: 200, borderWidth: 3, borderColor: C.red, borderRadius: R.lg },
  overlay: { position: 'absolute', color: C.white, fontWeight: '700', textAlign: 'center' },
  errorBox: { padding: S.lg, gap: S.sm, alignItems: 'center' },
});
