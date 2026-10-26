import { Pressable, StyleSheet, Text, View } from 'react-native';

import { C, R, S } from '@/constants/theme';
import { DEFAULT_TZ, to12h, zoneLabel } from '@/lib/time';

import { Icon } from './ui';

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const fromMinutes = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

/**
 * A wall-clock time picker shown as "8:00 AM ET" with earlier/later buttons. The value stays "HH:MM" (24-hour), which
 * is what the schedule engine and the database store.
 */
export function TimeSelect({
  value,
  onChange,
  label,
  step = 30,
  min = '00:00',
  max = '24:00',
  timeZone = DEFAULT_TZ,
  accessibilityLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  step?: number;
  min?: string;
  max?: string;
  timeZone?: string;
  accessibilityLabel?: string;
}) {
  const now = toMinutes(value);
  const lo = toMinutes(min);
  const hi = toMinutes(max);
  // Snap to the step first so a time like 8:10 moves to 8:00 / 8:30.
  const move = (dir: 1 | -1) => {
    const snapped = dir === 1 ? Math.floor(now / step) * step + step : Math.ceil(now / step) * step - step;
    onChange(fromMinutes(Math.min(hi, Math.max(lo, snapped))));
  };
  const name = accessibilityLabel ?? label ?? 'Time';
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.box}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${name}: earlier`} disabled={now <= lo} onPress={() => move(-1)} style={[styles.step, now <= lo && styles.off]} hitSlop={6}>
          <Icon name="remove" size={18} color={C.navy} />
        </Pressable>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit accessibilityLabel={`${name}: ${to12h(value)} ${zoneLabel(timeZone)}`}>
          {value === '24:00' ? 'Midnight' : to12h(value)} <Text style={styles.zone}>{zoneLabel(timeZone)}</Text>
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`${name}: later`} disabled={now >= hi} onPress={() => move(1)} style={[styles.step, now >= hi && styles.off]} hitSlop={6}>
          <Icon name="add" size={18} color={C.navy} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '700', color: C.navy },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    backgroundColor: C.white,
    paddingHorizontal: 4,
    minHeight: 44,
  },
  step: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: R.sm },
  off: { opacity: 0.3 },
  value: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', color: C.navy, paddingHorizontal: S.xs },
  zone: { fontSize: 12, fontWeight: '800', color: C.muted },
});
