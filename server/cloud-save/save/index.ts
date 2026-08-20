// DeepLife Simulator cloud-save endpoint (device backup).
// Contract matches lib/progress/cloud.ts in the app repo:
//   POST /save  body { state, updatedAt, userId, slotId, revision, hash, signature }
//   GET  /save?userId=...&slotId=...  -> CloudSave JSON or `null`
// Auth: Bearer token compared against backend_config.cloud_auth_token.
// verify_jwt is disabled because the app is not a Supabase-auth client;
// this function implements its own bearer-token check on every request.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const MAX_BODY_BYTES = 3_000_000; // ~3 MB serialized state ceiling
const USER_ID_RE = /^player_[a-z0-9_]{3,60}$/;
const SLOT_ID_RE = /^slot_[1-3]$/;
const MIN_WRITE_INTERVAL_MS = 5_000;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

let cachedToken: string | null = null;
async function expectedToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  const { data } = await supabase
    .from('backend_config')
    .select('value')
    .eq('key', 'cloud_auth_token')
    .maybeSingle();
  cachedToken = data?.value ?? null;
  return cachedToken;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function authorized(req: Request): Promise<boolean> {
  const token = await expectedToken();
  if (!token) return false; // fail closed if config missing
  const header = req.headers.get('Authorization') ?? '';
  return header === `Bearer ${token}`;
}

Deno.serve(async (req: Request) => {
  try {
    if (!(await authorized(req))) {
      return json({ success: false, message: 'Unauthorized' }, 401);
    }

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const userId = url.searchParams.get('userId') ?? '';
      const slotId = url.searchParams.get('slotId') ?? '';
      if (!USER_ID_RE.test(userId) || !SLOT_ID_RE.test(slotId)) {
        return json({ success: false, message: 'Invalid userId or slotId' }, 400);
      }
      const { data, error } = await supabase
        .from('cloud_saves')
        .select('user_id, slot_id, state, updated_at, revision, hash, signature')
        .eq('user_id', userId)
        .eq('slot_id', slotId)
        .maybeSingle();
      if (error) return json({ success: false, message: 'Read failed' }, 500);
      if (!data) return json(null, 200); // client treats JSON null as "no cloud save"
      return json({
        state: data.state,
        updatedAt: Number(data.updated_at),
        userId: data.user_id,
        slotId: data.slot_id,
        revision: data.revision,
        hash: data.hash,
        signature: data.signature,
      });
    }

    if (req.method === 'POST') {
      const raw = await req.text();
      if (raw.length > MAX_BODY_BYTES) {
        return json({ success: false, message: 'Payload too large' }, 413);
      }
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(raw);
      } catch {
        return json({ success: false, message: 'Invalid JSON' }, 400);
      }
      const userId = String(body.userId ?? '');
      const slotId = String(body.slotId ?? '');
      const revision = Number(body.revision);
      const updatedAt = Number(body.updatedAt);
      const hash = String(body.hash ?? '');
      const signature = String(body.signature ?? '');
      if (!USER_ID_RE.test(userId)) return json({ success: false, message: 'Invalid userId' }, 400);
      if (!SLOT_ID_RE.test(slotId)) return json({ success: false, message: 'Invalid slotId' }, 400);
      if (!Number.isInteger(revision) || revision < 1) {
        return json({ success: false, message: 'Invalid revision' }, 400);
      }
      if (!Number.isFinite(updatedAt) || updatedAt <= 0) {
        return json({ success: false, message: 'Invalid updatedAt' }, 400);
      }
      if (hash.length < 8 || signature.length < 16) {
        return json({ success: false, message: 'Missing integrity proof' }, 400);
      }
      if (typeof body.state !== 'object' || body.state === null) {
        return json({ success: false, message: 'Invalid state' }, 400);
      }

      const { data: existing } = await supabase
        .from('cloud_saves')
        .select('revision, received_at')
        .eq('user_id', userId)
        .eq('slot_id', slotId)
        .maybeSingle();
      if (existing) {
        if (existing.revision > revision) {
          // Stale write: never let an older revision clobber a newer backup.
          return json({ success: false, message: 'Stale revision' }, 409);
        }
        const last = existing.received_at ? Date.parse(existing.received_at) : 0;
        if (Date.now() - last < MIN_WRITE_INTERVAL_MS) {
          return json({ success: false, message: 'Too many writes' }, 429);
        }
      }

      const { error } = await supabase.from('cloud_saves').upsert({
        user_id: userId,
        slot_id: slotId,
        state: body.state,
        updated_at: updatedAt,
        revision,
        hash,
        signature,
        received_at: new Date().toISOString(),
      });
      if (error) return json({ success: false, message: 'Write failed' }, 500);
      return json({ success: true, message: 'Save successful' });
    }

    return json({ success: false, message: 'Method not allowed' }, 405);
  } catch {
    return json({ success: false, message: 'Internal error' }, 500);
  }
});
