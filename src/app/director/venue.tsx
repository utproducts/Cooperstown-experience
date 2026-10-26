import { router } from 'expo-router';
import { View } from 'react-native';

import { Badge, Caption, Card, Divider, H1, ListItem, Screen, type IconName } from '@/components/ui';
import { useTable } from '@/data';

const OPEN = ['new', 'preparing', 'ready', 'out'];

/** Staff: everything about the park itself, in one list. */
export default function VenueHub() {
  const orders = useTable('shop_orders');
  const reservations = useTable('reservations');
  const openOrders = orders.data.filter((o) => OPEN.includes(o.status)).length;
  const toConfirm = reservations.data.filter((r) => r.status === 'requested').length;
  const groups: { title: string; items: { icon: IconName; title: string; subtitle: string; href: string; badge?: string }[] }[] = [
    {
      title: 'Live',
      items: [
        { icon: 'receipt', title: 'Orders', subtitle: 'Concession deliveries and shop pickups', href: '/director/shop-orders', badge: openOrders ? `${openOrders} open` : undefined },
        { icon: 'calendar', title: 'Reservations', subtitle: 'Restaurant table requests', href: '/director/reservations', badge: toConfirm ? `${toConfirm} to confirm` : undefined },
        { icon: 'trophy', title: 'Skills competition', subtitle: 'Events and results', href: '/director/skills' },
      ],
    },
    {
      title: 'This week',
      items: [
        { icon: 'flag', title: 'Opening Ceremonies', subtitle: 'Time, field, run of show', href: '/director/ceremony' },
        { icon: 'bed', title: 'Bunkhouses', subtitle: 'Assign teams and players', href: '/director/lodging' },
      ],
    },
    {
      title: 'The park',
      items: [
        { icon: 'map', title: 'Site map & places', subtitle: 'Map, fields, parking, trolley, vendors, restaurants, things to do, lodging', href: '/director/places' },
        { icon: 'pricetags', title: 'Shop, concessions & menus', subtitle: 'Products, prices, sizes, restaurant menus', href: '/director/products' },
        { icon: 'images', title: 'Park photos & rules', subtitle: 'Header photos and what families can bring', href: '/director/park-info' },
        { icon: 'qr-code', title: 'Seat QR codes', subtitle: 'Signs for the stands: order food to your seat', href: '/director/dugout-qr' },
      ],
    },
  ];
  return (
    <Screen refreshing={orders.loading} onRefresh={() => (orders.refresh(), reservations.refresh())}>
      <H1>Park & venue</H1>
      <Caption>Everything families see on the Park tab.</Caption>
      {groups.map((g) => (
        <Card key={g.title} style={{ gap: 0 }}>
          <Caption style={{ fontWeight: '800', letterSpacing: 1 }}>{g.title.toUpperCase()}</Caption>
          {g.items.map((it, i) => (
            <View key={it.title}>
              {i > 0 && <Divider />}
              <ListItem icon={it.icon} title={it.title} subtitle={it.subtitle} onPress={() => router.push(it.href as never)} right={it.badge ? <Badge label={it.badge} tone="red" /> : undefined} />
            </View>
          ))}
        </Card>
      ))}
    </Screen>
  );
}
