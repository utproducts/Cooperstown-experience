import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Badge, Body, Button, Caption, Card, Empty, Eyebrow, H1, H2, H3, Icon, ListItem, Progress, Row, Screen, Segmented, Stack } from '@/components/ui';
import { CHECKLIST } from '@/content/guide';
import { C, Fonts, R, S } from '@/constants/theme';
import { useTable } from '@/data';
import { FamilyWeekLabel } from '@/components/week-picker';
import { useFanData } from '@/data/fan';
import { checkInPayload } from '@/lib/codes';
import { formatDateTime, formatDay } from '@/lib/time';

function useChecklist(playerId: string | undefined) {
  const key = `cxp-checklist-${playerId}`;
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!playerId) return;
    AsyncStorage.getItem(key)
      .then((raw) => setDone(raw ? JSON.parse(raw) : {}))
      .catch(() => setDone({}));
  }, [key, playerId]);
  const toggle = (id: string) => {
    const next = { ...done, [id]: !done[id] };
    setDone(next);
    AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
  };
  return { done, toggle };
}

export default function PlayerPortal() {
  const d = useFanData();
  const [selected, setSelected] = useState<string | null>(null);
  const player = d.myPlayers.find((p) => p.id === selected) ?? d.myPlayers[0];
  const team = d.teams.find((t) => t.id === player?.teamId);
  const roster = useTable('players', { eq: { teamId: player?.teamId ?? '__none__' }, order: { column: 'lastName' } });
  const { done, toggle } = useChecklist(player?.id);
  const event = d.event;

  if (!player) {
    return (
      <Screen>
        <H1>Player portal</H1>
        <Card>
          <Empty
            icon="person-circle-outline"
            title="No players linked to your account"
            body="Players are linked by the parent email used at registration. Sign in with that email to see your player’s check-in code. Following a team still gets you schedules and alerts."
            action={<Button title="Follow a team" variant="secondary" onPress={() => router.push('/fan/teams')} />}
          />
        </Card>
      </Screen>
    );
  }

  const completed = CHECKLIST.filter((c) => done[c.id]).length;
  const groups = [...new Set(CHECKLIST.map((c) => c.group))];

  return (
    <Screen>
      <H1>Player portal</H1>
      <FamilyWeekLabel />
      {d.myPlayers.length > 1 && (
        <Segmented value={player.id} onChange={setSelected} options={d.myPlayers.map((p) => ({ value: p.id, label: p.firstName }))} />
      )}

      <Card style={styles.qrCard}>
        <Eyebrow style={{ color: C.gold }}>Arrival check-in pass</Eyebrow>
        <Text style={styles.playerName}>
          {player.firstName} {player.lastName}
        </Text>
        <Text style={styles.playerMeta}>
          {team?.name}
          {player.jerseyNumber ? ` · #${player.jerseyNumber}` : ''}
        </Text>
        <View style={styles.qrWrap}>
          <QRCode value={checkInPayload(player.checkInToken)} size={210} color={C.navy} backgroundColor={C.white} ecl="M" />
        </View>
        {player.checkedInAt ? (
          <Badge label={`Checked in · ${formatDateTime(player.checkedInAt, event?.timezone)}`} tone="green" icon="checkmark-circle" />
        ) : (
          <Caption style={{ color: '#C9D4E5', textAlign: 'center' }}>
            Show this code at the check-in tent. Tip: take a screenshot in case cell service is spotty.
          </Caption>
        )}
      </Card>

      {event && (
        <Card>
          <Eyebrow>Arrival</Eyebrow>
          <ListItem icon="calendar" title={formatDay(event.startsOn)} subtitle={`Check-in ${event.checkInWindow}`} />
          <ListItem
            icon="location"
            title={event.venue}
            subtitle={event.address}
            onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(`${event.venue}, ${event.address}`)}`)}
          />
          <ListItem icon="time" title={`Departure ${formatDay(event.endsOn)}`} subtitle="Bunkhouse check-out by 10:00 AM" />
        </Card>
      )}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <H2 style={{ fontSize: 18 }}>Before you arrive</H2>
          <Caption>
            {completed}/{CHECKLIST.length}
          </Caption>
        </Row>
        <Progress value={completed / CHECKLIST.length} />
        {groups.map((g) => (
          <Stack key={g} gap={4}>
            <Caption style={{ fontWeight: '800', color: C.navy, marginTop: S.sm }}>{g.toUpperCase()}</Caption>
            {CHECKLIST.filter((c) => c.group === g).map((c) => (
              <Pressable key={c.id} onPress={() => toggle(c.id)} style={styles.checkRow} accessibilityRole="checkbox" accessibilityState={{ checked: !!done[c.id] }}>
                <Icon name={done[c.id] ? 'checkbox' : 'square-outline'} color={done[c.id] ? C.green : C.muted} size={22} />
                <Body style={[{ flex: 1 }, done[c.id] && { color: C.muted, textDecorationLine: 'line-through' }]}>{c.label}</Body>
              </Pressable>
            ))}
          </Stack>
        ))}
      </Card>

      {team && (
        <Card>
          <H3>{team.name} roster</H3>
          {team.coachName && <Caption>Head coach: {team.coachName}</Caption>}
          <View style={styles.roster}>
            {roster.data.map((p) => (
              <View key={p.id} style={styles.rosterItem}>
                <Text style={styles.jersey}>{p.jerseyNumber ?? '–'}</Text>
                <Body numberOfLines={1} style={{ flex: 1 }}>
                  {p.firstName} {p.lastName.slice(0, 1)}.
                </Body>
              </View>
            ))}
          </View>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  qrCard: { backgroundColor: C.navy, borderColor: C.navy, alignItems: 'center', paddingVertical: S.xl },
  playerName: { fontFamily: Fonts.display, fontSize: 28, fontWeight: '700', color: C.white, textAlign: 'center' },
  playerMeta: { color: '#C9D4E5', fontSize: 15, fontWeight: '600' },
  qrWrap: { backgroundColor: C.white, padding: S.lg, borderRadius: R.lg, marginVertical: S.sm, borderWidth: 4, borderColor: C.red },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: 6 },
  roster: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
  rosterItem: { flexDirection: 'row', alignItems: 'center', gap: S.sm, width: '50%', paddingRight: S.sm },
  jersey: { width: 30, height: 30, lineHeight: 30, borderRadius: 15, backgroundColor: C.cream, textAlign: 'center', fontWeight: '800', color: C.navy, overflow: 'hidden' },
});
