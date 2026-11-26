import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';

const BodySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  subject: z.string().trim().min(2).max(150),
  message: z.string().trim().min(10).max(2000),
  sourcePath: z.string().trim().max(255).optional(),
});

// In-memory IP rate limit (max 5 submissions per IP per hour per isolate)
const IP_RL_MAX = 5;
const IP_RL_WINDOW_MS = 60 * 60 * 1000;
const ipBuckets = new Map<string, { count: number; reset: number }>();

function checkIpLimit(ip: string): boolean {
  const now = Date.now();
  if (ipBuckets.size > 1000) {
    for (const [k, v] of ipBuckets) {
      if (now > v.reset) ipBuckets.delete(k);
    }
  }
  const bucket = ipBuckets.get(ip);
  if (!bucket || now > bucket.reset) {
    ipBuckets.set(ip, { count: 1, reset: now + IP_RL_WINDOW_MS });
    return true;
  }
  if (bucket.count >= IP_RL_MAX) return false;
  bucket.count++;
  return true;
}

const json = (body: unknown, status = 200, corsHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, { allowMethods: 'POST, OPTIONS' });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, corsHeaders);

  try {
    const clientIp =
      req.headers.get('cf-connecting-ip') ??
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      'unknown';

    if (clientIp !== 'unknown' && !checkIpLimit(clientIp)) {
      return json({ error: 'Too many messages sent recently. Please try again later.' }, 429, corsHeaders);
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return json({ error: 'Invalid submission', fields: parsed.error.flatten().fieldErrors }, 400, corsHeaders);
    }
    const { name, email, subject, message, sourcePath } = parsed.data;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    // Server-side throttle: max 3 submissions per email per hour (case-insensitive).
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from('contact_messages')
      .select('id', { count: 'exact', head: true })
      .ilike('email', email)
      .gte('created_at', oneHourAgo);

    if (countError) {
      console.error('contact-submit throttle check failed:', countError.message);
      return json({ error: 'Could not process submission' }, 500, corsHeaders);
    }
    if ((count ?? 0) >= 3) {
      return json({ error: 'Too many messages sent recently. Please try again later.' }, 429, corsHeaders);
    }

    const { error } = await supabase.from('contact_messages').insert({
      name,
      email,
      subject,
      message,
      source_path: sourcePath ?? null,
      user_agent: (req.headers.get('user-agent') ?? '').slice(0, 255) || null,
    });

    if (error) {
      console.error('contact-submit insert failed:', error.message);
      return json({ error: 'Could not save your message' }, 500, corsHeaders);
    }

    return json({ ok: true }, 200, corsHeaders);
  } catch (e) {
    console.error('contact-submit unexpected error:', e instanceof Error ? e.message : e);
    return json({ error: 'Unexpected server error' }, 500, corsHeaders);
  }
});
