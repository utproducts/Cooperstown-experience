// Fans out a notification row to the Expo push tokens of everyone who follows
// the targeted teams (or everyone at the event when team_ids is empty),
// including parents linked by registration email. Invoked by the
// notifications_push database trigger with the service-role key.
import { adminClient, env, json } from '../_shared/supabase.ts';

interface NotificationRow {
  id: string;
  event_id: string;
  kind: string;
  title: string;
  body: string;
  team_ids: string[];
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  // Only the database trigger (service role) may call this.
  if (req.headers.get('Authorization') !== `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return json({ error: 'forbidden' }, 403);
  }
  const { record } = (await req.json()) as { record: NotificationRow };
  const db = adminClient();

  let teamIds = record.team_ids ?? [];
  if (teamIds.length === 0) {
    const { data: teams } = await db.from('teams').select('id').eq('event_id', record.event_id);
    teamIds = (teams ?? []).map((t) => t.id);
  }
  if (teamIds.length === 0) return json({ sent: 0 });

  const userIds = new Set<string>();
  const { data: follows } = await db.from('follows').select('user_id').in('team_id', teamIds);
  follows?.forEach((f) => userIds.add(f.user_id));

  const { data: players } = await db.from('players').select('guardian_email').in('team_id', teamIds).not('guardian_email', 'is', null);
  const emails = [...new Set((players ?? []).map((p) => p.guardian_email as string))];
  for (let i = 0; i < emails.length; i += 200) {
    const { data: profiles } = await db.from('profiles').select('id').in('email', emails.slice(i, i + 200));
    profiles?.forEach((p) => userIds.add(p.id));
  }
  if (userIds.size === 0) return json({ sent: 0 });

  const ids = [...userIds];
  const tokens: string[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from('push_tokens').select('token').in('user_id', ids.slice(i, i + 200));
    data?.forEach((t) => tokens.push(t.token));
  }

  let sent = 0;
  const stale: string[] = [];
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100);
    const messages = batch.map((to) => ({
      to,
      title: record.title,
      body: record.body,
      sound: 'default',
      channelId: 'default',
      priority: record.kind === 'weather' || record.kind === 'schedule' ? 'high' : 'default',
      data: { notificationId: record.id, kind: record.kind, url: '/fan/alerts' },
    }));
    const res = await fetch(EXPO_PUSH_URL, { method: 'POST', headers, body: JSON.stringify(messages) });
    if (!res.ok) {
      console.error('expo push failed', res.status, await res.text());
      continue;
    }
    const { data } = (await res.json()) as { data: Array<{ status: string; details?: { error?: string } }> };
    data.forEach((ticket, j) => {
      if (ticket.status === 'ok') sent++;
      else if (ticket.details?.error === 'DeviceNotRegistered') stale.push(batch[j]);
    });
  }
  if (stale.length) await db.from('push_tokens').delete().in('token', stale);
  return json({ sent, removed: stale.length });
});
