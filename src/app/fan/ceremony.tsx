import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Caption, Card, Empty, Hero, Icon, Row, Screen } from '@/components/ui';
import { C, Fonts, R, S } from '@/constants/theme';
import { useFanData } from '@/data/fan';
import { usePlaces, useParkPhoto } from '@/data/venue';
import { formatDay, to12h, zoneLabel } from '@/lib/time';
import { weekCeremony } from '@/lib/venue';

/** The week's Opening Ceremonies: when, which field, the run of show and what to expect. */
export default function OpeningCeremonies() {
  const d = useFanData();
  const photo = useParkPhoto(0);
  const places = usePlaces();
  const c = weekCeremony(d.event?.settings);
  const tz = zoneLabel(d.event?.timezone);
  const field = places.data.find((p) => p.id === c?.placeId);

  return (
    <Screen refreshing={d.loading} onRefresh={d.refresh}>
      <Hero image={photo} tall eyebrow={d.event?.name ?? 'This week'} title="Opening Ceremonies" subtitle={c?.headline || 'The night the week officially begins.'} />
      {!c ? (
        <Card>
          <Empty icon="flag-outline" title="Details are coming soon" body="Staff post the time and field for this week’s ceremonies here." />
        </Card>
      ) : (
        <>
          <View style={styles.facts}>
            <Fact icon="calendar" label="When" value={formatDay(c.date)} />
            <Fact icon="time" label="Starts" value={`${to12h(c.time)} ${tz}`} />
            <Fact icon="location" label="Where" value={field?.name ?? 'Main field'} />
          </View>
          {field && <Button title={`Find ${field.name} on the map`} icon="map" variant="dark" onPress={() => router.push(`/fan/map?place=${field.id}` as never)} />}
          {c.schedule.length > 0 && (
            <Card>
              <Text style={styles.cardTitle}>Run of show</Text>
              {c.schedule.map((s, i) => (
                <Row key={i} gap={S.md} style={{ alignItems: 'flex-start' }}>
                  <View style={styles.timeChip}>
                    <Text style={styles.timeText}>{to12h(s.time)}</Text>
                  </View>
                  <Text style={styles.step}>{s.title}</Text>
                </Row>
              ))}
              <Caption>All times {tz}.</Caption>
            </Card>
          )}
          {c.expect.length > 0 && (
            <Card>
              <Text style={styles.cardTitle}>What to expect</Text>
              {c.expect.map((e) => (
                <Row key={e} style={{ alignItems: 'flex-start' }}>
                  <Icon name="star" size={16} color={C.gold} />
                  <Text style={styles.step}>{e}</Text>
                </Row>
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

function Fact({ icon, label, value }: { icon: 'calendar' | 'time' | 'location'; label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={20} color={C.red} />
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  facts: { flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' },
  fact: { flexGrow: 1, flexBasis: '30%', backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, padding: S.md, gap: 2 },
  factLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: C.muted, textTransform: 'uppercase' },
  factValue: { fontFamily: Fonts.display, fontSize: 18, fontWeight: '700', color: C.navy },
  cardTitle: { fontFamily: Fonts.display, fontSize: 20, fontWeight: '700', color: C.navy },
  timeChip: { backgroundColor: C.navy, borderRadius: R.sm, paddingHorizontal: 8, paddingVertical: 4, minWidth: 78, alignItems: 'center' },
  timeText: { color: C.white, fontWeight: '800', fontSize: 13 },
  step: { flex: 1, fontSize: 16, color: C.ink, lineHeight: 22 },
});
