import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export function env(name: string, fallback?: string): string {
  const v = Deno.env.get(name) ?? fallback;
  if (v === undefined) throw new Error(`Missing environment variable ${name}`);
  return v;
}

/** Service-role client: bypasses RLS. Only use after checking the caller. */
export function adminClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
}

/** Resolves the calling user from the request's JWT, or null. */
export async function callerProfile(req: Request): Promise<{ id: string; email: string; role: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  const userClient = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data } = await userClient.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await adminClient().from('profiles').select('id, email, role').eq('id', data.user.id).maybeSingle();
  return profile;
}
