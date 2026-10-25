import { View } from 'react-native';

import { C, S } from '@/constants/theme';
import type { AppNotification } from '@/data/types';
import { relativeTime } from '@/lib/time';

import { Body, Caption, Card, H3, Icon, Row, type IconName } from './ui';

const KIND: Record<AppNotification['kind'], { icon: IconName; color: string; bg: string }> = {
  general: { icon: 'megaphone', color: C.navy, bg: '#E6ECF5' },
  weather: { icon: 'thunderstorm', color: C.warn, bg: C.warnSoft },
  schedule: { icon: 'time', color: C.red, bg: C.redSoft },
  score: { icon: 'trophy', color: C.green, bg: C.greenSoft },
  checkin: { icon: 'qr-code', color: C.navy, bg: '#E6ECF5' },
};

export function NotificationItem({ n, audience }: { n: AppNotification; audience?: string }) {
  const k = KIND[n.kind];
  return (
    <Card style={{ flexDirection: 'row', gap: S.md, alignItems: 'flex-start' }}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: k.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={k.icon} color={k.color} size={19} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <H3 style={{ flex: 1 }}>{n.title}</H3>
          <Caption>{relativeTime(n.createdAt)}</Caption>
        </Row>
        <Body>{n.body}</Body>
        {audience && <Caption>To: {audience}</Caption>}
      </View>
    </Card>
  );
}
