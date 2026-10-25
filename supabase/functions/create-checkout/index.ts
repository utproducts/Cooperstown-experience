// Creates a Stripe Checkout session for a pending photo order. Prices are
// re-read from photo_products so the client can't change them.
// Body: { orderId: string }. Returns { url }.
import { adminClient, callerProfile, corsHeaders, env, json } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const caller = await callerProfile(req);
  if (!caller) return json({ error: 'Please sign in.' }, 401);
  const { orderId } = (await req.json()) as { orderId: string };

  const db = adminClient();
  const { data: order } = await db.from('photo_orders').select('*').eq('id', orderId).maybeSingle();
  if (!order || order.user_id !== caller.id) return json({ error: 'Order not found.' }, 404);
  if (order.status !== 'pending') return json({ error: 'Order already processed.' }, 409);

  const items = (order.items ?? []) as Array<{ productId: string; quantity: number }>;
  const { data: products } = await db.from('photo_products').select('id, name, price_cents, active').in('id', items.map((i) => i.productId));
  const lines = items
    .map((i) => ({ item: i, product: products?.find((p) => p.id === i.productId && p.active) }))
    .filter((l) => l.product && l.item.quantity > 0 && l.item.quantity <= 20);
  if (lines.length === 0) return json({ error: 'No purchasable items.' }, 400);

  const total = lines.reduce((s, l) => s + l.product!.price_cents * l.item.quantity, 0);
  const appUrl = env('APP_URL').replace(/\/$/, '');
  const form = new URLSearchParams({
    mode: 'payment',
    success_url: `${appUrl}/fan/photos?paid=1`,
    cancel_url: `${appUrl}/fan/photos`,
    customer_email: caller.email,
    'metadata[order_id]': order.id,
    'shipping_address_collection[allowed_countries][0]': 'US',
  });
  lines.forEach((l, i) => {
    form.set(`line_items[${i}][quantity]`, String(l.item.quantity));
    form.set(`line_items[${i}][price_data][currency]`, 'usd');
    form.set(`line_items[${i}][price_data][unit_amount]`, String(l.product!.price_cents));
    form.set(`line_items[${i}][price_data][product_data][name]`, l.product!.name);
  });

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const session = await res.json();
  if (!res.ok) return json({ error: session.error?.message ?? 'Stripe error' }, 502);

  await db.from('photo_orders').update({ total_cents: total, stripe_session_id: session.id }).eq('id', order.id);
  return json({ url: session.url });
});
