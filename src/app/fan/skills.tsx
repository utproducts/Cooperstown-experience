import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Caption, Card, Empty, Hero, Row, Screen, Segmented } from '@/components/ui';
import { C, Fonts, R, S } from '@/constants/theme';
import { useTable } from '@/data';
import { useFanData } from '@/data/fan';
import { useParkPhoto } from '@/data/venue';
import { formatDateTime } from '@/lib/time';
import { rankResults } from '@/lib/venue';

const MEDAL = ['#C9A227', '#A7B1BE', '#B87333'];

/** The week's skills competition: one leaderboard per event, your team's players highlighted. */
export default function SkillsCompetition() {
  const d = useFanData();
  const photo = useParkPhoto(2);
  const eventId = d.event?.id ?? '__none__';
  const events = useTable('skills_events', { eq: { eventId }, order: { column: 'sort' } });
  const ids = events.data.map((e) => e.id);
  const results = useTable('skills_results', { in: { column: 'skillsEventId', values: ids.length ? ids : ['__none__'] } });
  const [picked, setPicked] = useState<string | null>(null);
  const current = events.data.find((e) => e.id === picked) ?? events.data[0];
  const board = current ? rankResults(results.data.filter((r) => r.skillsEventId === current.id), current.better) : [];
  const teamName = (id: string | null) => d.teams.find((t) => t.id === id)?.name ?? '';

  return (
    <Screen refreshing={events.loading} onRefresh={() => (events.refresh(), results.refresh())}>
      <Hero image={photo} eyebrow={d.event?.name ?? 'This week'} title="Skills Competition" subtitle="Speed, power and arm strength: who’s on top this week." />
      {events.data.length === 0 ? (
        <Card>
          <Empty icon="trophy-outline" title="No skills events yet" body="Results show up here as soon as staff enter them." />
        </Card>
      ) : (
        <>
          <Segmented value={current!.id} onChange={setPicked} options={events.data.map((e) => ({ value: e.id, label: e.name }))} />
          <Card>
            <Text style={styles.event}>{current!.name}</Text>
            <Caption>
              {current!.description}
              {current!.startsAt ? ` · ${formatDateTime(current!.startsAt, d.event?.timezone)}` : ''}
              {` · ${current!.better === 'low' ? 'lowest' : 'highest'} wins`}
            </Caption>
            {board.length === 0 && <Caption>No results yet.</Caption>}
            {board.slice(0, 3).length > 0 && (
              <View style={styles.podium}>
                {board.slice(0, 3).map((r, i) => (
                  <View key={r.id} style={[styles.step, { borderColor: MEDAL[i] }]}>
                    <Text style={[styles.place, { color: MEDAL[i] }]}>{r.place}</Text>
                    <Text style={styles.name} numberOfLines={1}>
                      {r.displayName}
                    </Text>
                    <Text style={styles.value}>
                      {r.value} {current!.unit}
                    </Text>
                    <Caption numberOfLines={1}>{teamName(r.teamId)}</Caption>
                  </View>
                ))}
              </View>
            )}
            {board.slice(3).map((r) => {
              const mine = !!r.teamId && d.myTeamIds.includes(r.teamId);
              return (
                <Row key={r.id} style={[styles.row, mine && styles.mine]}>
                  <Text style={styles.rank}>{r.place}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{r.displayName}</Text>
                    <Caption>{teamName(r.teamId)}</Caption>
                  </View>
                  <Text style={styles.rowValue}>
                    {r.value} {current!.unit}
                  </Text>
                </Row>
              );
            })}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  event: { fontFamily: Fonts.display, fontSize: 22, fontWeight: '700', color: C.navy },
  podium: { flexDirection: 'row', gap: S.sm, marginVertical: S.sm },
  step: { flex: 1, borderWidth: 2, borderRadius: R.lg, padding: S.sm, alignItems: 'center', gap: 2, backgroundColor: C.card },
  place: { fontFamily: Fonts.display, fontSize: 28, fontWeight: '800' },
  name: { fontWeight: '800', color: C.ink, fontSize: 14 },
  value: { fontWeight: '800', color: C.navy, fontSize: 16 },
  row: { paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  mine: { backgroundColor: C.goldSoft, borderRadius: R.sm, paddingHorizontal: 6 },
  rank: { width: 28, fontWeight: '800', color: C.muted, fontSize: 16 },
  rowName: { fontWeight: '700', color: C.ink },
  rowValue: { fontWeight: '800', color: C.navy },
});
