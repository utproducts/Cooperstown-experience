import { StyleSheet, Text, View } from 'react-native';

import { C, R, S } from '@/constants/theme';
import type { Player } from '@/data/types';
import { sizeCounts } from '@/lib/uniform';

import { Caption } from './ui';

/** At the desk: what to hand this player, one big tile per item. */
export function UniformHandout({ uniform, items }: { uniform: Record<string, string> | undefined; items: string[] }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>HAND OUT</Text>
      <View style={styles.tiles}>
        {items.map((item) => {
          const size = uniform?.[item]?.trim();
          return (
            <View key={item} style={[styles.tile, !size && styles.tileMissing]}>
              <Text style={styles.item}>{item}</Text>
              <Text style={[styles.size, !size && { color: C.warn }]}>{size || 'No size'}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** A team's bag: how many of each size per item, and who still needs a size. */
export function TeamBag({ players, items }: { players: Pick<Player, 'uniform'>[]; items: string[] }) {
  if (!players.length) return <Caption>No players on this roster yet, so no sizes to pack.</Caption>;
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.label}>TEAM BAG · {players.length} PLAYERS</Text>
      {sizeCounts(players, items).map((c) => (
        <Text key={c.item} style={styles.bagRow}>
          <Text style={{ fontWeight: '800' }}>{c.item}: </Text>
          {c.sizes.length ? c.sizes.map((s) => `${s.count} ${s.size}`).join(' · ') : 'none'}
          {c.missing ? <Text style={{ color: C.warn, fontWeight: '700' }}>{`  (${c.missing} without a size)`}</Text> : null}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: C.muted },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  tile: { minWidth: 88, flexGrow: 1, backgroundColor: C.white, borderColor: C.border, borderWidth: 1, borderRadius: R.md, paddingVertical: S.sm, paddingHorizontal: S.md, alignItems: 'center' },
  tileMissing: { borderColor: C.warn, backgroundColor: C.warnSoft },
  item: { fontSize: 13, fontWeight: '700', color: C.muted },
  size: { fontSize: 24, fontWeight: '800', color: C.navy },
  bagRow: { fontSize: 14, color: C.ink },
});
