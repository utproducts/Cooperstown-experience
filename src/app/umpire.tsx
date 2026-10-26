import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { teamLabel } from '@/components/game-card';
import { Badge, Body, Button, Caption, Card, Empty, ErrorNote, Field, H1, H3, Row, Screen, Segmented } from '@/components/ui';
import { C, Fonts, R, S } from '@/constants/theme';
import { useBackend } from '@/data';
import type { UmpireWeek } from '@/data/backend';
import type { Game } from '@/data/types';
import { formatDay, formatTime, localDateKey } from '@/lib/time';

const CODE_KEY = 'cxp-umpire-code';

/**
 * Umpires' scoring screen: the week's code (from the director), then their
 * field's games for the day, then the final score and baseballs used.
 */
export default function Umpire() {
  const backend = useBackend();
  const [code, setCode] = useState('');
  const [week, setWeek] = useState<UmpireWeek | null>(null);
  const [day, setDay] = useState('');
  const [field, setField] = useState('all');
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (c: string, quiet = false) => {
      if (!quiet) {
        setError(null);
        setNotice(null);
        setBusy(true);
      }
      try {
        const w = await backend.umpireGames(c);
        setWeek(w);
        AsyncStorage.setItem(CODE_KEY, c).catch(() => {});
        const tz = w.event.timezone;
        const days = [...new Set(w.games.map((g) => localDateKey(g.startsAt, tz)))];
        const today = localDateKey(new Date().toISOString(), tz);
        setDay((d) => (d && days.includes(d) ? d : days.includes(today) ? today : (days[0] ?? '')));
      } catch (e) {
        setWeek(null);
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [backend],
  );

  useEffect(() => {
    AsyncStorage.getItem(CODE_KEY)
      .then((c) => {
        if (c) {
          setCode(c);
          load(c, true);
        }
      })
      .catch(() => {});
  }, [load]);

  if (!week) {
    return (
      <Screen>
        <Button title="Back" variant="ghost" small icon="chevron-back" onPress={() => router.replace('/welcome')} style={{ alignSelf: 'flex-start' }} />
        <H1>Umpires</H1>
        <Card>
          <Body>Enter the umpire code for this week. The tournament director has it.</Body>
          <Field
            label="Umpire code"
            placeholder="e.g. K7Q2XM"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={12}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            onSubmitEditing={() => code.trim() && load(code)}
          />
          <Button title="See my games" icon="baseball" loading={busy} disabled={!code.trim()} onPress={() => load(code)} />
          {backend.mode === 'demo' && <Caption>Demo codes: UMP2027 or UMPCREW (Week 1 2027) · UMPDEMO (sample week)</Caption>}
          <ErrorNote message={error} />
        </Card>
      </Screen>
    );
  }

  const tz = week.event.timezone;
  const days = [...new Set(week.games.map((g) => localDateKey(g.startsAt, tz)))];
  const fields = [...new Set(week.games.filter((g) => localDateKey(g.startsAt, tz) === day).map((g) => g.field))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  const list = week.games.filter((g) => localDateKey(g.startsAt, tz) === day && (field === 'all' || g.field === field));

  return (
    <Screen refreshing={busy} onRefresh={() => load(code)}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <H1>{week.event.name}</H1>
          <Caption>Umpire scoring{week.label ? ` · ${week.label}` : ''}</Caption>
        </View>
        <Button
          title="Use another code"
          variant="ghost"
          small
          onPress={() => {
            setWeek(null);
            setCode('');
            AsyncStorage.removeItem(CODE_KEY).catch(() => {});
          }}
        />
      </Row>
      {notice && (
        <View style={styles.notice}>
          <Body style={{ color: C.green, fontWeight: '700' }}>{notice}</Body>
        </View>
      )}
      <ErrorNote message={error} />
      <Segmented value={day} onChange={(v) => (setDay(v), setOpen(null))} options={days.map((d, i) => ({ value: d, label: `Day ${i + 1} · ${formatDay(d)}` }))} />
      <Segmented value={field} onChange={(v) => (setField(v), setOpen(null))} options={[{ value: 'all', label: 'All fields' }, ...fields.map((f) => ({ value: f, label: f }))]} />
      {list.length === 0 && <Empty icon="baseball-outline" title="No games here on this day" />}
      {list.map((g) => {
        const home = teamLabel(week.teams as never, g.homeTeamId, g.homeLabel);
        const away = teamLabel(week.teams as never, g.awayTeamId, g.awayLabel);
        const known = g.homeTeamId && g.awayTeamId;
        return (
          <Card key={g.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <H3>
                  {formatTime(g.startsAt, tz)} · {g.field}
                </H3>
                <Caption>
                  G{g.number} · {[g.bracket && `${g.bracket} bracket`, g.round].filter(Boolean).join(' · ')}
                </Caption>
              </View>
              {g.status === 'final' && <Badge label={`Final ${g.awayScore}–${g.homeScore}${g.baseballsUsed !== null ? ` · ${g.baseballsUsed} balls` : ''}`} tone="green" />}
              {g.status === 'cancelled' && <Badge label="Cancelled" tone="muted" />}
            </Row>
            <Body>
              {away} <Text style={{ color: C.muted }}>(away)</Text>
            </Body>
            <Body>
              {home} <Text style={{ color: C.muted }}>(home)</Text>
            </Body>
            {g.status !== 'cancelled' &&
              (open === g.id ? (
                <ScoreForm
                  game={g}
                  home={home}
                  away={away}
                  onCancel={() => setOpen(null)}
                  onSave={async (h, a, balls) => {
                    setError(null);
                    await backend.umpireScore(code, g.id, h, a, balls);
                    setOpen(null);
                    setNotice(`Saved: ${away} ${a}, ${home} ${h} · ${balls} baseballs.`);
                    await load(code, true);
                  }}
                />
              ) : known ? (
                <Button title={g.status === 'final' ? 'Fix the score' : 'Enter final score'} small variant={g.status === 'final' ? 'secondary' : 'dark'} onPress={() => (setOpen(g.id), setNotice(null))} />
              ) : (
                <Caption>The teams for this game aren’t known yet.</Caption>
              ))}
          </Card>
        );
      })}
    </Screen>
  );
}

function Stepper({ label, value, onChange, max = 99 }: { label: string; value: string; onChange: (v: string) => void; max?: number }) {
  const n = parseInt(value, 10) || 0;
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.stepLabel} numberOfLines={1}>
        {label}
      </Text>
      <Row gap={6}>
        <Button title="−" variant="secondary" small onPress={() => onChange(String(Math.max(0, n - 1)))} />
        <TextInput
          value={value}
          onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, String(max).length))}
          keyboardType="number-pad"
          style={styles.stepInput}
          placeholder="–"
          accessibilityLabel={label}
        />
        <Button title="+" variant="secondary" small onPress={() => onChange(String(Math.min(max, n + 1)))} />
      </Row>
    </View>
  );
}

function ScoreForm({
  game,
  home,
  away,
  onSave,
  onCancel,
}: {
  game: Game;
  home: string;
  away: string;
  onSave: (home: number, away: number, balls: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [h, setH] = useState(game.homeScore?.toString() ?? '');
  const [a, setA] = useState(game.awayScore?.toString() ?? '');
  const [balls, setBalls] = useState(game.baseballsUsed?.toString() ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = h !== '' && a !== '' && balls !== '' && !(game.stage === 'bracket' && h === a);
  return (
    <View style={styles.form}>
      <Stepper label={`${away} runs`} value={a} onChange={setA} />
      <Stepper label={`${home} runs`} value={h} onChange={setH} />
      <Stepper label="Baseballs used" value={balls} onChange={setBalls} max={500} />
      {game.stage === 'bracket' && h !== '' && h === a && <Caption style={{ color: C.warn }}>Bracket games can’t end in a tie.</Caption>}
      <ErrorNote message={error} />
      <Row>
        <Button
          title="Save final score"
          loading={busy}
          disabled={!ready}
          style={{ flex: 1 }}
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              await onSave(Number(h), Number(a), Number(balls));
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
        <Button title="Cancel" variant="secondary" onPress={onCancel} />
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { backgroundColor: C.greenSoft, padding: S.md, borderRadius: R.md },
  form: { gap: S.md, paddingTop: S.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  stepLabel: { fontSize: 14, fontWeight: '700', color: C.navy },
  stepInput: {
    width: 64,
    height: 44,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '800',
    fontFamily: Fonts.display,
    color: C.ink,
  },
});
