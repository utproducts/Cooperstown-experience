import type { EventWeek, Player } from '../data/types';

/** What each player is handed at check-in, unless the week lists its own (settings.uniformItems). */
export const DEFAULT_UNIFORM_ITEMS = ['Jersey', 'Pants', 'Hat'];

export function uniformItems(event: Pick<EventWeek, 'settings'> | null | undefined): string[] {
  const items = (event?.settings as { uniformItems?: unknown } | null | undefined)?.uniformItems;
  return Array.isArray(items) && items.length ? items.map(String).filter(Boolean) : DEFAULT_UNIFORM_ITEMS;
}

/** Anything else handed out at check-in besides the uniform (settings.included), e.g. a wristband. */
export function includedItems(event: Pick<EventWeek, 'settings'> | null | undefined): string[] {
  const items = (event?.settings as { included?: unknown } | null | undefined)?.included;
  return Array.isArray(items) ? items.map(String).filter(Boolean) : [];
}

/** "Jersey YL · Pants YM · Hat S/M", with "—" for a size nobody entered. */
export function sizeLine(uniform: Record<string, string> | null | undefined, items: string[]): string {
  return items.map((i) => `${i} ${uniform?.[i] || '—'}`).join(' · ');
}

// Youth sizes, then adult; anything else (hat sizes like 6 7/8, odd labels) sorts after, alphabetically.
const ORDER = ['YXS', 'YS', 'YM', 'YL', 'YXL', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', 'AXS', 'AS', 'AM', 'AL', 'AXL', 'A2XL', 'S/M', 'M/L', 'L/XL'];
const rank = (s: string) => {
  const i = ORDER.indexOf(s.toUpperCase().replace(/^YOUTH\s+/, 'Y').replace(/^ADULT\s+/, 'A').replace(/\s+/g, ''));
  return i === -1 ? ORDER.length : i;
};
export const bySize = (a: string, b: string) => rank(a) - rank(b) || a.localeCompare(b, undefined, { numeric: true });

export interface ItemCount {
  item: string;
  sizes: { size: string; count: number }[];
  /** Players with no size for this item yet. */
  missing: number;
}

/** A team's bag: how many of each size, per item. */
export function sizeCounts(players: Pick<Player, 'uniform'>[], items: string[]): ItemCount[] {
  return items.map((item) => {
    const counts = new Map<string, number>();
    let missing = 0;
    for (const p of players) {
      const size = p.uniform?.[item]?.trim();
      if (size) counts.set(size, (counts.get(size) ?? 0) + 1);
      else missing++;
    }
    return { item, sizes: [...counts].map(([size, count]) => ({ size, count })).sort((a, b) => bySize(a.size, b.size)), missing };
  });
}

/** Turns a registration column like "Jersey Size" or "What is your player's pant size?" into an item name. */
export function sizeItemFromHeader(header: string): string | null {
  const h = header.toLowerCase();
  if (!/\bsize\b/.test(h)) return null;
  const m = h.match(/\b(jersey|pants?|hat|cap|belt|socks?|shirt|t-?shirt|tee|hoodie|sweatshirt|jacket|shorts|helmet|uniform)\b/);
  if (!m) return null;
  const word = m[1];
  const name = { pant: 'Pants', cap: 'Hat', sock: 'Socks', tee: 'T-shirt', tshirt: 'T-shirt', 't-shirt': 'T-shirt' }[word] ?? word[0].toUpperCase() + word.slice(1);
  return name;
}
