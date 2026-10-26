import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, View } from 'react-native';

import { Badge, Body, Button, Caption, Card, Divider, ErrorNote, Field, H1, H2, H3, Icon, Row, Screen, Segmented, Stack } from '@/components/ui';
import { WeekChip } from '@/components/week-picker';
import { C, S } from '@/constants/theme';
import { useAuth, useCurrentEvent, useTable } from '@/data';
import { useDirectorData } from '@/data/director';
import { importRegistrations, type ImportSummary } from '@/data/services';
import { toCsv } from '@/lib/csv';
import { parseRegistrations, type RegistrationField } from '@/lib/registrations';
import { shareTextFile } from '@/lib/share-file';
import { matchWeek, weekRange } from '@/lib/weeks';

const FIELD_LABELS: Partial<Record<RegistrationField, string>> = {
  team: 'Team',
  firstName: 'First name',
  lastName: 'Last name',
  fullName: 'Full name',
  role: 'Role',
  jersey: 'Jersey',
  birthDate: 'Birth date',
  guardianEmail: 'Parent email',
  guardianName: 'Parent name',
  guardianFirst: 'Parent first',
  guardianLast: 'Parent last',
  guardianPhone: 'Parent phone',
  email: 'Email',
  status: 'Status',
  program: 'Program / week',
  programStart: 'Program start date',
  organization: 'Organization',
  coachName: 'Team rep',
  coachEmail: 'Team rep email',
  rosterSize: 'Players',
};

const TEMPLATE_HEADERS = ['Program', 'Program Start Date', 'Registration Status', 'First Name', 'Last Name', 'Birth Date', 'Team', 'Role', 'Jersey Number', 'Parent 1 First Name', 'Parent 1 Last Name', 'Parent 1 Email', 'Parent 1 Phone', 'Email'];

async function readPickedFile(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  if (Platform.OS === 'web' && asset.file) return asset.file.text();
  return new File(asset.uri).text();
}

export default function ImportScreen() {
  const { backend } = useAuth();
  const d = useDirectorData();
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [sendInvites, setSendInvites] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const week = useCurrentEvent();
  const allTeams = useTable('teams');
  // Manual week choices per program group (overrides the automatic match).
  const [weekFor, setWeekFor] = useState<Record<string, string>>({});

  const parsed = useMemo(() => (csv.trim() ? parseRegistrations(csv) : null), [csv]);
  const playerCount = parsed?.teams.reduce((s, t) => s + t.players.length, 0) ?? 0;

  // Group teams by the program/session they registered for, and decide which week each group goes to.
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; program: string | null; startDate: string | null; teams: NonNullable<typeof parsed>['teams'] }>();
    for (const t of parsed?.teams ?? []) {
      const key = `${t.program ?? ''}|${t.programStartDate ?? ''}`;
      if (!map.has(key)) map.set(key, { key, program: t.program, startDate: t.programStartDate, teams: [] });
      map.get(key)!.teams.push(t);
    }
    return [...map.values()];
  }, [parsed]);
  const hasProgramInfo = groups.some((g) => g.program || g.startDate);
  const assigned = groups.map((g) => {
    const auto = hasProgramInfo ? matchWeek(week.events, { program: g.program, startDate: g.startDate }) : week.data;
    const eventId = weekFor[g.key] ?? auto?.id ?? null;
    return { ...g, auto, eventId, event: week.events.find((e) => e.id === eventId) ?? null };
  });
  const unassigned = assigned.filter((g) => !g.eventId).length;
  const outbox = backend.outbox?.() ?? [];

  async function pick() {
    setError(null);
    const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain'], copyToCacheDirectory: true });
    if (res.canceled) return;
    try {
      const asset = res.assets[0];
      setCsv(await readPickedFile(asset));
      setFileName(asset.name);
      setSummary(null);
    } catch (e) {
      setError(`Could not read file: ${(e as Error).message}`);
    }
  }

  async function runImport() {
    if (!parsed || unassigned > 0) return;
    setBusy(true);
    setError(null);
    try {
      const total: ImportSummary = { teamsCreated: 0, teamsUpdated: 0, playersCreated: 0, invitesCreated: 0, invitesSent: 0 };
      for (const g of assigned) {
        const s = await importRegistrations(backend, g.eventId!, g.teams, { sendInvites: sendInvites && backend.features.invites });
        (Object.keys(total) as (keyof ImportSummary)[]).forEach((k) => (total[k] += s[k]));
      }
      setSummary(total);
      setWeekFor({});
      setCsv('');
      setFileName(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <H1>Import registrations</H1>
        <Button title="Teams" variant="ghost" small onPress={() => router.push('/director/teams')} />
      </Row>
      {week.data && !parsed && (
        <Card style={{ backgroundColor: C.navy, borderColor: C.navy, flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <Icon name="calendar" color={C.gold} />
          <View style={{ flex: 1 }}>
            <Caption style={{ color: C.gold, fontWeight: '800' }}>IMPORTING INTO</Caption>
            <Body style={{ color: C.white, fontWeight: '700' }}>
              {week.data.name} · {weekRange(week.data)}
            </Body>
            <Caption style={{ color: '#C9D4E5' }}>If the export has a Program or Start Date column, each group is matched to its own week instead.</Caption>
          </View>
          <WeekChip />
        </Card>
      )}

      <Card>
        <H2 style={{ fontSize: 18 }}>From LeagueApps</H2>
        <Stack gap={S.xs}>
          <Body>1. In LeagueApps, open your program → Registrations → Export (CSV).</Body>
          <Body>2. Include team assignment, player name, parent email and (optionally) jersey, birth date and role.</Body>
          <Body>3. Upload it here. We create each team, a unique team follow code, a check-in QR for every player, and email each family their code.</Body>
        </Stack>
        <Row style={{ flexWrap: 'wrap' }}>
          <Button title={fileName ? `Replace ${fileName}` : 'Choose CSV file'} icon="document-attach" onPress={pick} />
          <Button title={showPaste ? 'Hide paste box' : 'Paste CSV'} variant="secondary" onPress={() => setShowPaste(!showPaste)} />
          <Button
            title="Download template"
            variant="ghost"
            icon="download"
            onPress={() =>
              shareTextFile(
                'registration-template.csv',
                toCsv(TEMPLATE_HEADERS, [
                  ['Cooperstown Week 1 - 12U', '05/29/2027', 'Active', 'Mason', 'Reed', '03/14/2014', 'Gulf Coast Storm (Tampa, FL)', 'Player', '7', 'Jamie', 'Reed', 'jamie@example.com', '555-0101', ''],
                  ['Cooperstown Week 1 - 12U', '05/29/2027', 'Active', 'Mike', 'Hart', '', 'Gulf Coast Storm (Tampa, FL)', 'Head Coach', '', '', '', '', '', 'coach@example.com'],
                ]),
              )
            }
          />
        </Row>
        {showPaste && <Field multiline placeholder="Paste CSV with a header row" value={csv} onChangeText={(t) => (setCsv(t), setSummary(null))} style={{ minHeight: 140, fontFamily: 'monospace', fontSize: 13 }} />}
      </Card>

      {parsed && (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <H2 style={{ fontSize: 18 }}>Preview</H2>
            <Badge label={`${parsed.rowCount} rows`} tone="muted" />
          </Row>
          <Row style={{ flexWrap: 'wrap' }}>
            <Badge label={`${parsed.teams.length} teams`} tone="navy" icon="shield" />
            <Badge label={`${playerCount} players`} tone="navy" icon="person" />
            <Badge label={`${parsed.teams.filter((t) => t.coachName).length} coaches`} tone="navy" icon="clipboard" />
            {parsed.skipped > 0 && <Badge label={`${parsed.skipped} skipped`} tone="warn" />}
            {parsed.teamsOnly && <Badge label="Team-level export" tone="gold" />}
          </Row>
          {parsed.teamsOnly && (
            <Caption>One row per team: teams, organizations, hometowns and team reps are imported now; player rosters can be imported later from a registrations export.</Caption>
          )}
          <Caption>Detected columns</Caption>
          <Row style={{ flexWrap: 'wrap' }} gap={6}>
            {(Object.keys(FIELD_LABELS) as RegistrationField[])
              .filter((f) => parsed.mapping[f])
              .map((f) => (
                <Badge key={f} label={`${FIELD_LABELS[f]} ← ${parsed.mapping[f]}`} tone="green" />
              ))}
          </Row>
          {parsed.issues.length > 0 && (
            <View style={{ backgroundColor: C.warnSoft, padding: S.md, borderRadius: 10, gap: 4 }}>
              <H3 style={{ color: C.warn }}>{parsed.issues.length} things to check</H3>
              {parsed.issues.slice(0, 8).map((i, k) => (
                <Caption key={k}>
                  Row {i.row}: {i.message}
                </Caption>
              ))}
              {parsed.issues.length > 8 && <Caption>…and {parsed.issues.length - 8} more</Caption>}
            </View>
          )}
          <Divider />
          <H3>Which week?</H3>
          {assigned.map((g) => (
            <View key={g.key} style={{ gap: 6, padding: S.md, borderRadius: 10, backgroundColor: g.eventId ? C.cream : C.warnSoft }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '700' }}>{g.program ?? (hasProgramInfo ? 'No program listed' : 'All rows')}</Body>
                  <Caption>
                    {g.startDate ? `Starts ${g.startDate} · ` : ''}
                    {g.teams.length} teams · {g.teams.reduce((n, t) => n + t.players.length, 0)} players
                  </Caption>
                </View>
                {g.event ? (
                  <Badge label={weekFor[g.key] ? 'Chosen' : hasProgramInfo ? 'Auto-matched' : 'Selected week'} tone="green" icon="checkmark" />
                ) : (
                  <Badge label="Pick a week" tone="warn" icon="alert-circle" />
                )}
              </Row>
              {g.event && (
                <Body style={{ fontWeight: '700', color: C.navy }}>
                  → {g.event.name} · {weekRange(g.event)}
                </Body>
              )}
              <Segmented
                value={g.eventId ?? ''}
                onChange={(id) => setWeekFor((m) => ({ ...m, [g.key]: id }))}
                options={week.events.map((e) => ({ value: e.id, label: e.name }))}
              />
            </View>
          ))}
          {week.events.length === 0 && <Caption style={{ color: C.red }}>Create the season’s weeks first (More → Weeks).</Caption>}
          <Divider />
          {parsed.teams.slice(0, 30).map((t) => {
            const g = assigned.find((x) => x.key === `${t.program ?? ''}|${t.programStartDate ?? ''}`);
            const existing = allTeams.data.find(
              (x) => x.eventId === g?.eventId && (x.name.toLowerCase() === t.name.toLowerCase() || (t.externalId && x.externalId === t.externalId)),
            );
            return (
              <Row key={t.key} style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '700' }}>{t.name}</Body>
                  <Caption>
                    {[t.city, t.state].filter(Boolean).join(', ') || 'No city/state'} · {t.coachName ?? 'No coach listed'}
                  </Caption>
                </View>
                <Row gap={6}>
                  {existing && <Badge label="Update" tone="gold" />}
                  <Badge label={`${t.players.length}`} icon="person" tone="muted" />
                </Row>
              </Row>
            );
          })}
          <Divider />
          {backend.features.invites ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <Body style={{ flex: 1 }}>Email team codes to parents & coaches now</Body>
              <Button title={sendInvites ? 'Yes' : 'No'} small variant={sendInvites ? 'dark' : 'secondary'} onPress={() => setSendInvites(!sendInvites)} />
            </Row>
          ) : (
            <Caption>Teams, organizations, hometowns and team reps are saved to the Cooperstown database. Player rows and invite emails come with the family features.</Caption>
          )}
          <Button
            title={
              unassigned > 0
                ? `Pick a week for ${unassigned} group${unassigned === 1 ? '' : 's'}`
                : `Import ${parsed.teams.length} teams${parsed.teamsOnly ? '' : ` & ${playerCount} players`}${assigned.length === 1 && assigned[0].event ? ` into ${assigned[0].event.name}` : ''}`
            }
            icon="cloud-upload"
            loading={busy}
            disabled={!parsed.teams.length || unassigned > 0}
            onPress={runImport}
          />
        </Card>
      )}

      <ErrorNote message={error} />

      {summary && (
        <Card style={{ borderColor: C.green }}>
          <Row>
            <Icon name="checkmark-circle" color={C.green} size={28} />
            <H2 style={{ fontSize: 18 }}>Import complete</H2>
          </Row>
          <Body>
            {summary.teamsCreated} new teams, {summary.teamsUpdated} updated · {summary.playersCreated} players added · {summary.invitesCreated} invites created
            {!backend.features.invites ? '' : sendInvites ? `, ${summary.invitesSent} emailed` : ' (not sent yet)'}.
          </Body>
          <Row>
            <Button title="View teams" variant="dark" small onPress={() => router.push('/director/teams')} />
            <Button title="Build schedule" variant="secondary" small onPress={() => router.push('/director/builder')} />
          </Row>
        </Card>
      )}

      {outbox.length > 0 && (
        <Card>
          <H3>Demo outbox</H3>
          <Caption>In demo mode emails aren’t delivered. With Supabase configured they are sent through the send-invites function.</Caption>
          {outbox.slice(0, 5).map((m, i) => (
            <View key={i} style={{ backgroundColor: C.cream, padding: S.md, borderRadius: 10, gap: 2 }}>
              <Caption>To: {m.to}</Caption>
              <Body style={{ fontWeight: '700' }}>You’re invited to follow {m.teamName}</Body>
              <Caption>
                {m.week} · Team code {m.code} · {m.link}
              </Caption>
            </View>
          ))}
          {outbox.length > 5 && <Caption>…and {outbox.length - 5} more</Caption>}
        </Card>
      )}
      {week.events.length === 0 && <Body style={{ color: C.red }}>Create the season’s weeks first (More → Weeks).</Body>}
      {Platform.OS !== 'web' && <Caption>Tip: imports are easiest on a laptop at the web version of this app.</Caption>}
      {summary === null && !parsed && d.teams.length > 0 && (
        <Caption>Re-importing is safe: existing teams are matched by LeagueApps team id or name, and players already on a roster are skipped.</Caption>
      )}
    </Screen>
  );
}
