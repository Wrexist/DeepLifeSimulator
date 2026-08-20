// DeepLife Simulator leaderboard endpoint.
// Contract matches lib/progress/cloud.ts in the app repo:
//   POST /leaderboard/{category}  body { name, score, userId, runSignature, revision }
//   GET  /leaderboard/{category}  -> LeaderboardEntry[] (top 50 by score desc)
// Auth: same bearer token as /save (backend_config.cloud_auth_token).
// verify_jwt is disabled because the app is not a Supabase-auth client;
// this function implements its own bearer-token check on every request.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const USER_ID_RE = /^player_[a-z0-9_]{3,60}$/;
const CATEGORY_RE = /^[a-z0-9_-]{1,40}$/i;

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

function categoryFromPath(url: URL): string | null {
  // Path arrives as /leaderboard/<category> (function slug + one segment).
  const parts = url.pathname.split('/').filter(Boolean);
  const idx = parts.lastIndexOf('leaderboard');
  const category = idx >= 0 ? parts[idx + 1] : undefined;
  return category && CATEGORY_RE.test(category) ? category : null;
}

Deno.serve(async (req: Request) => {
  try {
    const token = await expectedToken();
    const header = req.headers.get('Authorization') ?? '';
    if (!token || header !== `Bearer ${token}`) {
      return json({ success: false, message: 'Unauthorized' }, 401);
    }

    const url = new URL(req.url);
    const category = categoryFromPath(url);
    if (!category) return json({ success: false, message: 'Invalid category' }, 400);

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('leaderboard_entries')
        .select('name, score, category, user_id, revision')
        .eq('category', category)
        .order('score', { ascending: false })
        .limit(50);
      if (error) return json({ success: false, message: 'Read failed' }, 500);
      return json((data ?? []).map((row) => ({
        name: row.name,
        score: Number(row.score),
        category: row.category,
        userId: row.user_id,
        revision: row.revision,
      })));
    }

    if (req.method === 'POST') {
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return json({ success: false, message: 'Invalid JSON' }, 400);
      }
      const userId = String(body.userId ?? '');
      const name = String(body.name ?? '').trim().slice(0, 40);
      const score = Number(body.score);
      const revision = Number(body.revision);
      const runSignature = String(body.runSignature ?? '');
      if (!USER_ID_RE.test(userId)) return json({ success: false, message: 'Invalid userId' }, 400);
      if (!name) return json({ success: false, message: 'Invalid name' }, 400);
      if (!Number.isFinite(score) || score < 0) return json({ success: false, message: 'Invalid score' }, 400);
      if (!Number.isInteger(revision) || revision < 1) return json({ success: false, message: 'Invalid revision' }, 400);
      if (runSignature.length < 16) return json({ success: false, message: 'Missing run proof' }, 400);

      // Keep each player's best score per category; never lower it.
      const { data: existing } = await supabase
        .from('leaderboard_entries')
        .select('score')
        .eq('category', category)
        .eq('user_id', userId)
        .maybeSingle();
      if (existing && Number(existing.score) >= score) {
        return json({ success: true, message: 'Existing score is higher' });
      }
      const { error } = await supabase.from('leaderboard_entries').upsert({
        category,
        user_id: userId,
        name,
        score,
        run_signature: runSignature,
        revision,
      });
      if (error) return json({ success: false, message: 'Write failed' }, 500);
      return json({ success: true, message: 'Score recorded' });
    }

    return json({ success: false, message: 'Method not allowed' }, 405);
  } catch {
    return json({ success: false, message: 'Internal error' }, 500);
  }
});
