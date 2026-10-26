import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { C, Fonts, R, S } from '@/constants/theme';
import { useBackend } from '@/data';
import type { Player, Team } from '@/data/types';
import { checkInPayload } from '@/lib/codes';
import { formatDateTime } from '@/lib/time';

import { Sheet } from './sheet';
import { UniformHandout } from './uniform';
import { Badge, Button, Caption, ErrorNote, Field, Row } from './ui';

/** Staff: a player's QR check-in pass, the same one their parent sees, to show or scan at the desk. */
export function PlayerPassSheet({
  player,
  team,
  items,
  timeZone,
  onClose,
}: {
  player: Player;
  team: Team | undefined;
  items: string[];
  timeZone?: string;
  onClose: () => void;
}) {
  const backend = useBackend();
  // Parents render this with key={player.id}, so initial state comes straight from props.
  const [sizes, setSizes] = useState<Record<string, string>>(() => ({ ...(player.uniform ?? {}) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = items.some((i) => (sizes[i] ?? '').trim() !== (player.uniform?.[i] ?? ''));
  return (
    <Sheet visible title="Check-in pass" onClose={onClose}>
      <View style={styles.card}>
        <Text style={styles.name}>
          {player.firstName} {player.lastName}
        </Text>
        <Text style={styles.meta}>
          {team?.name}
          {player.jerseyNumber ? ` · #${player.jerseyNumber}` : ''}
        </Text>
        <View style={styles.qr}>
          <QRCode value={checkInPayload(player.checkInToken)} size={200} color={C.navy} backgroundColor={C.white} ecl="M" />
        </View>
        {player.checkedInAt ? (
          <Badge label={`Checked in · ${formatDateTime(player.checkedInAt, timeZone)}`} tone="green" icon="checkmark-circle" />
        ) : (
          <Caption style={{ color: '#C9D4E5', textAlign: 'center' }}>Not checked in yet</Caption>
        )}
      </View>
      <UniformHandout uniform={player.uniform} items={items} />
      <Row style={{ flexWrap: 'wrap' }}>
        {items.map((item) => (
          <View key={item} style={{ flexGrow: 1, minWidth: 90 }}>
            <Field label={`${item} size`} value={sizes[item] ?? ''} onChangeText={(v) => setSizes((x) => ({ ...x, [item]: v }))} autoCapitalize="characters" />
          </View>
        ))}
      </Row>
      <ErrorNote message={error} />
      <Button
        title="Save sizes"
        small
        variant="dark"
        loading={busy}
        disabled={!changed}
        onPress={async () => {
          setBusy(true);
          setError(null);
          try {
            await backend.update('players', player.id, { uniform: { ...(player.uniform ?? {}), ...sizes } });
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      <Caption>
        {player.guardianEmail
          ? `${player.guardianName ?? 'The parent'} sees this pass in the app after signing in with ${player.guardianEmail}.`
          : 'Add a parent email so the parent can see this pass in the app.'}
      </Caption>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.navy, borderRadius: R.lg, padding: S.lg, alignItems: 'center', gap: S.sm },
  name: { fontFamily: Fonts.display, fontSize: 24, fontWeight: '700', color: C.white, textAlign: 'center' },
  meta: { color: '#C9D4E5', fontWeight: '600', textAlign: 'center' },
  qr: { backgroundColor: C.white, padding: S.md, borderRadius: R.md, marginVertical: S.sm, borderWidth: 4, borderColor: C.red },
});
