import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { useImageUpload } from '@/components/image-upload';
import { imageSource } from '@/components/venue-image';
import { Button, Caption, Card, ErrorNote, Field, H1, H2, Row, Screen, showMessage } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { useBackend } from '@/data';
import { useParkRules, useVenueSetting } from '@/data/venue';
import type { ParkRules } from '@/lib/venue';

/** Staff: the park photos behind headers across the app, and the park rules. */
export default function ParkInfo() {
  const backend = useBackend();
  const photos = useVenueSetting<{ hero?: string[] }>('photos');
  const rules = useParkRules();
  const up = useImageUpload();
  const list = photos.value?.hero ?? [];
  const savePhotos = (hero: string[]) => backend.update('venue_settings', 'photos', { id: 'photos', value: { hero } }).then(photos.refresh);

  return (
    <Screen>
      <H1>Park photos & rules</H1>
      <Card>
        <H2 style={{ fontSize: 18 }}>Park photos</H2>
        <Caption>Big, bright photos of the park. They show behind headers on Home, the Park tab and more. Wide (landscape) photos work best.</Caption>
        <View style={styles.grid}>
          {list.map((url, i) => (
            <View key={url + i} style={styles.tile}>
              <Image source={imageSource(url)!} style={styles.photo} resizeMode="cover" />
              <Row gap={4}>
                {i > 0 && <Button title="◀" small variant="secondary" onPress={() => savePhotos(list.map((u, j) => (j === i - 1 ? list[i] : j === i ? list[i - 1] : u)))} />}
                <Button title="Remove" small variant="ghost" onPress={() => savePhotos(list.filter((_, j) => j !== i))} />
              </Row>
            </View>
          ))}
        </View>
        <Button
          title="Add a photo"
          icon="image"
          small
          loading={up.busy}
          onPress={async () => {
            const r = await up.pick();
            if (r) await savePhotos([...list.filter((u) => !u.startsWith('sample:')), r.url]);
          }}
        />
        {list.some((u) => u.startsWith('sample:')) && <Caption>Sample art is shown until you add your own photos.</Caption>}
        <ErrorNote message={up.error} />
      </Card>
      {!rules.loading && <RulesForm key={JSON.stringify(rules.value ?? {})} rules={rules.value} onSaved={rules.refresh} />}
    </Screen>
  );
}

function RulesForm({ rules, onSaved }: { rules: ParkRules | null; onSaved: () => void }) {
  const backend = useBackend();
  // Keyed by the saved rules, so the form starts from them.
  const [allowed, setAllowed] = useState((rules?.allowed ?? []).join('\n'));
  const [notAllowed, setNotAllowed] = useState((rules?.notAllowed ?? []).join('\n'));
  const [notes, setNotes] = useState(rules?.notes ?? '');
  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
  return (
    <Card>
      <H2 style={{ fontSize: 18 }}>Park rules</H2>
      <Caption>One item per line. Families see these under Park → Park rules.</Caption>
      <Field label="You can bring" value={allowed} onChangeText={setAllowed} multiline placeholder={'Folding chairs\nSoft-sided coolers'} />
      <Field label="Please leave at home" value={notAllowed} onChangeText={setNotAllowed} multiline placeholder={'Glass containers\nPets'} />
      <Field label="Note at the bottom (optional)" value={notes} onChangeText={setNotes} />
      <Button
        title="Save park rules"
        onPress={async () => {
          await backend.update('venue_settings', 'park_rules', { id: 'park_rules', value: { allowed: lines(allowed), notAllowed: lines(notAllowed), notes: notes.trim() } });
          onSaved();
          showMessage('Saved', 'Families see the new park rules now.');
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  tile: { width: 150, gap: 4 },
  photo: { width: 150, height: 90, borderRadius: R.md, backgroundColor: C.cream },
});
