// Demo-mode venue for Cooperstown All Star Village: the campus map with its places (sample-venue.json), plus sample
// menus, shop and concessions, bunkhouse assignments, park rules and skills results.
import { zonedToIso } from '../lib/time';
import type { SeedTables } from './seed';
import SAMPLE from './sample-venue.json';
import type { Place, PlaceKind, Player, Product, SkillsEvent, SkillsResult, Team, TeamLodging, VenueSetting } from './types';

type VenueTables = Pick<SeedTables, 'places' | 'venue_settings' | 'products' | 'shop_orders' | 'reservations' | 'skills_events' | 'skills_results' | 'team_lodging'>;

interface SampleSpot {
  kind: string;
  name: string;
  x?: number;
  y?: number;
  description?: string;
  hours?: string;
  website?: string;
  phone?: string;
  address?: string;
  imageUrl?: string;
  takesReservations?: boolean;
}

const place = (s: SampleSpot, i: number): Place => ({
  id: `place-${i + 1}`,
  kind: s.kind as PlaceKind,
  name: s.name,
  description: s.description ?? '',
  x: s.x ?? null,
  y: s.y ?? null,
  hours: s.hours ?? '',
  website: s.website ?? '',
  phone: s.phone ?? '',
  address: s.address ?? '',
  imageUrl: s.imageUrl ?? '',
  takesReservations: !!s.takesReservations,
  sort: i,
  active: true,
});

/** Park rules shown to families. The demo's are samples: each venue enters its own. */
export const SAMPLE_PARK_RULES = {
  sample: true,
  allowed: ['Folding chairs and blankets', 'Small soft-sided coolers (no glass)', 'Pop-up tents behind the outfield fence only', 'Umbrellas in the stands', 'Strollers and wagons', 'Refillable water bottles'],
  notAllowed: ['Alcohol from outside the park', 'Glass containers', 'Grills or open flames', 'Pets (service animals welcome)', 'Drones', 'Golf carts and scooters without a permit', 'Smoking or vaping near fields and bunkhouses'],
  notes: 'Sample rules for the demo. Ask the tournament desk if you’re not sure about something.',
};

export function buildVenueSeed({ eventId, arrival, teams, players }: { eventId: string; arrival: string; teams: Team[]; players: Player[] }): VenueTables {
  const spots = [...(SAMPLE.places as SampleSpot[]), ...(SAMPLE.around as SampleSpot[])];
  const places = spots.map(place);
  const byName = (name: string) => places.find((p) => p.name === name)!;
  const at = (dayOffset: number, time: string) => {
    const d = new Date(`${arrival}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dayOffset);
    return zonedToIso(d.toISOString().slice(0, 10), time);
  };

  const product = (p: Partial<Product> & Pick<Product, 'kind' | 'name' | 'priceCents'>, i: number): Product => ({
    id: `item-${p.kind}-${i + 1}`,
    eventId: null,
    placeId: null,
    category: '',
    description: '',
    sizes: [],
    imageUrl: '',
    active: true,
    sort: i,
    ...p,
  });
  const youthAdult = ['YS', 'YM', 'YL', 'YXL', 'AS', 'AM', 'AL', 'AXL'];
  const apparel = [
    { name: 'Village Fitted Cap', category: 'Hats', priceCents: 3200, sizes: ['6 7/8', '7', '7 1/8', '7 1/4', '7 3/8', '7 1/2'], description: 'Structured wool-blend fitted cap with the embroidered Village logo.' },
    { name: 'Adjustable Mesh Cap', category: 'Hats', priceCents: 2600, sizes: ['Youth', 'Adult'], description: 'Snapback trucker cap, one of the most popular pin-trading hats.' },
    { name: 'Week Tee', category: 'Shirts', priceCents: 2800, sizes: youthAdult, description: 'Soft tee with this week’s dates and every team on the back.' },
    { name: 'Performance Hoodie', category: 'Outerwear', priceCents: 6000, sizes: youthAdult, description: 'Lightweight hoodie for cool Cooperstown nights.' },
    { name: 'Pin Trading Lanyard', category: 'Pins', priceCents: 1500, description: 'Holds 40+ pins. Everybody trades.' },
    { name: 'Village Logo Pin', category: 'Pins', priceCents: 800, description: 'The official pin for this week.' },
  ].map((p, i) => product({ kind: 'apparel', ...p }, i));
  const concessions = [
    { name: 'Hot Dog', category: 'Food', priceCents: 500 },
    { name: 'Cheeseburger', category: 'Food', priceCents: 900 },
    { name: 'Chicken Tenders & Fries', category: 'Food', priceCents: 1100 },
    { name: 'Nachos', category: 'Food', priceCents: 800 },
    { name: 'Soft Pretzel', category: 'Snacks', priceCents: 600 },
    { name: 'Sunflower Seeds', category: 'Snacks', priceCents: 300 },
    { name: 'Gatorade', category: 'Drinks', priceCents: 400 },
    { name: 'Water', category: 'Drinks', priceCents: 300 },
    { name: 'Lemonade', category: 'Drinks', priceCents: 450 },
    { name: 'Ice Cream Sandwich', category: 'Sweets', priceCents: 400 },
  ].map((p, i) => product({ kind: 'concession', ...p }, i));
  const club = byName('The Clubhouse');
  const fresh = byName('New Restaurant');
  const menu = [
    { placeId: club.id, category: 'Starters', name: 'Wings (10)', priceCents: 1600, description: 'Buffalo, BBQ or garlic parm.' },
    { placeId: club.id, category: 'Starters', name: 'Loaded Fries', priceCents: 1100 },
    { placeId: club.id, category: 'Mains', name: 'Clubhouse Burger', priceCents: 1600, description: 'Half pound, cheddar, bacon, fries.' },
    { placeId: club.id, category: 'Mains', name: 'Chicken Caesar Wrap', priceCents: 1400 },
    { placeId: club.id, category: 'Kids', name: 'Kids Mac & Cheese', priceCents: 900 },
    { placeId: fresh.id, category: 'Pizza', name: 'Brick-oven Pepperoni', priceCents: 1800 },
    { placeId: fresh.id, category: 'Pizza', name: 'Margherita', priceCents: 1600 },
    { placeId: fresh.id, category: 'Salads', name: 'Harvest Salad', priceCents: 1300 },
    { placeId: fresh.id, category: 'Mains', name: 'Steak Frites', priceCents: 2800 },
    { placeId: fresh.id, category: 'Kids', name: 'Kids Pizza', priceCents: 1000 },
  ].map((p, i) => product({ kind: 'menu', ...p }, i));

  const bunks = places.filter((p) => p.kind === 'bunkhouse');
  const team_lodging: TeamLodging[] = teams
    .filter((t) => t.eventId === eventId)
    .map((t, i) => ({ id: t.id, teamId: t.id, placeId: bunks[i % bunks.length].id, room: `Bunkhouse ${i + 1}`, notes: '' }));

  const skills_events: SkillsEvent[] = [
    { name: 'Around the Bases', unit: 'sec', better: 'low' as const, description: 'Home to home, fastest time wins.' },
    { name: 'Pitching Velocity', unit: 'mph', better: 'high' as const, description: 'Best of three throws on the radar gun.' },
    { name: 'Home Run Derby', unit: 'HR', better: 'high' as const, description: 'Ten swings each.' },
    { name: 'Throw for Distance', unit: 'ft', better: 'high' as const, description: 'Longest throw on the fly.' },
  ].map((e, i) => ({ id: `skills-${i + 1}`, eventId, startsAt: at(3, '17:00'), placeId: byName('Field 1').id, sort: i, ...e }));
  const value = (ev: number, k: number) => [14.2 + k * 0.31, 62 - k * 1.4, 9 - (k % 9), 186 - k * 4][ev];
  const skills_results: SkillsResult[] = skills_events.flatMap((e, ev) =>
    players
      .filter((_, i) => i % 7 === ev)
      .slice(0, 10)
      .map((p, k) => ({
        id: `sr-${e.id}-${k}`,
        skillsEventId: e.id,
        teamId: p.teamId,
        playerId: p.id,
        displayName: `${p.firstName} ${p.lastName[0]}.`,
        value: Math.round(value(ev, (k * 7) % 10) * 100) / 100,
        recordedBy: 'Skills desk',
        recordedAt: at(3, '18:00'),
      })),
  );

  const venue_settings: VenueSetting[] = [
    { id: 'site_map', value: { url: 'sample:asv-site-map', width: 2000, height: 2000 } },
    { id: 'photos', value: { hero: ['sample:asv-entrance', 'sample:asv-deck', 'sample:asv-country-inn'] } },
    { id: 'park_rules', value: SAMPLE_PARK_RULES },
  ];

  return { places, venue_settings, products: [...apparel, ...concessions, ...menu], shop_orders: [], reservations: [], skills_events, skills_results, team_lodging };
}

/** The week's Opening Ceremonies, kept in the week's settings (settings.ceremony). */
export function sampleCeremony(arrival: string, fieldPlaceId: string) {
  return {
    date: arrival,
    time: '19:00',
    placeId: fieldPlaceId,
    headline: 'Every team parades in behind its banner, then the week officially begins.',
    schedule: [
      { time: '18:15', title: 'Teams line up behind their banners in the Main Lot' },
      { time: '19:00', title: 'Parade of teams onto the field' },
      { time: '19:30', title: 'National Anthem and flyover' },
      { time: '19:45', title: 'Welcome and the week’s first pitch' },
      { time: '20:15', title: 'Fireworks' },
    ],
    expect: ['Players in full uniform with their team banner', 'Families sit along the first and third base lines', 'About 90 minutes from line-up to fireworks', 'Bring a blanket: it gets cool after sunset'],
  };
}
