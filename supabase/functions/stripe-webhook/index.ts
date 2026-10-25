// Marks photo orders paid when Stripe reports checkout.session.completed.
// Configure in Stripe → Developers → Webhooks with this function's URL.
import { adminClient, env, json } from '../_shared/supabase.ts';

async function verify(payload: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]));
  const timestamp = parts.t;
  const signatures = header
    .split(',')
    .filter((kv) => kv.startsWith('v1='))
    .map((kv) => kv.slice(3));
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return signatures.some((s) => s.length === expected.length && [...s].every((c, i) => c === expected[i]));
}

Deno.serve(async (req) => {
  const payload = await req.text();
  if (!(await verify(payload, req.headers.get('Stripe-Signature'), env('STRIPE_WEBHOOK_SECRET')))) {
    return json({ error: 'bad signature' }, 400);
  }
  const event = JSON.parse(payload);
  if (event.type === 'checkout.session.completed' && event.data.object.payment_status === 'paid') {
    const orderId = event.data.object.metadata?.order_id;
    if (orderId) {
      await adminClient().from('photo_orders').update({ status: 'paid' }).eq('id', orderId).eq('status', 'pending');
    }
  }
  return json({ received: true });
});
