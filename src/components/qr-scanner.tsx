// Native QR scanner (iOS / Android apps): the platform camera and barcode reader. The web build uses qr-scanner.web.tsx.
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { C, R, S } from '@/constants/theme';

import { Button, Caption } from './ui';

export function QrScanner({ onScan, onStop }: { onScan: (value: string) => void; onStop: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);
  return (
    <View style={{ gap: S.sm }}>
      <View style={styles.box}>
        {permission?.granted ? (
          <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => onScan(data)} />
        ) : (
          <Caption style={{ color: '#C9D4E5', textAlign: 'center', padding: S.lg }}>
            {permission && !permission.canAskAgain ? 'Camera access is off. Turn it on in Settings, or check players in by hand below.' : 'Allow camera access to scan passes.'}
          </Caption>
        )}
        {permission?.granted && <View pointerEvents="none" style={styles.reticle} />}
      </View>
      <Button title="Stop scanner" icon="stop-circle" variant="secondary" small onPress={onStop} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 320, backgroundColor: C.navy, borderRadius: R.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  reticle: { position: 'absolute', top: 60, left: '50%', marginLeft: -100, width: 200, height: 200, borderWidth: 3, borderColor: C.red, borderRadius: R.lg },
});
