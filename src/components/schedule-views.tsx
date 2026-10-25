import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { C, S } from '@/constants/theme';
import type { Game, Team } from '@/data/types';
import { computeStandings } from '@/lib/schedule';
import { formatDay, localDateKey } from '@/lib/time';

import { GameCard, teamLabel } from './game-card';
import { Caption, Card, Empty, H3, Row, Segmented, Stack } from './ui';

export function GamesByDay({
  games,
  teams,
  highlight = [],
  timeZone,
  onPressGame,
  emptyText = 'No games scheduled yet.',
}: {
  games: Game[];
  teams: Team[];
  highlight?: string[];
  timeZone?: string;
  onPressGame?: (g: Game) => void;
  emptyText?: string;
}) {
  const days = useMemo(() => [...new Set(games.map((g) => localDateKey(g.startsAt, timeZone)))].sort(), [games, timeZone]);
  const today = localDateKey(new Date().toISOString(), timeZone);
  const [day, setDay] = useState<string>('all');
  const effective = day !== 'all' && !days.includes(day) ? 'all' : day;
  if (games.length === 0) return <Empty icon="calendar-outline" title={emptyText} />;
  const shown = effective === 'all' ? days : [effective];
  return (
    <Stack>
      <Segmented
        value={effective}
        onChange={setDay}
        options={[{ value: 'all', label: 'All days' }, ...days.map((d) => ({ value: d, label: d === today ? 'Today' : formatDay(d) }))]}
      />
      {shown.map((d) => (
        <Stack key={d} gap={S.sm}>
          <Caption style={styles.dayHeader}>{d === today ? `Today · ${formatDay(d)}` : formatDay(d)}</Caption>
          {games
            .filter((g) => localDateKey(g.startsAt, timeZone) === d)
            .map((g) => (
              <GameCard key={g.id} game={g} teams={teams} highlightTeamIds={highlight} timeZone={timeZone} onPress={onPressGame && (() => onPressGame(g))} />
            ))}
        </Stack>
      ))}
    </Stack>
  );
}

export function StandingsTable({ teams, games, highlight = [] }: { teams: Team[]; games: Game[]; highlight?: string[] }) {
  const rows = computeStandings(teams, games);
  const pools = [...new Set(rows.map((r) => r.pool))];
  if (teams.length === 0) return <Empty title="No teams yet" />;
  return (
    <Stack>
      {pools.map((pool) => (
        <Card key={pool} style={{ gap: 0, paddingVertical: S.sm }}>
          <Row style={styles.headRow}>
            <H3 style={{ flex: 1 }}>Pool {pool}</H3>
            {['W', 'L', 'T', 'RS', 'RA', 'RD'].map((h) => (
              <Text key={h} style={styles.headCell}>
                {h}
              </Text>
            ))}
          </Row>
          {rows
            .filter((r) => r.pool === pool)
            .map((r, i) => (
              <Row key={r.teamId} style={[styles.row, highlight.includes(r.teamId) && { backgroundColor: C.redSoft }]}>
                <Text style={styles.rank}>{i + 1}</Text>
                <Text numberOfLines={1} style={styles.teamCell}>
                  {teamLabel(teams, r.teamId, null)}
                </Text>
                {[r.wins, r.losses, r.ties, r.runsFor, r.runsAgainst, r.runDiff > 0 ? `+${r.runDiff}` : r.runDiff].map((v, j) => (
                  <Text key={j} style={styles.cell}>
                    {v}
                  </Text>
                ))}
              </Row>
            ))}
        </Card>
      ))}
      <Caption>Ranked by win %, run differential (max ±8 per game), runs allowed, then runs scored.</Caption>
    </Stack>
  );
}

export function BracketView({ games, teams, highlight = [], timeZone }: { games: Game[]; teams: Team[]; highlight?: string[]; timeZone?: string }) {
  const bracket = games.filter((g) => g.stage === 'bracket');
  if (bracket.length === 0) return <Empty icon="git-network-outline" title="Bracket not posted yet" body="Brackets are set after pool play wraps up." />;
  const rounds = [...new Set(bracket.map((g) => g.round ?? ''))];
  return (
    <Stack>
      {rounds.map((r) => (
        <Stack key={r} gap={S.sm}>
          <Caption style={styles.dayHeader}>{r}</Caption>
          {bracket
            .filter((g) => (g.round ?? '') === r)
            .map((g) => (
              <GameCard key={g.id} game={g} teams={teams} highlightTeamIds={highlight} timeZone={timeZone} showDay />
            ))}
        </Stack>
      ))}
    </Stack>
  );
}

const styles = StyleSheet.create({
  dayHeader: { fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, color: C.navy },
  headRow: { paddingVertical: S.sm, borderBottomWidth: 1, borderBottomColor: C.border },
  headCell: { width: 34, textAlign: 'center', fontSize: 12, fontWeight: '800', color: C.muted },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  rank: { width: 20, fontWeight: '800', color: C.muted },
  teamCell: { flex: 1, fontWeight: '600', color: C.ink },
  cell: { width: 34, textAlign: 'center', fontVariant: ['tabular-nums'], color: C.ink },
});

export function Spacer() {
  return <View style={{ height: S.lg }} />;
}
