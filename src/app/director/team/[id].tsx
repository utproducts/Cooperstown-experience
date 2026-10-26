import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { GameCard } from '@/components/game-card';
import { PlayerPassSheet } from '@/components/player-pass';
import { TeamBag } from '@/components/uniform';
import { Badge, Body, Button, Caption, Card, Divider, ErrorNote, Field, H1, H3, Row, Screen, Section, showMessage } from '@/components/ui';
import { C, Fonts, S } from '@/constants/theme';
import type { Team } from '@/data/types';
import { APP_URL, useBackend } from '@/data';
import { useDirectorData } from '@/data/director';
import { randomToken } from '@/lib/codes';
import { formatTime } from '@/lib/time';
import { sizeLine, uniformItems } from '@/lib/uniform';

export default function TeamDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const backend = useBackend();
  const d = useDirectorData();
  const team = d.teams.find((t) => t.id === id);
  const roster = d.players.filter((p) => p.teamId === id);
  const invites = d.invites.filter((i) => i.teamId === id);
  const [pass, setPass] = useState<string | null>(null);
  const passPlayer = roster.find((p) => p.id === pass);
  const items = uniformItems(d.event);
  const games = d.games.filter((g) => g.homeTeamId === id || g.awayTeamId === id);
  const [busy, setBusy] = useState(false);

  if (!team) {
    return (
      <Screen>
        <Button title="Back to teams" variant="ghost" icon="chevron-back" onPress={() => router.replace('/director/teams')} />
        <Body>{d.loading ? 'Loading…' : 'Team not found.'}</Body>
      </Screen>
    );
  }

  const link = `${APP_URL}/follow/${team.code}`;
  const unsent = invites.filter((i) => !i.sentAt);

  async function send(ids: string[]) {
    setBusy(true);
    try {
      const n = await backend.sendInvites(ids);
      showMessage('Invites sent', `${n} email${n === 1 ? '' : 's'} sent with team code ${team!.code}.`);
    } catch (e) {
      showMessage('Could not send', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <H1>{team.name}</H1>
      <Caption>
        {[team.city, team.state].filter(Boolean).join(', ')}
        {team.pool ? ` · Pool ${team.pool}` : ''}
      </Caption>

      {backend.features.followCodes && (
      <Card style={{ backgroundColor: C.navy, borderColor: C.navy }}>
        <Caption style={{ color: C.gold, fontWeight: '800' }}>TEAM FOLLOW CODE</Caption>
        <Text selectable style={{ fontFamily: Fonts.mono, fontSize: 32, fontWeight: '800', color: C.white, letterSpacing: 2 }}>
          {team.code}
        </Text>
        <Caption style={{ color: '#C9D4E5' }} selectable>
          {link}
        </Caption>
        <Row style={{ flexWrap: 'wrap' }}>
          <Button title="Copy link" icon="copy" variant="secondary" small onPress={() => Clipboard.setStringAsync(link)} />
          <Button title={`Send ${unsent.length} unsent invites`} icon="mail" small loading={busy} disabled={!unsent.length} onPress={() => send(unsent.map((i) => i.id))} />
          <Button title="Resend all" variant="secondary" small loading={busy} disabled={!invites.length} onPress={() => send(invites.map((i) => i.id))} />
        </Row>
      </Card>
      )}
      {!backend.features.rosters && (
        <Card>
          <H3>Team</H3>
          <Body>
            {team.organization ?? 'No organization listed'}
            {team.rosterSize ? ` · ${team.rosterSize} players registered` : ''}
          </Body>
          <Caption>Player rosters and parent links come with the family features (phase 2).</Caption>
        </Card>
      )}

      <CoachForm key={team.id} team={team} />

      {backend.features.rosters && (
      <Section title={`Roster (${roster.length})`}>
        <Card style={{ gap: 0 }}>
          {roster.length === 0 && <Caption>No players yet. Import a roster, or add players below.</Caption>}
          {roster.map((p, i) => (
            <View key={p.id}>
              {i > 0 && <Divider />}
              <Row style={{ paddingVertical: S.sm }}>
                <Badge label={p.jerseyNumber ? `#${p.jerseyNumber}` : '–'} />
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '700' }}>
                    {p.firstName} {p.lastName}
                  </Body>
                  <Caption>
                    {p.guardianName ?? 'No parent'} · {p.guardianEmail ?? 'no email'}
                  </Caption>
                  <Caption style={{ color: C.navy }}>{sizeLine(p.uniform, items)}</Caption>
                </View>
                {p.checkedInAt ? <Badge label={`In ${formatTime(p.checkedInAt, d.event?.timezone)}`} tone="green" /> : <Badge label="Not in" tone="muted" />}
                <Button title="QR pass" icon="qr-code" small variant="secondary" onPress={() => setPass(p.id)} />
              </Row>
            </View>
          ))}
        </Card>
        {roster.length > 0 && (
          <Card>
            <TeamBag players={roster} items={items} />
          </Card>
        )}
        <AddPlayer teamId={team.id} items={items} />
      </Section>

      )}

      {passPlayer && <PlayerPassSheet key={passPlayer.id} player={passPlayer} team={team} items={items} timeZone={d.event?.timezone} onClose={() => setPass(null)} />}

      {backend.features.invites && (
      <Section title={`Invitations (${invites.length})`}>
        <Card style={{ gap: 4 }}>
          {invites.map((i) => (
            <Row key={i.id} style={{ justifyContent: 'space-between' }}>
              <Body style={{ flex: 1 }} numberOfLines={1}>
                {i.email}
              </Body>
              <Badge label={i.sentAt ? 'Sent' : 'Not sent'} tone={i.sentAt ? 'green' : 'warn'} />
            </Row>
          ))}
        </Card>
      </Section>

      )}

      <Section title="Games">
        {games.map((g) => (
          <GameCard key={g.id} game={g} teams={d.teams} highlightTeamIds={[team.id]} timeZone={d.event?.timezone} showDay />
        ))}
        {games.length === 0 && <Caption>No games scheduled.</Caption>}
      </Section>
    </Screen>
  );
}

/** Adds one player by hand; the database gives them a QR check-in pass. */
function AddPlayer({ teamId, items }: { teamId: string; items: string[] }) {
  const backend = useBackend();
  const blank = { firstName: '', lastName: '', jersey: '', parentName: '', parentEmail: '' };
  const [f, setF] = useState(blank);
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof blank) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const emailOk = !f.parentEmail.trim() || /^\S+@\S+\.\S+$/.test(f.parentEmail.trim());
  return (
    <Card>
      <H3>Add a player</H3>
      <Row>
        <View style={{ flex: 1 }}>
          <Field label="First name" value={f.firstName} onChangeText={set('firstName')} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Last name" value={f.lastName} onChangeText={set('lastName')} />
        </View>
      </Row>
      <Field label="Jersey #" value={f.jersey} onChangeText={set('jersey')} keyboardType="number-pad" />
      <Row style={{ flexWrap: 'wrap' }}>
        {items.map((item) => (
          <View key={item} style={{ flexGrow: 1, minWidth: 90 }}>
            <Field label={`${item} size`} placeholder="e.g. YL" value={sizes[item] ?? ''} onChangeText={(v) => setSizes((x) => ({ ...x, [item]: v }))} autoCapitalize="characters" />
          </View>
        ))}
      </Row>
      <Field label="Parent name" value={f.parentName} onChangeText={set('parentName')} />
      <Field
        label="Parent email"
        value={f.parentEmail}
        onChangeText={set('parentEmail')}
        autoCapitalize="none"
        keyboardType="email-address"
        hint="The parent signs in with this email to see the player's QR pass."
      />
      <ErrorNote message={error} />
      <Button
        title="Add player"
        icon="person-add"
        variant="dark"
        small
        loading={busy}
        disabled={!f.firstName.trim() || !emailOk}
        onPress={async () => {
          setBusy(true);
          setError(null);
          try {
            await backend.insert('players', [
              {
                teamId,
                firstName: f.firstName.trim(),
                lastName: f.lastName.trim(),
                jerseyNumber: f.jersey.trim() || null,
                guardianName: f.parentName.trim() || null,
                guardianEmail: f.parentEmail.trim().toLowerCase() || null,
                guardianPhone: null,
                externalId: null,
                birthDate: null,
                checkInToken: randomToken(16),
                checkedInAt: null,
                checkedInBy: null,
                uniform: Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)),
              },
            ]);
            setF(blank);
            setSizes({});
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Card>
  );
}

function CoachForm({ team }: { team: Team }) {
  const backend = useBackend();
  const [coachName, setCoachName] = useState(team.coachName ?? '');
  const [coachEmail, setCoachEmail] = useState(team.coachEmail ?? '');
  const [coachPhone, setCoachPhone] = useState(team.coachPhone ?? '');
  return (
    <Card>
      <H3>Head coach</H3>
      <Field label="Name" value={coachName} onChangeText={setCoachName} />
      <Field label="Email" value={coachEmail} onChangeText={setCoachEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Phone" value={coachPhone} onChangeText={setCoachPhone} keyboardType="phone-pad" />
      <Button
        title="Save coach"
        variant="dark"
        small
        onPress={() => backend.update('teams', team.id, { coachName: coachName || null, coachEmail: coachEmail || null, coachPhone: coachPhone || null })}
      />
    </Card>
  );
}
