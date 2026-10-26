import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { C, Fonts, R, S } from '@/constants/theme';
import type { Player, Team } from '@/data/types';

import { Sheet } from './sheet';
import { UniformHandout } from './uniform';
import { Body, Button, Caption, ErrorNote, Field, Row } from './ui';

/**
 * Manual check-in: everything the desk confirms before checking a player in by hand (no pass scanned): who it is,
 * their team and jersey, the parent on file, and the uniform sizes to hand out (fixable here). Nothing is saved
 * until "Confirm check-in".
 */
export function CheckInConfirmSheet({
  player,
  team,
  items,
  onConfirm,
  onClose,
}: {
  player: Player;
  team: Team | undefined;
  items: string[];
  onConfirm: (uniform: Record<string, string>) => Promise<void>;
  onClose: () => void;
}) {
  // Parents render this with key={player.id}, so initial state comes straight from props.
  const [sizes, setSizes] = useState<Record<string, string>>(() => ({ ...(player.uniform ?? {}) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = Object.fromEntries(items.map((i) => [i, (sizes[i] ?? '').trim()]));
  const missing = items.filter((i) => !shown[i]);

  return (
    <Sheet visible title="Confirm check-in" onClose={onClose}>
      <View style={styles.card}>
        <Text style={styles.name}>
          {player.firstName} {player.lastName}
        </Text>
        <Text style={styles.meta}>
          {team?.name ?? 'Team'}
          {player.jerseyNumber ? ` · #${player.jerseyNumber}` : ''}
        </Text>
      </View>
      <View style={{ gap: 2 }}>
        <Caption>Parent / guardian on file</Caption>
        <Body style={{ fontWeight: '700' }}>{player.guardianName ?? 'None listed'}</Body>
        {player.guardianEmail ? <Caption>{player.guardianEmail}</Caption> : null}
        {player.guardianPhone ? <Caption>{player.guardianPhone}</Caption> : null}
      </View>
      <UniformHandout uniform={shown} items={items} />
      <Row style={{ flexWrap: 'wrap' }}>
        {items.map((item) => (
          <View key={item} style={{ flexGrow: 1, minWidth: 90 }}>
            <Field label={`${item} size`} value={sizes[item] ?? ''} onChangeText={(v) => setSizes((x) => ({ ...x, [item]: v }))} autoCapitalize="characters" />
          </View>
        ))}
      </Row>
      {missing.length > 0 && <Caption style={{ color: C.warn, fontWeight: '700' }}>No size yet for {missing.join(', ')}. Add it above or check in anyway.</Caption>}
      <ErrorNote message={error} />
      <Button
        title="Confirm check-in"
        icon="checkmark-circle"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          setError(null);
          try {
            await onConfirm({ ...(player.uniform ?? {}), ...shown });
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button title="Cancel" variant="ghost" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.navy, borderRadius: R.lg, padding: S.lg, alignItems: 'center', gap: 4 },
  name: { fontFamily: Fonts.display, fontSize: 24, fontWeight: '700', color: C.white, textAlign: 'center' },
  meta: { color: '#C9D4E5', fontWeight: '600', textAlign: 'center' },
});
