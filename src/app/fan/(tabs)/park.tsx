import { router } from 'expo-router';

import { SectionTitle, TileGrid, type Tile } from '@/components/park-ui';
import { Button, Caption, Card, Hero, Row, Screen } from '@/components/ui';
import { DemoRoleSwitch } from '@/components/demo-role-switch';
import { C } from '@/constants/theme';
import { usePlaces, useParkPhoto } from '@/data/venue';
import { useFanData } from '@/data/fan';
import { formatDay, to12h, zoneLabel } from '@/lib/time';
import { weekCeremony } from '@/lib/venue';

/** Everything about the park in one place: getting around, food, things to do and the week's big moments. */
export default function ParkHub() {
  const d = useFanData();
  const photo = useParkPhoto(0);
  const places = usePlaces();
  const ceremony = weekCeremony(d.event?.settings);
  const count = (kind: string) => places.data.filter((p) => p.kind === kind).length;
  const tz = d.event?.timezone;

  const gettingHere: Tile[] = [
    { icon: 'map', title: 'Park map', subtitle: 'Fields, food, restrooms and more', color: '#2E7D32', href: '/fan/map' },
    { icon: 'car', title: 'Parking', subtitle: 'Where to park when you pull in', color: '#1F5FBF', href: '/fan/map?kind=parking' },
    { icon: 'qr-code', title: 'Check-in', subtitle: 'Where to go on arrival day', color: '#C8102E', href: '/fan/map?kind=checkin' },
    { icon: 'bus', title: 'Trolley', subtitle: 'Skip the big hills: ride the loop', color: '#C9A227', href: '/fan/map?kind=trolley' },
  ];
  const eat: Tile[] = [
    { icon: 'fast-food', title: 'Order to your dugout', subtitle: 'Concessions delivered to your field', color: '#E07A1F', href: '/fan/food' },
    { icon: 'restaurant', title: 'Restaurants', subtitle: count('restaurant') ? `${count('restaurant')} on site · menus & tables` : 'Menus and reservations', color: '#0E2340', href: '/fan/restaurants' },
    { icon: 'storefront', title: 'Vendors', subtitle: count('vendor') ? `${count('vendor')} on site` : 'Who’s at the park', color: '#7B3FA0', href: '/fan/places?kind=vendor' },
    { icon: 'shirt', title: 'Shop', subtitle: 'Hats, tees, pins & more', color: '#C8102E', href: '/fan/shop' },
  ];
  const week: Tile[] = [
    { icon: 'flag', title: 'Opening Ceremonies', subtitle: ceremony ? `${formatDay(ceremony.date)} · ${to12h(ceremony.time)} ${zoneLabel(tz)}` : 'Time, field and what to expect', color: '#B8433A', href: '/fan/ceremony' },
    { icon: 'trophy', title: 'Skills Competition', subtitle: 'Leaders and results', color: '#C9A227', href: '/fan/skills' },
    { icon: 'shield-checkmark', title: 'Park rules', subtitle: 'What you can and can’t bring', color: '#5B6B7F', href: '/fan/rules' },
    { icon: 'map-outline', title: 'Week guide', subtitle: 'Day-by-day itinerary and FAQ', color: '#0E7490', href: '/fan/guide' },
  ];
  const around: Tile[] = [
    { icon: 'sparkles', title: 'Things to do', subtitle: 'Hall of Fame, Main Street, the lake…', color: '#B45309', href: '/fan/places?kind=attraction' },
    { icon: 'home', title: 'Lodging nearby', subtitle: 'Hotels, inns and rentals', color: '#4D7C0F', href: '/fan/places?kind=lodging' },
  ];

  return (
    <Screen refreshing={places.loading} onRefresh={places.refresh}>
      <DemoRoleSwitch />
      <Hero image={photo} tall eyebrow="Cooperstown All Star Village" title="The Park" subtitle="Your week, your way: get around, eat well, and don’t miss a moment." />
      {ceremony && (
        <Card style={{ backgroundColor: C.goldSoft, borderColor: '#EAD9A0' }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Caption style={{ fontWeight: '800', letterSpacing: 1 }}>OPENING CEREMONIES</Caption>
            <Caption>
              {formatDay(ceremony.date)} · {to12h(ceremony.time)} {zoneLabel(tz)}
            </Caption>
          </Row>
          <Button title="What to expect" icon="flag" small variant="dark" onPress={() => router.push('/fan/ceremony' as never)} />
        </Card>
      )}
      <SectionTitle eyebrow="Getting around" title="Here & there" />
      <TileGrid tiles={gettingHere} />
      <SectionTitle eyebrow="Eat, drink & shop" title="Fuel up" />
      <TileGrid tiles={eat} />
      <SectionTitle eyebrow="This week" title="Big moments" />
      <TileGrid tiles={week} />
      <SectionTitle eyebrow="Around town" title="Explore Cooperstown" />
      <TileGrid tiles={around} />
    </Screen>
  );
}

