import type { IconName } from '@/components/ui';

/**
 * Week guide content. This reflects the typical Cooperstown 12U week format
 * (arrival & check-in, opening ceremonies, pool play, bracket play,
 * championship, departure). Confirm details with your tournament before
 * publishing; per-event overrides can be added to the events table later.
 */

export interface ItineraryItem {
  day: number; // 0 = arrival day
  time?: string;
  title: string;
  detail: string;
  icon: IconName;
}

export const ITINERARY: ItineraryItem[] = [
  { day: 0, time: '8:00 AM', title: 'Arrival & player check-in', detail: 'Show each player’s QR code at the check-in tent. Players receive credentials and bunk assignments.', icon: 'qr-code' },
  { day: 0, title: 'Opening Ceremonies & first pool games', detail: 'Teams parade behind their banners, then pool play starts. Check the schedule for your first game and field.', icon: 'flag' },
  { day: 0, time: '7:00 PM', title: 'Parent & coaches meetings', detail: 'Rules, bracket format and what to expect this week.', icon: 'people' },
  { day: 1, title: 'Pool play', detail: 'Games run 8 AM–10 PM on 12 fields. Up to three games a day — hydrate between games.', icon: 'baseball' },
  { day: 1, title: 'Team photos & pin trading', detail: 'Photo sessions run all day — book a slot. Pin trading starts at the pavilion each evening.', icon: 'camera' },
  { day: 2, title: 'Pool play', detail: 'Every team plays 6 pool games to set the seeding.', icon: 'baseball' },
  { day: 3, title: 'Final pool games & skills competition', detail: 'Seeds post tonight: every team advances to the Championship, Monster or Cooper bracket.', icon: 'trophy' },
  { day: 4, title: 'Bracket play', detail: 'Single elimination. A team that keeps winning can play up to four games today, and late games are possible.', icon: 'git-network' },
  { day: 5, title: 'Finals & departure', detail: 'Bracket finals, closing ceremony, then bunkhouse check-out. The next week’s teams arrive tomorrow.', icon: 'medal' },
];

export interface ChecklistItem {
  id: string;
  group: 'Forms' | 'Uniform & gear' | 'Personal';
  label: string;
}

export const CHECKLIST: ChecklistItem[] = [
  { id: 'waiver', group: 'Forms', label: 'Participation waiver signed (player, parent, coach)' },
  { id: 'medical', group: 'Forms', label: 'Health history & physical exam form' },
  { id: 'insurance', group: 'Forms', label: 'Copy of insurance card' },
  { id: 'pants', group: 'Uniform & gear', label: 'White baseball pants (knee length)' },
  { id: 'belt', group: 'Uniform & gear', label: 'Team belt, socks & 2+ jerseys' },
  { id: 'cleats', group: 'Uniform & gear', label: 'Cleats (check field rules) & turf shoes' },
  { id: 'glove', group: 'Uniform & gear', label: 'Glove, bat(s), helmet, batting gloves' },
  { id: 'catcher', group: 'Uniform & gear', label: 'Catcher’s gear (if needed)' },
  { id: 'bottle', group: 'Personal', label: 'Labeled water bottle' },
  { id: 'sun', group: 'Personal', label: 'Sunscreen, bug spray, hat' },
  { id: 'bedding', group: 'Personal', label: 'Twin bedding, pillow & towels for bunkhouse' },
  { id: 'meds', group: 'Personal', label: 'Medications in original packaging' },
  { id: 'pins', group: 'Personal', label: 'Team trading pins' },
  { id: 'cash', group: 'Personal', label: 'Spending money for concessions & store' },
];

export const FAQ: { q: string; a: string }[] = [
  { q: 'Where do we check in?', a: 'At the check-in tent near the main entrance during the arrival-day window. Each player needs their QR code (in the Player tab) — a screenshot works if the signal is weak.' },
  { q: 'Can I check in more than one player?', a: 'Yes. Each player has their own QR code in the Player tab. Use the picker at the top to switch between players.' },
  { q: 'How does the bracket work?', a: 'After 6 pool games, every team is seeded and placed in one of three single-elimination brackets: Championship (top seeds), Monster or Cooper. Every team is guaranteed at least 7 games. A team that keeps winning may play up to four games in a day, and bracket games can run past 10 PM if needed.' },
  { q: 'What happens with rain or lightning?', a: 'Play is suspended for lightning within the safety radius. Delays and new game times are pushed to everyone following the affected teams, and the schedule updates automatically.' },
  { q: 'How do I get schedule changes?', a: 'Follow your team with the code from your invitation email and allow notifications. Every delay or time change is sent to all followers of that team.' },
  { q: 'Where is the nearest airport?', a: 'Albany (ALB) is about 75 minutes away. Syracuse (SYR) and Binghamton (BGM) are also options.' },
  { q: 'Is there parking?', a: 'Yes, but lots fill early on game days. Plan to arrive 45 minutes before first pitch.' },
];

export const PLACES: { name: string; detail: string; icon: IconName; query: string }[] = [
  { name: 'National Baseball Hall of Fame', detail: '25 Main St, Cooperstown', icon: 'library', query: 'National Baseball Hall of Fame Cooperstown NY' },
  { name: 'Doubleday Field', detail: 'Historic ballpark on Main Street', icon: 'baseball', query: 'Doubleday Field Cooperstown NY' },
  { name: 'Bassett Medical Center', detail: '1 Atwell Rd · 24/7 emergency', icon: 'medkit', query: 'Bassett Medical Center Cooperstown NY' },
  { name: 'Otsego Lake', detail: 'Glimmerglass State Park beach', icon: 'boat', query: 'Glimmerglass State Park' },
];
