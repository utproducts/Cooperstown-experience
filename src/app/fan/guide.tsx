import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Badge, Body, Caption, Card, Divider, H1, H3, Icon, ListItem, Row, Screen, Section } from '@/components/ui';
import { FAQ, ITINERARY, PLACES } from '@/content/guide';
import { C, S } from '@/constants/theme';
import { useFanData } from '@/data/fan';
import { dateRange, formatDay, localDateKey } from '@/lib/time';

export default function Guide() {
  const { event } = useFanData();
  const [open, setOpen] = useState<number | null>(0);
  const days = event ? dateRange(event.startsOn, event.endsOn) : [];
  const today = localDateKey(new Date().toISOString(), event?.timezone);

  return (
    <Screen>
      <H1>Week guide</H1>
      <Section title="Itinerary">
        {[...new Set(ITINERARY.map((i) => i.day))].map((day) => {
          const date = days[day];
          const isToday = date === today;
          return (
            <Card key={day} style={isToday ? { borderColor: C.red, borderWidth: 2 } : undefined}>
              <Row style={{ justifyContent: 'space-between' }}>
                <H3>
                  Day {day + 1}
                  {date ? ` · ${formatDay(date)}` : ''}
                </H3>
                {isToday && <Badge label="Today" tone="red" />}
              </Row>
              {ITINERARY.filter((i) => i.day === day).map((i) => (
                <Row key={i.title} gap={S.md} style={{ alignItems: 'flex-start' }}>
                  <Icon name={i.icon} color={C.navy} />
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontWeight: '700' }}>
                      {i.time ? `${i.time} · ` : ''}
                      {i.title}
                    </Body>
                    <Caption>{i.detail}</Caption>
                  </View>
                </Row>
              ))}
            </Card>
          );
        })}
        <Caption>Times are typical for the week and may change — the Schedule and Alerts tabs are always current.</Caption>
      </Section>

      <Section title="FAQ">
        <Card style={{ gap: 0 }}>
          {FAQ.map((f, i) => (
            <View key={f.q}>
              {i > 0 && <Divider />}
              <Pressable onPress={() => setOpen(open === i ? null : i)} style={{ paddingVertical: S.md, gap: S.xs }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Body style={{ fontWeight: '700', flex: 1 }}>{f.q}</Body>
                  <Icon name={open === i ? 'chevron-up' : 'chevron-down'} color={C.muted} size={18} />
                </Row>
                {open === i && <Body style={{ color: C.muted }}>{f.a}</Body>}
              </Pressable>
            </View>
          ))}
        </Card>
      </Section>

      <Section title="Around Cooperstown">
        <Card style={{ gap: 0 }}>
          {PLACES.map((p, i) => (
            <View key={p.name}>
              {i > 0 && <Divider />}
              <ListItem
                icon={p.icon}
                title={p.name}
                subtitle={p.detail}
                onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(p.query)}`)}
              />
            </View>
          ))}
        </Card>
      </Section>
    </Screen>
  );
}
