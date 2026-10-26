import { CameraView, useCameraPermissions } from 'expo-camera';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, Body, Button, Caption, Card, Divider, Field, H1, H3, Icon, Progress, Row, Screen, Segmented, Stack, confirmAction } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { useAuth } from '@/data';
import { useDirectorData } from '@/data/director';
import { TeamCheckinScreen } from '@/components/team-checkin';
import type { CheckInResult } from '@/data/backend';
import { parseCheckInPayload } from '@/lib/codes';
import { formatTime } from '@/lib/time';

type Filter = 'pending' | 'all' | 'teams';

export default function CheckInTab() {
  const { backend } = useAuth();
  const d = useDirectorData();
  // Without player rosters, check-in is team by team (Cooperstown's checklist).
  if (!backend.features.rosters) return <TeamCheckinScreen event={d.event} teams={d.teams} />;
  return <CheckIn />;
}

function CheckIn() {
  const { backend, profile } = useAuth();
  const d = useDirectorData();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; title: string; detail: string } | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('pending');
  const lastScan = useRef<{ value: string; at: number }>({ value: '', at: 0 });
  const tz = d.event?.timezone;

  const checked = d.players.filter((p) => p.checkedInAt).length;
  const teamName = (id: string) => d.teams.find((t) => t.id === id)?.name ?? '';

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return d.players.filter((p) => {
      if (filter === 'pending' && p.checkedInAt) return false;
      if (!q) return true;
      return `${p.firstName} ${p.lastName} ${teamName(p.teamId)} ${p.jerseyNumber ?? ''}`.toLowerCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.players, d.teams, query, filter]);

  function describe(r: CheckInResult) {
    const who = `${r.player.firstName} ${r.player.lastName}`;
    const meta = [r.team?.name, r.player.jerseyNumber ? `#${r.player.jerseyNumber}` : null].filter(Boolean).join(' · ');
    return r.alreadyCheckedIn
      ? { ok: false, title: `${who} was already checked in`, detail: `${meta} · at ${formatTime(r.player.checkedInAt!, tz)}` }
      : { ok: true, title: `${who} checked in`, detail: meta };
  }

  async function onScan(value: string) {
    const now = Date.now();
    if (value === lastScan.current.value && now - lastScan.current.at < 4000) return;
    lastScan.current = { value, at: now };
    const token = parseCheckInPayload(value);
    if (!token) {
      setResult({ ok: false, title: 'Not a check-in code', detail: 'Ask the family to open the Player tab in the app.' });
      return;
    }
    try {
      setResult(describe(await backend.checkInByToken(token)));
    } catch (e) {
      setResult({ ok: false, title: 'Not recognized', detail: (e as Error).message });
    }
  }

  async function toggle(playerId: string, checkedInAt: string | null) {
    if (checkedInAt) {
      if (!(await confirmAction('Undo check-in?', 'Mark this player as not checked in.', 'Undo'))) return;
      await backend.update('players', playerId, { checkedInAt: null, checkedInBy: null });
    } else {
      await backend.update('players', playerId, { checkedInAt: new Date().toISOString(), checkedInBy: profile?.id ?? null });
    }
  }

  return (
    <Screen refreshing={d.loading} onRefresh={d.refresh}>
      <H1>Check-in</H1>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <H3>
            {checked} of {d.players.length} players
          </H3>
          <Badge label={`${d.players.length - checked} to go`} tone={checked === d.players.length ? 'green' : 'navy'} />
        </Row>
        <Progress value={d.players.length ? checked / d.players.length : 0} />
      </Card>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {scanning && permission?.granted ? (
          <View>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => onScan(data)}
            />
            <View pointerEvents="none" style={styles.reticle} />
          </View>
        ) : (
          <View style={styles.cameraPlaceholder}>
            <Icon name="qr-code" size={48} color={C.white} />
            <Text style={{ color: C.white, fontWeight: '700' }}>Scan player QR codes</Text>
            {permission && !permission.granted && !permission.canAskAgain && (
              <Caption style={{ color: '#C9D4E5', textAlign: 'center' }}>Camera access is off. Enable it in Settings, or use manual check-in below.</Caption>
            )}
          </View>
        )}
        <View style={{ padding: S.lg, gap: S.md }}>
          {result && (
            <View style={[styles.result, { backgroundColor: result.ok ? C.greenSoft : C.warnSoft }]}>
              <Icon name={result.ok ? 'checkmark-circle' : 'alert-circle'} size={28} color={result.ok ? C.green : C.warn} />
              <View style={{ flex: 1 }}>
                <H3 style={{ color: result.ok ? C.green : C.warn }}>{result.title}</H3>
                <Caption>{result.detail}</Caption>
              </View>
            </View>
          )}
          <Button
            title={scanning ? 'Stop scanner' : 'Start scanner'}
            icon={scanning ? 'stop-circle' : 'scan'}
            variant={scanning ? 'secondary' : 'primary'}
            onPress={async () => {
              if (scanning) return setScanning(false);
              const p = permission?.granted ? permission : await requestPermission();
              if (p.granted) setScanning(true);
            }}
          />
        </View>
      </Card>

      <Stack gap={S.sm}>
        <H3>Manual check-in</H3>
        <Field placeholder="Search player, team, or jersey #" value={query} onChangeText={setQuery} autoCorrect={false} />
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'pending', label: 'Not checked in' },
            { value: 'all', label: 'All players' },
            { value: 'teams', label: 'By team' },
          ]}
        />
      </Stack>

      {filter === 'teams' ? (
        <Card style={{ gap: 0 }}>
          {d.teams.map((t, i) => {
            const roster = d.players.filter((p) => p.teamId === t.id);
            const done = roster.filter((p) => p.checkedInAt).length;
            return (
              <View key={t.id} style={{ paddingVertical: S.sm, gap: 6 }}>
                {i > 0 && <Divider />}
                <Row style={{ justifyContent: 'space-between', paddingTop: i > 0 ? S.sm : 0 }}>
                  <Body style={{ fontWeight: '700', flex: 1 }}>{t.name}</Body>
                  <Caption>
                    {done}/{roster.length}
                  </Caption>
                </Row>
                <Progress value={roster.length ? done / roster.length : 0} color={done === roster.length ? C.green : C.navy} />
              </View>
            );
          })}
        </Card>
      ) : (
        <Card style={{ gap: 0 }}>
          {list.length === 0 && <Caption>{filter === 'pending' ? 'Everyone matching is checked in. 🎉' : 'No players match.'}</Caption>}
          {list.slice(0, 100).map((p, i) => (
            <View key={p.id}>
              {i > 0 && <Divider />}
              <Row style={{ paddingVertical: S.sm }} gap={S.md}>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '700' }}>
                    {p.firstName} {p.lastName} {p.jerseyNumber ? <Text style={{ color: C.muted }}>#{p.jerseyNumber}</Text> : null}
                  </Body>
                  <Caption>
                    {teamName(p.teamId)}
                    {p.checkedInAt ? ` · in at ${formatTime(p.checkedInAt, tz)}` : ''}
                  </Caption>
                </View>
                <Button
                  title={p.checkedInAt ? 'Undo' : 'Check in'}
                  small
                  variant={p.checkedInAt ? 'ghost' : 'dark'}
                  onPress={() => toggle(p.id, p.checkedInAt)}
                />
              </Row>
            </View>
          ))}
          {list.length > 100 && <Caption>Showing 100 of {list.length}. Search to narrow down.</Caption>}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: { width: '100%', height: 320 },
  reticle: { position: 'absolute', top: 60, left: '50%', marginLeft: -100, width: 200, height: 200, borderWidth: 3, borderColor: C.red, borderRadius: R.lg },
  cameraPlaceholder: { height: 200, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center', gap: S.sm, padding: S.lg },
  result: { flexDirection: 'row', gap: S.md, alignItems: 'center', padding: S.md, borderRadius: R.md },
});
