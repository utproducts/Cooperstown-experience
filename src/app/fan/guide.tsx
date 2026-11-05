import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Body, Card, Divider, H1, Icon, ListItem, Row, Screen, Section } from '@/components/ui';
import { FAQ, PLACES } from '@/content/guide';
import { C, S } from '@/constants/theme';

export default function Guide() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Screen>
      <H1>Week guide</H1>
      <Card>
        <ListItem icon="list" title="Itinerary" subtitle="Your week day by day, with meetings and sessions" onPress={() => router.push('/fan/itinerary' as never)} />
      </Card>

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
