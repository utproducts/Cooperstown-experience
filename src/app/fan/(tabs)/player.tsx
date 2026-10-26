import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Badge, Body, Button, Caption, Card, Empty, Eyebrow, H1, H3, Icon, ListItem, Progress, Row, Screen, Segmented, Stack } from '@/components/ui';
import { UniformHandout } from '@/components/uniform';
import { CHECKLIST } from '@/content/guide';
import { C, Fonts, R, S } from '@/constants/theme';
import { useTable } from '@/data';
import { FamilyWeekLabel } from '@/components/week-picker';
import { useFanData } from '@/data/fan';
import { usePlaces } from '@/data/venue';
import { checkInPayload } from '@/lib/codes';
import { formatDateTime, formatDay } from '@/lib/time';
import { includedItems, uniformItems } from '@/lib/uniform';

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
  const places = usePlaces();
  const lodging = useTable('team_lodging', { eq: { teamId: player?.teamId ?? '__none__' } });
  const checkinPlace = places.data.find((p) => p.kind === 'checkin' && p.active);
  // A player can be put somewhere other than the team's bunkhouse (split teams).
  const bunkId = player?.lodgingPlaceId || lodging.data[0]?.placeId || null;
  const bunk = places.data.find((p) => p.id === bunkId);
  const room = player?.lodgingPlaceId ? player.lodgingRoom : lodging.data[0]?.room;

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
  const uniform = uniformItems(event);
  const included = includedItems(event);
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
          <ListItem icon="time" title={`Departure ${formatDay(event.endsOn)}`} subtitle="Bunkhouse check-out by 10:00 AM ET" />
        </Card>
      )}

      {checkinPlace && (
        <Card>
          <Eyebrow>Where to check in</Eyebrow>
          <ListItem icon="qr-code" title={checkinPlace.name} subtitle={checkinPlace.description || 'Bring this pass on arrival day.'} onPress={() => router.push(`/fan/map?place=${checkinPlace.id}` as never)} />
        </Card>
      )}

      {bunk && (
        <Card style={{ borderLeftWidth: 4, borderLeftColor: '#8B5E3C' }}>
          <Eyebrow>Your bunkhouse</Eyebrow>
          <ListItem
            icon="bed"
            title={`${bunk.name}${room ? ` · ${room}` : ''}`}
            subtitle={bunk.description || 'Tap to see it on the park map.'}
            onPress={() => router.push(`/fan/map?place=${bunk.id}` as never)}
          />
        </Card>
      )}

      {/* Two lists on purpose: families kept packing what the Village hands out. */}
      <Card style={[styles.listCard, { borderTopColor: C.green }]}>
        <Row gap={S.sm}>
          <View style={[styles.listIcon, { backgroundColor: C.greenSoft }]}>
            <Icon name="gift" color={C.green} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.listTitle, { color: C.green }]}>What you get</Text>
            <Caption>Handed out at check-in. No need to pack these.</Caption>
          </View>
        </Row>
        <UniformHandout uniform={player.uniform} items={uniform} label={`${player.firstName.toUpperCase()}’S UNIFORM`} missingText="Size at check-in" />
        {included.length > 0 && (
          <Stack gap={4}>
            <Caption style={{ fontWeight: '800', color: C.navy, marginTop: S.xs }}>ALSO INCLUDED</Caption>
            {included.map((item) => (
              <Row key={item} gap={S.md} style={{ paddingVertical: 4 }}>
                <Icon name="checkmark-circle" color={C.green} size={20} />
                <Body style={{ flex: 1 }}>{item}</Body>
              </Row>
            ))}
          </Stack>
        )}
      </Card>

      <Card style={[styles.listCard, { borderTopColor: C.red }]}>
        <Row gap={S.sm}>
          <View style={[styles.listIcon, { backgroundColor: C.redSoft }]}>
            <Icon name="bag-handle" color={C.red} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.listTitle, { color: C.red }]}>What you need to bring</Text>
            <Caption>Pack these yourself. Tap each one as it goes in the bag.</Caption>
          </View>
          <Caption style={{ fontWeight: '800' }}>
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
  listCard: { borderTopWidth: 4 },
  listIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  listTitle: { fontFamily: Fonts.display, fontSize: 20, fontWeight: '700' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: 6 },
  roster: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
  rosterItem: { flexDirection: 'row', alignItems: 'center', gap: S.sm, width: '50%', paddingRight: S.sm },
  jersey: { width: 30, height: 30, lineHeight: 30, borderRadius: 15, backgroundColor: C.cream, textAlign: 'center', fontWeight: '800', color: C.navy, overflow: 'hidden' },
});
