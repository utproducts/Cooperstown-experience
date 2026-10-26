import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { C, Fonts, R, S } from '@/constants/theme';
import type { Player, Team } from '@/data/types';
import { checkInPayload } from '@/lib/codes';
import { formatDateTime } from '@/lib/time';

import { Sheet } from './sheet';
import { Badge, Caption } from './ui';

/** Staff: a player's QR check-in pass, the same one their parent sees, to show or scan at the desk. */
export function PlayerPassSheet({ player, team, timeZone, onClose }: { player: Player; team: Team | undefined; timeZone?: string; onClose: () => void }) {
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
