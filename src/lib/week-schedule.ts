// Ported from utproducts/cooperstown lib/week-schedule.ts (commit 57748fa), the schedule engine tested on the real
// Week 1 2027 teams. Keep the two in step: change the rules there first, then port.

// A week-long tournament schedule (Chad, 2026-10-16, for Cooperstown All Star Village): every team plays a set number
// of pool games, then EVERY team goes into one single-elimination bracket seeded from pool play, so each team is
// guaranteed pool games + 1. Pure: it takes teams and settings and returns games; nothing here touches the database,
// so it can be tried on a real week's teams before anything is saved.
//
// Pool play: rounds of pairings (each round, every team plays once), never the same opponent twice and never a team
// from the same club; opponents from another state are preferred. Games go into time slots in order, filling every
// field, with each team resting at least `restSlots` slots between games and playing at most `maxPerDay` a day.
// Brackets: seeds split down a list of brackets (best first); each the next power of two with byes for its top seeds,
// rounds after pool play, each game after the games feeding it.

export type WeekTeam = { id: string; name: string; club: string; state: string };
export type WeekDay = { date: string; start: string; end: string; pool: boolean; bracket: boolean };
export type WeekSettings = { fields: string[]; days: WeekDay[]; slotMinutes: number; poolGames: number; maxPerDay: number; restSlots: number; seed?: number;
  /** Bracket games a team may play in a day (a team that keeps winning); defaults to maxPerDay. */
  bracketMaxPerDay?: number;
  /** The brackets everyone goes into after pool play, best pool records first (e.g. Championship, Monster, Cooper). */
  brackets?: string[] };
export type Slot = { day: number; date: string; time: string; index: number };
export type WeekGame = {
  stage: 'pool' | 'bracket'; round: number; label: string; bracket?: string; slot: Slot; field: string;
  home: string | null; away: string | null; homeFrom: string; awayFrom: string; key: string;
};
export type BracketInfo = { name: string; teams: number; size: number; byes: number; seeds: string };
export type WeekPlan = { games: WeekGame[]; slots: Slot[]; problems: string[]; brackets: BracketInfo[] };

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Every start time of every day, in order (a game must finish by the day's end). */
export function weekSlots(days: WeekDay[], slotMinutes: number): Slot[] {
  const out: Slot[] = [];
  days.forEach((d, day) => {
    for (let m = toMin(d.start); m + slotMinutes <= toMin(d.end); m += slotMinutes) out.push({ day, date: d.date, time: toTime(m), index: out.length });
  });
  return out;
}

/** A small seeded random, so the same teams and settings always give the same schedule. */
function rng(seed: number) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** `rounds` rounds of pairings: no repeats, no same club, other states preferred. Tries again with a new shuffle if stuck.
 *  With an odd number of teams one team sits out each round (a different one each time), and those teams then play
 *  each other in a make-up round, so every team still gets its games (one plays an extra game if `rounds` is odd). */
export function poolPairings(teams: WeekTeam[], rounds: number, seed = 7): { pairs: [string, string][][]; problems: string[] } {
  const BYE = '\u0000';
  const odd = teams.length % 2 === 1;
  const ids = [...teams.map((t) => t.id), ...(odd ? [BYE] : [])], byId = new Map(teams.map((t) => [t.id, t]));
  const played = new Set<string>();
  const satOut: string[] = [];
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const sameClub = (a: string, b: string) => { if (a === BYE || b === BYE) return false; const x = norm(byId.get(a)!.club), y = norm(byId.get(b)!.club); return Boolean(x) && x === y; };
  const sameState = (a: string, b: string) => a !== BYE && b !== BYE && byId.get(a)!.state === byId.get(b)!.state;
  const allowed = (a: string, b: string) => a !== b && !played.has(key(a, b)) && !sameClub(a, b) && !((a === BYE && satOut.includes(b)) || (b === BYE && satOut.includes(a)));
  const rand = rng(seed);
  const out: [string, string][][] = [];
  const problems: string[] = [];
  for (let r = 0; r < rounds; r++) {
    let best: [string, string][] | null = null;
    for (let attempt = 0; attempt < 400 && !best; attempt++) {
      const pool = [...ids].sort(() => rand() - 0.5);
      // The stand-in goes first, so the team sitting out is picked while there's still a choice.
      if (odd) pool.sort((x, y) => Number(y === BYE) - Number(x === BYE));
      const round: [string, string][] = [];
      const used = new Set<string>();
      let ok = true;
      for (const a of pool) {
        if (used.has(a)) continue;
        const choices = pool.filter((b) => !used.has(b) && allowed(a, b));
        if (!choices.length) { ok = false; break; }
        // Out-of-state first (the point of a week like Cooperstown is meeting new teams), then any.
        const pick = choices.find((b) => !sameState(a, b)) ?? choices[0];
        used.add(a); used.add(pick); round.push([a, pick]);
      }
      if (ok) best = round;
    }
    if (!best) { problems.push(`Pool round ${r + 1}: couldn’t pair every team without a repeat or a same-club game.`); break; }
    for (const [a, b] of best) played.add(key(a, b));
    const bye = best.find((p) => p.includes(BYE));
    if (bye) satOut.push(bye[0] === BYE ? bye[1] : bye[0]);
    out.push(best.filter((p) => !p.includes(BYE)));
  }
  if (satOut.length) {
    // The make-up round: the teams that sat out play each other; if one is left over it plays a team already done.
    const left = [...satOut], makeUp: [string, string][] = [];
    while (left.length > 1) {
      const a = left.shift()!;
      const i = left.findIndex((b) => allowed(a, b));
      if (i < 0) { left.unshift(a); break; }
      const [b] = left.splice(i, 1);
      makeUp.push([a, b]); played.add(key(a, b));
    }
    for (const a of left) {
      const b = teams.map((t) => t.id).find((t) => !left.includes(t) && allowed(a, t));
      if (!b) { problems.push(`${byId.get(a)!.name} is a pool game short: no opponent left it hasn’t played.`); continue; }
      makeUp.push([a, b]); played.add(key(a, b));
      problems.push(`An odd number of teams: ${byId.get(b)!.name} plays one extra pool game so ${byId.get(a)!.name} gets all of theirs.`);
    }
    if (makeUp.length) out.push(makeUp);
  }
  return { pairs: out, problems };
}

const roundName = (left: number) => (left === 2 ? 'Championship' : left === 4 ? 'Semifinal' : left === 8 ? 'Quarterfinal' : `Round of ${left}`);
function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) { const n = order.length * 2; order = order.flatMap((s) => [s, n + 1 - s]); }
  return order;
}

/** Sets home and away so every team is home as often as away (one off at most, when it plays an odd number): walks
 *  each team's games as one loop through the teams, home on the way out, away on the way back. */
export function balanceHomeAway(games: WeekGame[]) {
  const pool = games.filter((g) => g.stage === 'pool');
  const edges: { a: string; b: string; g: WeekGame | null }[] = pool.map((g) => ({ a: g.home!, b: g.away!, g }));
  const count = new Map<string, number>();
  for (const e of edges) for (const t of [e.a, e.b]) count.set(t, (count.get(t) ?? 0) + 1);
  // Teams with an odd number of games pair up through a stand-in, so every team's games can be walked in and out.
  for (const t of [...count.keys()].filter((t) => count.get(t)! % 2)) edges.push({ a: t, b: '\u0000', g: null });
  const at = new Map<string, number[]>();
  edges.forEach((e, i) => { for (const t of [e.a, e.b]) at.set(t, [...(at.get(t) ?? []), i]); });
  const used = new Set<number>();
  for (const startTeam of at.keys()) {
    // Walk from this team until stuck; each loop closes on itself because every team has an even number of games.
    let t = startTeam;
    for (;;) {
      const list = at.get(t)!;
      while (list.length && used.has(list[list.length - 1])) list.pop();
      if (!list.length) break;
      const i = list.pop()!; used.add(i);
      const e = edges[i], other = e.a === t ? e.b : e.a;
      if (e.g) { e.g.home = t; e.g.away = other; }
      t = other;
    }
  }
}

/** The whole week: pool games placed in slots, then the bracket after them. */
export function planWeek(teams: WeekTeam[], s: WeekSettings): WeekPlan {
  const problems: string[] = [];
  const slots = weekSlots(s.days, s.slotMinutes);
  const { pairs, problems: pp } = poolPairings(teams, s.poolGames, s.seed ?? 7);
  problems.push(...pp);
  const games: WeekGame[] = [];
  const busy = new Map<string, number[]>(); // team → slot indexes it plays
  const playsOn = (t: string, day: number) => (busy.get(t) ?? []).filter((i) => slots[i].day === day).length;
  const rested = (t: string, slot: Slot) => (busy.get(t) ?? []).every((i) => Math.abs(i - slot.index) > s.restSlots || slots[i].day !== slot.day);
  const book = (t: string, i: number) => busy.set(t, [...(busy.get(t) ?? []), i]);

  // Pool play: earliest round first; each slot takes up to one game per field.
  const pending = pairs.flatMap((round, r) => round.map(([a, b], i) => ({ r, a: i % 2 ? b : a, b: i % 2 ? a : b })));
  const poolSlots = slots.filter((x) => s.days[x.day].pool);
  let lastPool = -1;
  for (const slot of poolSlots) {
    if (!pending.length) break;
    let onField = 0;
    for (let i = 0; i < pending.length && onField < s.fields.length; ) {
      const g = pending[i];
      const can = [g.a, g.b].every((t) => !(busy.get(t) ?? []).includes(slot.index) && rested(t, slot) && playsOn(t, slot.day) < s.maxPerDay)
        // Don't let a team run ahead: a game waits until both teams have played their earlier rounds.
        && pending.slice(0, i).every((p) => ![p.a, p.b].some((t) => t === g.a || t === g.b));
      if (!can) { i++; continue; }
      games.push({ stage: 'pool', round: 0, label: `Pool game ${g.r + 1}`, slot, field: s.fields[onField], home: g.a, away: g.b, homeFrom: '', awayFrom: '', key: `p${games.length}` });
      book(g.a, slot.index); book(g.b, slot.index);
      pending.splice(i, 1); onField++; lastPool = slot.index;
    }
  }
  balanceHomeAway(games);
  if (pending.length) problems.push(`${pending.length} pool games didn’t fit. Add hours, a day or fields, or fewer pool games.`);

  // Brackets: everyone in. Seeds go down the list of brackets in order (the best pool records in the first one), split
  // as evenly as possible; in each bracket the top seeds get byes. All brackets play their rounds side by side.
  const n = teams.length;
  const names = s.brackets?.length ? s.brackets : ['Bracket'];
  const counts = names.map((_, i) => Math.floor(n / names.length) + (i < n % names.length ? 1 : 0));
  const bracketSlots = slots.filter((x) => s.days[x.day].bracket && x.index > lastPool + s.restSlots);
  const fieldUse = new Map<number, number>();
  for (const g of games) fieldUse.set(g.slot.index, (fieldUse.get(g.slot.index) ?? 0) + 1);
  // A node is a team-to-be: where it last played and, on that day, the most games any team on its path has played,
  // so a winner never goes past the day's limit. Seeds start from the busiest pool day before the bracket.
  type Node = { key: string; from: string; slot: number; day: number; today: number; bye: boolean };
  const lastPoolDay = lastPool >= 0 ? slots[lastPool].day : -1;
  const poolToday = lastPoolDay < 0 ? 0 : Math.max(0, ...teams.map((t) => playsOn(t.id, lastPoolDay)));
  let offset = 0;
  const brackets = names.map((name, b) => {
    const count = counts[b];
    let size = 1; while (size < count) size *= 2;
    const nodes: Node[] = seedOrder(size).map((local) => ({ key: '', from: `seed:${offset + local}`, slot: lastPool, day: lastPoolDay, today: poolToday, bye: local > count }));
    offset += count;
    return { name, b, count, size, byes: size - count, prev: nodes, left: size, round: 1 };
  });
  if (brackets.some((x) => x.count < 2)) {
    problems.push(`${n} teams aren’t enough for ${names.length} brackets of at least 2. Use fewer brackets.`);
    return done();
  }
  const maxBracketDay = s.bracketMaxPerDay ?? s.maxPerDay;
  while (brackets.some((x) => x.left >= 2)) {
    for (const br of brackets) {
      if (br.left < 2) continue;
      const next: Node[] = [];
      for (let i = 0; i < br.left / 2; i++) {
        const a = br.prev[2 * i], c = br.prev[2 * i + 1];
        if (a.bye || c.bye) { next.push(a.bye ? c : a); continue; } // the other side moves on without playing
        const notBefore = Math.max(a.slot, c.slot);
        const gamesThatDay = (x: Slot) => Math.max(a.day === x.day ? a.today : 0, c.day === x.day ? c.today : 0);
        // A team's first bracket game keeps to the usual day's limit; only a team still winning may go past it.
        const fits = (side: Node, x: Slot) => (side.day === x.day ? side.today : 0) < (side.key ? maxBracketDay : s.maxPerDay);
        const slot = bracketSlots.find((x) => (notBefore < 0 || (x.index > notBefore + s.restSlots || slots[notBefore].day !== x.day && x.index > notBefore))
          && (fieldUse.get(x.index) ?? 0) < s.fields.length && fits(a, x) && fits(c, x));
        // A first round with byes is only the lowest seeds playing in: "Opening round", not "Round of 64".
        const round = br.round === 1 && br.byes && br.left > 2 ? 'Opening round' : names.length > 1 && br.left === 2 ? 'Final' : roundName(br.left);
        const label = names.length > 1 ? `${br.name} ${round}` : round;
        if (!slot) { problems.push(`The brackets didn’t fit: ${label} needs more time after pool play.`); return done(); }
        const used = fieldUse.get(slot.index) ?? 0;
        fieldUse.set(slot.index, used + 1);
        const key = `b${br.b}-${br.round}-${i}`;
        games.push({ stage: 'bracket', round: br.round, label, bracket: br.name, slot, field: s.fields[used], home: null, away: null,
          homeFrom: a.key ? `winner:${a.key}` : a.from, awayFrom: c.key ? `winner:${c.key}` : c.from, key });
        next.push({ key, from: '', slot: slot.index, day: slot.day, today: gamesThatDay(slot) + 1, bye: false });
      }
      br.prev = next; br.left /= 2; br.round++;
    }
  }
  return done();
  function done(): WeekPlan {
    return { games, slots, problems, brackets: brackets.map(({ name, count, size, byes }) => ({ name, teams: count, size, byes, seeds: '' }))
      .map((x, i, all) => { const first = all.slice(0, i).reduce((m, y) => m + y.teams, 0) + 1; return { ...x, seeds: `${first}–${first + x.teams - 1}` }; }) };
  }
}

/** What a schedule looks like per team: games, games a day, shortest rest, opponents from the same state. */
export function planSummary(teams: WeekTeam[], plan: WeekPlan, s: WeekSettings) {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const pool = plan.games.filter((g) => g.stage === 'pool');
  const per = new Map(teams.map((t) => [t.id, [] as WeekGame[]]));
  for (const g of pool) { per.get(g.home!)!.push(g); per.get(g.away!)!.push(g); }
  const counts = [...per.values()].map((l) => l.length);
  const maxDay = Math.max(...[...per.values()].map((l) => Math.max(0, ...Object.values(l.reduce((m: Record<number, number>, g) => ({ ...m, [g.slot.day]: (m[g.slot.day] ?? 0) + 1 }), {})))));
  const sameState = pool.filter((g) => byId.get(g.home!)!.state === byId.get(g.away!)!.state).length;
  const perDay = s.days.map((d, i) => ({ date: d.date, games: plan.games.filter((g) => g.slot.day === i).length, pool: pool.filter((g) => g.slot.day === i).length }));
  const bracketRounds = [...new Set(plan.games.filter((g) => g.stage === 'bracket').map((g) => g.label))].map((label) => {
    const gs = plan.games.filter((g) => g.label === label);
    const at = gs.map((g) => `${g.slot.date} ${g.slot.time}`).sort();
    return { label, games: gs.length, from: at[0], to: at[at.length - 1] };
  });
  return { poolGames: pool.length, minPerTeam: Math.min(...counts), maxPerTeam: Math.max(...counts), maxGamesInADay: maxDay, sameStateGames: sameState, perDay, bracketRounds, slotCount: plan.slots.length };
}
