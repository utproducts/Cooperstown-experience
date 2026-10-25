import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, MaxWidth, R, S } from '@/constants/theme';
import { useAuth, useCurrentEvent } from '@/data';
import type { EventWeek } from '@/data/types';
import { DEFAULT_TZ, localDateKey } from '@/lib/time';
import { weekRange, weekStatus } from '@/lib/weeks';

import { Sheet } from './sheet';
import { Badge, Body, Button, Caption, Icon } from './ui';

function StatusBadge({ e }: { e: EventWeek }) {
  const s = weekStatus(e, localDateKey(new Date().toISOString(), DEFAULT_TZ));
  if (s === 'current') return <Badge label="This week" tone="green" />;
  if (s === 'past') return <Badge label="Done" tone="muted" />;
  return null;
}

function WeekSheet({ onClose }: { onClose: () => void }) {
  const week = useCurrentEvent();
  const { profile } = useAuth();
  const isDirector = profile?.role === 'director';
  return (
    <Sheet visible title="Choose week" onClose={onClose}>
      {week.events.length === 0 && <Caption>No weeks yet.</Caption>}
      {week.events.map((e) => {
        const active = e.id === week.data?.id;
        return (
          <Pressable
            key={e.id}
            onPress={() => {
              week.select(e.id);
              onClose();
            }}
            style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && { opacity: 0.7 }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Body style={{ fontWeight: '700', color: active ? C.white : C.ink }}>{e.name}</Body>
              <Caption style={active ? { color: '#C9D4E5' } : undefined}>{weekRange(e)}</Caption>
            </View>
            <StatusBadge e={e} />
            {active && <Icon name="checkmark-circle" color={C.gold} size={22} />}
          </Pressable>
        );
      })}
      {week.pinned && (
        <Button
          title="Follow the current week automatically"
          variant="ghost"
          small
          onPress={() => {
            week.select(null);
            onClose();
          }}
        />
      )}
      {isDirector && (
        <Button
          title="Manage weeks"
          icon="settings"
          variant="secondary"
          onPress={() => {
            onClose();
            router.push('/director/event');
          }}
        />
      )}
    </Sheet>
  );
}

/** Full-width bar shown above every director tab: which week is being worked on. */
export function WeekBar() {
  const week = useCurrentEvent();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const e = week.data;
  return (
    <View style={[styles.bar, { paddingTop: insets.top + S.sm }]}>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [styles.barInner, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel="Change week">
        <Icon name="calendar" color={C.gold} size={18} />
        <View style={{ flex: 1 }}>
          <Text style={styles.barLabel}>WORKING ON</Text>
          <Text style={styles.barTitle} numberOfLines={1}>
            {e ? `${e.name} · ${weekRange(e)}` : 'No week selected'}
          </Text>
        </View>
        {e && <StatusBadge e={e} />}
        <Text style={styles.change}>Change</Text>
        <Icon name="chevron-down" color={C.white} size={18} />
      </Pressable>
      {open && <WeekSheet onClose={() => setOpen(false)} />}
    </View>
  );
}

/** Compact chip for stacked screen headers. */
export function WeekChip() {
  const week = useCurrentEvent();
  const [open, setOpen] = useState(false);
  if (!week.data) return null;
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.chip} accessibilityRole="button" accessibilityLabel="Change week">
        <Icon name="calendar" color={C.navy} size={14} />
        <Text style={styles.chipText} numberOfLines={1}>
          {week.data.name}
        </Text>
        <Icon name="chevron-down" color={C.navy} size={14} />
      </Pressable>
      {open && <WeekSheet onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * For families: shows which week (and dates) they're looking at; becomes a
 * switcher when they follow teams in more than one week.
 */
export function FamilyWeekLabel({ light }: { light?: boolean }) {
  const week = useCurrentEvent();
  const [open, setOpen] = useState(false);
  if (!week.data) return null;
  const multiple = week.events.length > 1;
  const color = light ? C.white : C.navy;
  const content = (
    <View style={[styles.family, light ? styles.familyLight : styles.familyDark]}>
      <Icon name="calendar" color={light ? C.gold : C.red} size={14} />
      <Text style={[styles.familyText, { color }]} numberOfLines={1}>
        {week.data.name} · {weekRange(week.data)}
      </Text>
      {multiple && <Icon name="chevron-down" color={color} size={14} />}
    </View>
  );
  return (
    <>
      {multiple ? (
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Change week">
          {content}
        </Pressable>
      ) : (
        content
      )}
      {open && <WeekSheet onClose={() => setOpen(false)} />}
    </>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: C.navyDeep, paddingHorizontal: S.lg, paddingBottom: S.sm, alignItems: 'center' },
  barInner: { flexDirection: 'row', alignItems: 'center', gap: S.sm, width: '100%', maxWidth: MaxWidth, paddingVertical: 4 },
  barLabel: { color: C.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  barTitle: { color: C.white, fontSize: 15, fontWeight: '700' },
  change: { color: '#C9D4E5', fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.md, borderRadius: R.md, backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  rowActive: { backgroundColor: C.navy, borderColor: C.navy },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 5, marginRight: S.sm, maxWidth: 200 },
  chipText: { color: C.navy, fontWeight: '700', fontSize: 13 },
  family: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill },
  familyLight: { backgroundColor: 'rgba(255,255,255,0.12)' },
  familyDark: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  familyText: { fontWeight: '700', fontSize: 13 },
});
