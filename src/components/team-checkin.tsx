import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { C, S } from '@/constants/theme';
import { useAuth, useTable } from '@/data';
import type { EventWeek, Player, Team, TeamCheckin } from '@/data/types';
import { formatTime } from '@/lib/time';
import { uniformItems } from '@/lib/uniform';

import { TeamBag } from './uniform';
import { Badge, Body, Button, Caption, Card, Divider, Field, H1, H3, Icon, Progress, Row, Screen, Segmented } from './ui';

const DEFAULT_ITEMS = ['Roster verified', 'Waivers signed', 'Wristbands handed out', 'Lodging keys'];

/** The week's check-in list (from its settings, as on the Cooperstown admin site). */
export function checkinItems(event: EventWeek | null): string[] {
  const items = (event?.settings as { checkinItems?: unknown } | null)?.checkinItems;
  return Array.isArray(items) && items.length ? items.map(String) : DEFAULT_ITEMS;
}

/** Team-by-team arrival check-in: tick the week's list, add notes, mark the team checked in. */
export function TeamCheckinScreen({ event, teams, header }: { event: EventWeek | null; teams: Team[]; header?: ReactNode }) {
  const checkins = useTable('team_checkins');
  const teamIds = teams.map((t) => t.id);
  // Rosters (when the database has them) give each team's uniform bag.
  const players = useTable('players', { in: { column: 'teamId', values: teamIds.length ? teamIds : ['__none__'] } });
  const [filter, setFilter] = useState<'waiting' | 'all'>('waiting');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const byTeam = new Map(checkins.data.map((c) => [c.teamId, c]));
  const done = teams.filter((t) => byTeam.get(t.id)?.checkedInAt).length;
  const shown = teams.filter(
    (t) => (filter === 'all' || !byTeam.get(t.id)?.checkedInAt) && `${t.name} ${t.organization ?? ''} ${t.state}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  return (
    <Screen refreshing={checkins.loading} onRefresh={checkins.refresh}>
      <H1>Check-in</H1>
      {header}
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <H3>
            {done} of {teams.length} teams checked in
          </H3>
          <Badge label={`${teams.length - done} to go`} tone={done === teams.length && teams.length ? 'green' : 'navy'} />
        </Row>
        <Progress value={teams.length ? done / teams.length : 0} />
        <Caption>Checklist: {checkinItems(event).join(' · ')}</Caption>
      </Card>
      <Field placeholder="Search team, club or state" value={q} onChangeText={setQ} autoCorrect={false} />
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'waiting', label: 'Not checked in' },
          { value: 'all', label: 'All teams' },
        ]}
      />
      <Card style={{ gap: 0 }}>
        {shown.length === 0 && <Caption>{filter === 'waiting' ? 'Every team matching is checked in. 🎉' : 'No teams match.'}</Caption>}
        {shown.slice(0, 120).map((t, i) => (
          <View key={t.id}>
            {i > 0 && <Divider />}
            <TeamRow
              team={t}
              event={event}
              checkin={byTeam.get(t.id) ?? null}
              roster={players.data.filter((p) => p.teamId === t.id)}
              open={open === t.id}
              onToggle={() => setOpen(open === t.id ? null : t.id)}
            />
          </View>
        ))}
      </Card>
    </Screen>
  );
}

function TeamRow({
  team,
  event,
  checkin,
  roster,
  open,
  onToggle,
}: {
  team: Team;
  event: EventWeek | null;
  checkin: TeamCheckin | null;
  roster: Player[];
  open: boolean;
  onToggle: () => void;
}) {
  const { backend, profile } = useAuth();
  const items = checkinItems(event);
  const [ticked, setTicked] = useState<Record<string, boolean>>(checkin?.items ?? {});
  const [notes, setNotes] = useState(checkin?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const count = items.filter((x) => (checkin?.items ?? {})[x]).length;
  const save = async (checkedIn: boolean) => {
    setBusy(true);
    try {
      await backend.update('team_checkins', team.id, {
        teamId: team.id,
        items: ticked,
        notes,
        checkedInAt: checkedIn ? new Date().toISOString() : null,
        checkedInBy: checkedIn ? (profile?.name ?? '') : '',
      });
      if (checkedIn) onToggle();
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ paddingVertical: S.sm, gap: S.sm }}>
      <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }} accessibilityRole="button">
        <View style={{ flex: 1 }}>
          <Body style={{ fontWeight: '700' }}>{team.name}</Body>
          <Caption>
            {[team.city, team.state].filter(Boolean).join(', ')}
            {team.rosterSize ? ` · ${team.rosterSize} players` : ''}
          </Caption>
        </View>
        {checkin?.checkedInAt ? (
          <Badge label={`In ${formatTime(checkin.checkedInAt, event?.timezone)}`} tone="green" icon="checkmark" />
        ) : (
          <Badge label={`${count}/${items.length}`} tone="muted" />
        )}
        <Icon name={open ? 'chevron-up' : 'chevron-down'} color={C.muted} size={18} />
      </Pressable>
      {open && (
        <View style={{ gap: S.sm, paddingLeft: S.sm }}>
          {items.map((item) => (
            <Pressable
              key={item}
              onPress={() => setTicked({ ...ticked, [item]: !ticked[item] })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!ticked[item] }}>
              <Icon name={ticked[item] ? 'checkbox' : 'square-outline'} color={ticked[item] ? C.green : C.muted} size={22} />
              <Body>{item}</Body>
            </Pressable>
          ))}
          {backend.features.rosters && <TeamBag players={roster} items={uniformItems(event)} />}
          <Field placeholder="Notes (optional)" value={notes} onChangeText={setNotes} />
          {checkin?.checkedInBy ? <Caption>Checked in by {checkin.checkedInBy}</Caption> : null}
          <Row style={{ flexWrap: 'wrap' }}>
            <Button title={checkin?.checkedInAt ? 'Save' : 'Mark checked in'} small variant="dark" loading={busy} onPress={() => save(true)} />
            {!checkin?.checkedInAt && <Button title="Save progress" small variant="secondary" loading={busy} onPress={() => save(false)} />}
            {checkin?.checkedInAt && <Button title="Undo check-in" small variant="ghost" loading={busy} onPress={() => save(false)} />}
          </Row>
        </View>
      )}
    </View>
  );
}
