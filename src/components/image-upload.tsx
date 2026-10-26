import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { C, R, S } from '@/constants/theme';
import { useBackend } from '@/data';

import { imageSource } from './venue-image';
import { Button, Caption, ErrorNote } from './ui';

/** Staff: pick a picture from the phone or computer, upload it, and get its URL back. */
export function useImageUpload() {
  const backend = useBackend();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (): Promise<{ url: string; width: number; height: number } | null> => {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (res.canceled || !res.assets?.[0]) return null;
    const a = res.assets[0];
    setBusy(true);
    try {
      const url = await backend.uploadImage({ uri: a.uri, name: a.fileName ?? 'photo.jpg', type: a.mimeType ?? 'image/jpeg' });
      return { url, width: a.width, height: a.height };
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { pick, busy, error };
}

/** A picture field: preview, choose a new one, or remove it. */
export function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (url: string) => void }) {
  const up = useImageUpload();
  const src = imageSource(value);
  return (
    <View style={{ gap: 6 }}>
      <Caption style={{ fontWeight: '700', color: C.navy }}>{label}</Caption>
      {src ? <Image source={src} style={styles.preview} resizeMode="cover" /> : null}
      <View style={{ flexDirection: 'row', gap: S.sm }}>
        <Button title={src ? 'Change picture' : 'Add a picture'} icon="image" small variant="secondary" loading={up.busy} onPress={async () => { const r = await up.pick(); if (r) onChange(r.url); }} />
        {src ? <Button title="Remove" small variant="ghost" onPress={() => onChange('')} /> : null}
      </View>
      <ErrorNote message={up.error} />
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { width: '100%', height: 140, borderRadius: R.md, backgroundColor: C.cream },
});
