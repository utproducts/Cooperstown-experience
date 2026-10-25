import { StyleSheet, Text, View } from 'react-native';

import { C, Fonts, S } from '@/constants/theme';
import type { Game, Team } from '@/data/types';
import { formatTime } from '@/lib/time';

import { Badge, Caption, Card, Row } from './ui';

export function teamLabel(teams: Team[], id: string | null, fallback: string | null) {
  return teams.find((t) => t.id === id)?.name ?? fallback ?? 'TBD';
}

export function statusBadge(g: Game) {
  switch (g.status) {
    case 'live':
      return <Badge label="LIVE" tone="red" icon="radio-button-on" />;
    case 'final':
      return <Badge label="Final" tone="muted" />;
    case 'delayed':
      return <Badge label="Delayed" tone="warn" icon="time" />;
    case 'postponed':
      return <Badge label="Postponed" tone="warn" />;
    case 'cancelled':
      return <Badge label="Cancelled" tone="muted" />;
    default:
      return null;
  }
}

export function GameCard({
  game,
  teams,
  highlightTeamIds = [],
  timeZone,
  onPress,
  showDay,
}: {
  game: Game;
  teams: Team[];
  highlightTeamIds?: string[];
  timeZone?: string;
  onPress?: () => void;
  showDay?: boolean;
}) {
  const hasScore = game.homeScore !== null && game.awayScore !== null;
  const homeWon = game.status === 'final' && hasScore && game.homeScore! > game.awayScore!;
  const awayWon = game.status === 'final' && hasScore && game.awayScore! > game.homeScore!;
  const line = (id: string | null, label: string | null, score: number | null, won: boolean) => (
    <Row style={{ justifyContent: 'space-between' }}>
      <Text
        numberOfLines={1}
        style={[styles.team, highlightTeamIds.includes(id ?? '') && { color: C.red }, game.status === 'final' && !won && { color: C.muted }]}>
        {teamLabel(teams, id, label)}
      </Text>
      <Text style={[styles.score, game.status === 'final' && !won && { color: C.muted }]}>{score ?? ''}</Text>
    </Row>
  );
  return (
    <Card onPress={onPress} style={{ gap: S.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={6}>
          <Text style={styles.time}>
            {showDay
              ? new Date(game.startsAt).toLocaleDateString('en-US', { timeZone, weekday: 'short' }) + ' · '
              : ''}
            {formatTime(game.startsAt, timeZone)}
          </Text>
          <Caption>
            · {game.field} · G{game.number}
          </Caption>
        </Row>
        {statusBadge(game)}
      </Row>
      {line(game.awayTeamId, game.awayLabel, game.awayScore, awayWon)}
      {line(game.homeTeamId, game.homeLabel, game.homeScore, homeWon)}
      {(game.round || game.note) && (
        <Caption numberOfLines={2}>
          {[game.round, game.note].filter(Boolean).join(' · ')}
        </Caption>
      )}
    </Card>
  );
}

export function Scoreline({ value }: { value: string }) {
  return (
    <View style={styles.scoreline}>
      <Text style={styles.scorelineText}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  time: { fontSize: 14, fontWeight: '800', color: C.navy },
  team: { fontSize: 16, fontWeight: '700', color: C.ink, flex: 1, marginRight: S.md },
  score: { fontSize: 20, fontWeight: '800', color: C.ink, fontFamily: Fonts.display, minWidth: 28, textAlign: 'right' },
  scoreline: { backgroundColor: C.navy, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  scorelineText: { color: C.white, fontWeight: '800' },
});
