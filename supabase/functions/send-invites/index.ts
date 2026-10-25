// Emails team follow codes to parents and coaches (via Resend).
// Body: { inviteIds: string[] }. Caller must be a director.
import { adminClient, callerProfile, corsHeaders, env, json } from '../_shared/supabase.ts';

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function emailHtml(p: { name: string | null; teamName: string; eventName: string; code: string; link: string }) {
  const hi = p.name ? `Hi ${escapeHtml(p.name.split(' ')[0])},` : 'Hi there,';
  return `<!doctype html><html><body style="margin:0;background:#F7F2E8;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1B1F2A">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden">
    <tr><td style="background:#0E2340;padding:28px 32px;color:#fff">
      <div style="color:#C9A227;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase">${escapeHtml(p.eventName)}</div>
      <div style="font-family:Georgia,serif;font-size:28px;font-weight:700;margin-top:6px">You're on the roster!</div>
    </td></tr>
    <tr><td style="padding:28px 32px;font-size:16px;line-height:24px">
      <p>${hi}</p>
      <p>Follow <b>${escapeHtml(p.teamName)}</b> in the Cooperstown Experience app to get the game schedule, live scores, delay and weather alerts, and your player's check-in QR code.</p>
      <p style="text-align:center;margin:28px 0">
        <span style="display:inline-block;font-family:Menlo,monospace;font-size:30px;font-weight:800;letter-spacing:3px;color:#0E2340;border:3px dashed #C8102E;border-radius:12px;padding:12px 20px">${escapeHtml(p.code)}</span>
      </p>
      <p style="text-align:center"><a href="${p.link}" style="background:#C8102E;color:#fff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:10px;display:inline-block">Follow ${escapeHtml(p.teamName)}</a></p>
      <p style="font-size:14px;color:#667085">Sign in with this email address so your player's check-in pass appears automatically. On your phone, install the app first, then tap the button or enter the code under More → My teams.</p>
    </td></tr>
  </table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const caller = await callerProfile(req);
  if (caller?.role !== 'director') return json({ error: 'Directors only.' }, 403);

  const { inviteIds } = (await req.json()) as { inviteIds: string[] };
  if (!Array.isArray(inviteIds) || inviteIds.length === 0) return json({ sent: 0 });

  const db = adminClient();
  const appUrl = env('APP_URL').replace(/\/$/, '');
  const from = env('INVITE_FROM_EMAIL');
  const resendKey = env('RESEND_API_KEY');

  const { data: invites, error } = await db
    .from('invites')
    .select('id, email, name, team:teams(id, name, event:events(name), team_codes(code))')
    .in('id', inviteIds.slice(0, 1000));
  if (error) return json({ error: error.message }, 500);

  let sent = 0;
  const failures: string[] = [];
  for (const inv of invites ?? []) {
    // deno-lint-ignore no-explicit-any
    const team = inv.team as any;
    const code = Array.isArray(team?.team_codes) ? team.team_codes[0]?.code : team?.team_codes?.code;
    if (!code) {
      failures.push(`${inv.email}: team has no code`);
      continue;
    }
    const link = `${appUrl}/follow/${code}`;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: inv.email,
        subject: `Follow ${team.name} — your team code is ${code}`,
        html: emailHtml({ name: inv.name, teamName: team.name, eventName: team.event?.name ?? 'Cooperstown', code, link }),
        text: `Follow ${team.name} in the Cooperstown Experience app with team code ${code}: ${link}`,
      }),
    });
    if (res.ok) {
      sent++;
      await db.from('invites').update({ sent_at: new Date().toISOString() }).eq('id', inv.id);
    } else {
      failures.push(`${inv.email}: ${res.status}`);
    }
  }
  if (failures.length) console.error('invite failures', failures);
  return json({ sent, failed: failures.length });
});
