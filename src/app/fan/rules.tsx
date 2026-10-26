import { StyleSheet, Text, View } from 'react-native';

import { Badge, Caption, Card, Empty, Hero, Icon, Row, Screen } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { useParkPhoto, useParkRules } from '@/data/venue';

/** What families can and can't bring into the park. */
export default function ParkRules() {
  const { value: rules, loading, refresh } = useParkRules();
  const photo = useParkPhoto(2);
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Hero image={photo} eyebrow="Before you pack" title="Park rules" subtitle="What you can bring, what stays home, and how to have a great week." />
      {!rules ? (
        <Card>
          <Empty icon="shield-checkmark-outline" title="Park rules are coming soon" body="Questions before then? Ask the tournament desk." />
        </Card>
      ) : (
        <>
          {rules.sample ? <Badge label="Sample rules (demo): each venue enters its own" tone="gold" /> : null}
          <RuleList title="You can bring" tone="ok" items={rules.allowed} />
          <RuleList title="Please leave at home" tone="no" items={rules.notAllowed} />
          {rules.notes ? <Caption style={{ textAlign: 'center' }}>{rules.notes}</Caption> : null}
        </>
      )}
    </Screen>
  );
}

function RuleList({ title, tone, items }: { title: string; tone: 'ok' | 'no'; items: string[] }) {
  if (!items?.length) return null;
  const color = tone === 'ok' ? C.green : C.red;
  return (
    <Card style={{ borderTopWidth: 4, borderTopColor: color }}>
      <Row>
        <Icon name={tone === 'ok' ? 'checkmark-circle' : 'close-circle'} size={24} color={color} />
        <Text style={[styles.title, { color }]}>{title}</Text>
      </Row>
      <View style={{ gap: S.sm }}>
        {items.map((it) => (
          <Row key={it} style={{ alignItems: 'flex-start' }}>
            <Icon name={tone === 'ok' ? 'checkmark' : 'close'} size={18} color={color} />
            <Text style={styles.item}>{it}</Text>
          </Row>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800' },
  item: { flex: 1, fontSize: 16, color: C.ink, lineHeight: 22 },
});
