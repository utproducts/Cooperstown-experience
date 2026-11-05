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
    { icon: 'map', title: 'Park map', subtitle: 'Fields, food, restrooms and more', color: C.navy, href: '/fan/map' },
    { icon: 'car', title: 'Parking', subtitle: 'Where to park when you pull in', color: C.blue, href: '/fan/map?kind=parking' },
    { icon: 'qr-code', title: 'Check-in', subtitle: 'Where to go on arrival day', color: C.red, href: '/fan/map?kind=checkin' },
    { icon: 'bus', title: 'Trolley', subtitle: 'Skip the big hills: ride the loop', color: C.navyDeep, href: '/fan/map?kind=trolley' },
  ];
  const eat: Tile[] = [
    { icon: 'fast-food', title: 'Food to your seat', subtitle: 'Concessions delivered to your seat', color: C.red, href: '/fan/food' },
    { icon: 'restaurant', title: 'Restaurants', subtitle: count('restaurant') ? `${count('restaurant')} on site · menus & tables` : 'Menus and reservations', color: C.navy, href: '/fan/restaurants' },
    { icon: 'storefront', title: 'Vendors', subtitle: count('vendor') ? `${count('vendor')} on site` : 'Who’s at the park', color: C.blue, href: '/fan/places?kind=vendor' },
    { icon: 'shirt', title: 'Shop', subtitle: 'Hats, tees, pins & more', color: C.red, href: '/fan/shop' },
  ];
  const week: Tile[] = [
    { icon: 'flag', title: 'Opening Ceremonies', subtitle: ceremony ? `${formatDay(ceremony.date)} · ${to12h(ceremony.time)} ${zoneLabel(tz)}` : 'Time, field and what to expect', color: C.red, href: '/fan/ceremony' },
    { icon: 'trophy', title: 'Skills Competition', subtitle: 'Leaders and results', color: C.navyDeep, href: '/fan/skills' },
    { icon: 'shield-checkmark', title: 'Park rules', subtitle: 'What you can and can’t bring', color: C.navyDeep, href: '/fan/rules' },
    { icon: 'list', title: 'Itinerary', subtitle: 'Day by day, with meetings and sessions', color: C.blue, href: '/fan/itinerary' },
  ];
  const around: Tile[] = [
    { icon: 'sparkles', title: 'Things to do', subtitle: 'Hall of Fame, Main Street, the lake…', color: C.red, href: '/fan/places?kind=attraction' },
    { icon: 'home', title: 'Lodging nearby', subtitle: 'Hotels, inns and rentals', color: C.navy, href: '/fan/places?kind=lodging' },
  ];

  return (
    <Screen refreshing={places.loading} onRefresh={places.refresh}>
      <DemoRoleSwitch />
      <Hero image={photo} tall eyebrow="Cooperstown All Star Village" title="The Park" subtitle="Your week, your way: get around, eat well, and don’t miss a moment." />
      {ceremony && (
        <Card style={{ backgroundColor: C.goldSoft, borderColor: '#BFE6FA' }}>
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

