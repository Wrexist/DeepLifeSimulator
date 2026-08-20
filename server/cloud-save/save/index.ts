// DeepLife Simulator cloud-save endpoint (device backup).
// Contract matches lib/progress/cloud.ts in the app repo:
//   POST   /save            body { state, updatedAt, userId, slotId, revision, hash, signature }
//   GET    /save?userId=...&slotId=...   -> CloudSave JSON or `null`
//   DELETE /save?userId=...&slotId=...   -> erase ONE slot
//   DELETE /save?userId=...              -> erase EVERYTHING for that device
//   POST   /save/transfer   body { userId }        -> mint a transfer code
//   POST   /save/claim      body { userId, code }  -> claim one, copying saves
// Auth: Bearer token compared against backend_config.cloud_auth_token.
// verify_jwt is disabled because the app is not a Supabase-auth client;
// this function implements its own bearer-token check on every request.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const MAX_BODY_BYTES = 3_000_000; // ~3 MB serialized state ceiling
const USER_ID_RE = /^player_[a-z0-9_]{3,60}$/;
const SLOT_ID_RE = /^slot_[1-3]$/;
const MIN_WRITE_INTERVAL_MS = 5_000;
const TRANSFER_CODE_TTL_MIN = 15;
const TRANSFER_CODE_LEN = 10;
// Deliberately excludes 0/O/1/I/L: the player reads this off one screen and
// types it into another, so the ambiguous glyphs are the ones that cost
// support tickets. 31 symbols ** 10 chars is about 49.5 bits.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CLAIM_ATTEMPT_LIMIT = 10;

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

/** '' for /save, 'transfer' for /save/transfer, 'claim' for /save/claim. */
function subRoute(url: URL): string {
  const parts = url.pathname.split('/').filter(Boolean);
  const idx = parts.lastIndexOf('save');
  return idx >= 0 ? (parts[idx + 1] ?? '') : '';
}

/** Cryptographically random — never Math.random() for a bearer credential. */
function mintCode(): string {
  const bytes = new Uint8Array(TRANSFER_CODE_LEN);
  crypto.getRandomValues(bytes);
  // Modulo bias across 31 symbols from a 256-value byte is under 0.4% and does
  // not meaningfully reduce the search space at this length.
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

Deno.serve(async (req: Request) => {
  try {
    if (!(await authorized(req))) {
      return json({ success: false, message: 'Unauthorized' }, 401);
    }

    const route = subRoute(new URL(req.url));

    if (req.method === 'GET' && route === '') {
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

    if (req.method === 'POST' && route === '') {
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

    // ---- Erasure -----------------------------------------------------------
    // With a slotId, one slot. Without one, EVERYTHING this device has: saves,
    // leaderboard entries and any transfer codes. That second form is the
    // GDPR article 17 path, so it deliberately reaches past cloud_saves --
    // a player asking to be erased means all of it, not just the backup.
    //
    // Erasure is idempotent: deleting nothing answers 200 {deleted:0}, not an
    // error. A client retrying after a dropped response must not see a failure
    // for work that already succeeded.
    if (req.method === 'DELETE' && route === '') {
      const url = new URL(req.url);
      const userId = url.searchParams.get('userId') ?? '';
      const slotId = url.searchParams.get('slotId');
      if (!USER_ID_RE.test(userId)) {
        return json({ success: false, message: 'Invalid userId' }, 400);
      }

      if (slotId !== null) {
        if (!SLOT_ID_RE.test(slotId)) {
          return json({ success: false, message: 'Invalid slotId' }, 400);
        }
        const { data, error } = await supabase
          .from('cloud_saves')
          .delete()
          .eq('user_id', userId)
          .eq('slot_id', slotId)
          .select('slot_id');
        if (error) return json({ success: false, message: 'Delete failed' }, 500);
        return json({ success: true, deleted: data?.length ?? 0 });
      }

      const { data: saves, error: savesError } = await supabase
        .from('cloud_saves').delete().eq('user_id', userId).select('slot_id');
      if (savesError) return json({ success: false, message: 'Delete failed' }, 500);

      const { data: scores, error: scoresError } = await supabase
        .from('leaderboard_entries').delete().eq('user_id', userId).select('category');
      if (scoresError) return json({ success: false, message: 'Delete failed' }, 500);

      // Codes minted BY this device and any it has claimed -- both name it.
      await supabase.from('save_transfer_codes').delete().eq('user_id', userId);
      await supabase.from('save_transfer_codes').delete().eq('claimed_by', userId);

      return json({
        success: true,
        deleted: saves?.length ?? 0,
        leaderboardDeleted: scores?.length ?? 0,
      });
    }

    // ---- Mint a transfer code ----------------------------------------------
    if (req.method === 'POST' && route === 'transfer') {
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return json({ success: false, message: 'Invalid JSON' }, 400);
      }
      const userId = String(body.userId ?? '');
      if (!USER_ID_RE.test(userId)) return json({ success: false, message: 'Invalid userId' }, 400);

      // One live code per device. Minting again invalidates the previous one,
      // so a code read aloud and then re-minted cannot still be spent.
      await supabase
        .from('save_transfer_codes')
        .delete()
        .eq('user_id', userId)
        .is('claimed_at', null);

      const code = mintCode();
      const expiresAt = new Date(Date.now() + TRANSFER_CODE_TTL_MIN * 60_000);
      const { error } = await supabase.from('save_transfer_codes').insert({
        code,
        user_id: userId,
        expires_at: expiresAt.toISOString(),
      });
      if (error) return json({ success: false, message: 'Could not mint code' }, 500);

      return json({
        success: true,
        code,
        expiresAt: expiresAt.getTime(),
        expiresInMinutes: TRANSFER_CODE_TTL_MIN,
      });
    }

    // ---- Claim a transfer code ---------------------------------------------
    if (req.method === 'POST' && route === 'claim') {
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return json({ success: false, message: 'Invalid JSON' }, 400);
      }
      const userId = String(body.userId ?? '');
      const code = String(body.code ?? '').trim().toUpperCase();
      if (!USER_ID_RE.test(userId)) return json({ success: false, message: 'Invalid userId' }, 400);
      if (code.length !== TRANSFER_CODE_LEN) {
        return json({ success: false, message: 'Invalid code' }, 400);
      }

      const { data: allowed } = await supabase.rpc('save_ratelimit_hit', {
        p_bucket: `claim:${userId}`,
        p_limit: CLAIM_ATTEMPT_LIMIT,
        p_window: '10 minutes',
      });
      if (allowed === false) {
        return json({ success: false, message: 'Too many attempts' }, 429);
      }

      // The claim and the copy happen inside one Postgres transaction, so two
      // devices racing the same code cannot both win. See claim_save_transfer.
      const { data: copied, error } = await supabase.rpc('claim_save_transfer', {
        p_code: code,
        p_new_user: userId,
      });
      if (error) return json({ success: false, message: 'Claim failed' }, 500);
      if (copied === null || copied < 0) {
        // One message for unknown, expired and already-spent alike: telling a
        // guesser WHICH of those a code was is free information.
        return json({ success: false, message: 'Code is invalid, expired or already used' }, 404);
      }

      return json({ success: true, slots: copied });
    }

    return json({ success: false, message: 'Method not allowed' }, 405);
  } catch {
    return json({ success: false, message: 'Internal error' }, 500);
  }
});
