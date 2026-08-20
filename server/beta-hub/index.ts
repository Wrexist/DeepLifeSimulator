/**
 * Deep Life Simulator — Beta Hub API (Supabase edge function `betahub`)
 *
 * Deployed to the SAME project as `save` / `leaderboard` / `analytics`
 * (`deeplife-backend`). Base URL:
 *   https://gyxmoqanjdvvllwjfsst.supabase.co/functions/v1/betahub
 *
 * ── Why no supabase-js ───────────────────────────────────────────────────────
 * Every call here is a plain PostgREST request, so the client library would add
 * a remote import and a cold-start cost for nothing. `db()` below is the whole
 * data layer.
 *
 * ── Auth, in three tiers ─────────────────────────────────────────────────────
 *  1. PUBLIC   — signup, event, feedback, bug, idea, waitlist, /public, /ideas.
 *                No token. These are the endpoints a public recruitment form
 *                has to expose. Guarded by shape validation, length caps and a
 *                per-IP-hash rate limit, not by a secret.
 *  2. TESTER   — `X-Tester-Token`. A capability token minted at signup and
 *                handed to that browser once. It reaches exactly one tester row.
 *                No password, no Google credential, nothing recoverable.
 *  3. ADMIN    — `Authorization: Bearer <token>`, compared as a SHA-256 digest
 *                against `beta_config.admin_token`. The plaintext is never in
 *                the repo, never in the published bundle and never in the DB —
 *                the operator types it into the admin page and it lives in that
 *                tab's sessionStorage until the tab closes.
 *
 * ── What this deliberately does NOT do ───────────────────────────────────────
 * It has no visibility into Google Play and never claims any. `opted_in`,
 * `installed` and `played` are self-reported by the tester in their own
 * dashboard. Nothing here automates an install, simulates activity, or touches
 * a Play Store metric.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-tester-token',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// ─── tiny data layer ─────────────────────────────────────────────────────────

async function db(
  path: string,
  init: RequestInit & { prefer?: string } = {},
): Promise<any> {
  const headers: Record<string, string> = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
  if (init.prefer) headers.Prefer = init.prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`db ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<any> {
  return db(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const fail = (message: string, status = 400) => json({ ok: false, error: message }, status);

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time compare so a wrong admin token leaks no prefix information. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function mintToken(bytes = 24): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Human-typeable referral code. No vowels, so it cannot spell anything. */
function mintReferralCode(): string {
  const alphabet = 'BCDFGHJKLMNPQRSTVWXZ23456789';
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => alphabet[b % alphabet.length]).join('');
}

/** Trim + hard-cap every string that reaches the database. */
function str(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function strArray(value: unknown, max: number, maxLen = 40): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => str(v, maxLen))
    .filter((v): v is string => v !== null)
    .slice(0, max);
}

function intIn(value: unknown, lo: number, hi: number): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  return i >= lo && i <= hi ? i : null;
}

const oneOf = (value: unknown, allowed: string[], fallback: string): string =>
  typeof value === 'string' && allowed.includes(value) ? value : fallback;

// ─── config ──────────────────────────────────────────────────────────────────

const CONFIG_DEFAULTS: Record<string, unknown> = {
  playBetaUrl: '',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=com.deeplife.simulator',
  websiteUrl: 'https://wrexist.github.io/DeepLifeSimulator/',
  discordUrl: 'https://discord.gg/rzktazdX8v',
  privacyUrl: 'https://wrexist.github.io/DeepLifeSimulator/privacy.html',
  supportEmail: 'deeplifesimulator@gmail.com',
  appVersion: '',
  betaStatus: 'open', // open | full | closed
  betaStartDate: '',
  targetTesters: 20,
  mode: 'beta', // beta | launch
  referralRewardNote: '',
};

/** Keys the admin dashboard may write. `admin_token` is deliberately absent. */
const WRITABLE_CONFIG_KEYS = Object.keys(CONFIG_DEFAULTS);

async function readConfig(): Promise<Record<string, unknown>> {
  const rows = await db('beta_config?select=key,value');
  const out = { ...CONFIG_DEFAULTS };
  for (const row of rows ?? []) {
    if (row.key === 'admin_token') continue;
    out[row.key] = row.value?.v ?? row.value;
  }
  return out;
}

async function writeConfig(patch: Record<string, unknown>): Promise<void> {
  const rows = Object.entries(patch)
    .filter(([key]) => WRITABLE_CONFIG_KEYS.includes(key))
    .map(([key, value]) => ({ key, value: { v: value }, updated_at: new Date().toISOString() }));
  if (!rows.length) return;
  await db('beta_config?on_conflict=key', {
    method: 'POST',
    body: JSON.stringify(rows),
    prefer: 'resolution=merge-duplicates',
  });
}

// ─── rate limit ──────────────────────────────────────────────────────────────

/**
 * Soft abuse barrier for the unauthenticated writes. The bucket key is a SALTED
 * HASH of the caller IP — the IP itself is never stored, so this table cannot
 * become a record of who visited. Buckets expire and are swept opportunistically.
 */
async function rateLimited(req: Request, scope: string, limit: number, windowMin: number) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown';
  const window = Math.floor(Date.now() / (windowMin * 60_000));
  const bucket = (await sha256(`${scope}:${ip}:${window}:betahub`)).slice(0, 32);
  const expires = new Date(Date.now() + windowMin * 60_000).toISOString();

  try {
    const rows = await db(`beta_ratelimit?bucket=eq.${bucket}&select=hits`);
    const hits = rows?.[0]?.hits ?? 0;
    if (hits >= limit) return true;
    await db('beta_ratelimit?on_conflict=bucket', {
      method: 'POST',
      body: JSON.stringify([{ bucket, hits: hits + 1, expires_at: expires }]),
      prefer: 'resolution=merge-duplicates',
    });
    if (Math.random() < 0.05) {
      await db(`beta_ratelimit?expires_at=lt.${new Date().toISOString()}`, { method: 'DELETE' });
    }
  } catch {
    // A limiter that fails closed would take the signup form down with it.
    // Availability of a public recruitment form beats a perfect counter.
    return false;
  }
  return false;
}

// ─── XP / badges ─────────────────────────────────────────────────────────────

/**
 * XP is awarded ONLY for activity inside this hub that we can actually see:
 * completing onboarding, confirming a step, sending feedback, filing a bug,
 * proposing an idea, finishing a mission. Nothing is inferred from Google Play.
 */
const XP = {
  signup: 20,
  opted_in: 30,
  installed: 40,
  played: 50,
  feedback: 60,
  bug: 45,
  idea: 25,
  mission: 35,
  referral: 40,
} as const;

async function awardXp(testerId: string, amount: number): Promise<void> {
  if (!testerId || amount <= 0) return;
  const rows = await db(`beta_testers?id=eq.${testerId}&select=xp`);
  const current = rows?.[0]?.xp ?? 0;
  await db(`beta_testers?id=eq.${testerId}`, {
    method: 'PATCH',
    body: JSON.stringify({ xp: current + amount, last_seen_at: new Date().toISOString() }),
  });
}

// ─── tester session ──────────────────────────────────────────────────────────

async function testerFromToken(req: Request): Promise<any | null> {
  const token = req.headers.get('x-tester-token');
  if (!token || token.length < 16 || token.length > 128) return null;
  const safe = encodeURIComponent(token);
  const rows = await db(`beta_testers?token=eq.${safe}&select=*&limit=1`);
  return rows?.[0] ?? null;
}

/** What the browser is allowed to see about itself — never the raw contact of others. */
function publicTester(row: any) {
  return {
    id: row.id,
    nickname: row.nickname,
    country: row.country,
    device: row.device,
    source: row.source,
    campaign: row.campaign,
    referralCode: row.referral_code,
    optedIn: row.opted_in,
    installed: row.installed,
    played: row.played,
    waitlisted: row.waitlisted,
    completed: row.completed,
    xp: row.xp,
    missionsDone: row.missions_done ?? [],
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

async function requireAdmin(req: Request): Promise<Response | null> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return fail('admin token required', 401);

  const rows = await db(`beta_config?key=eq.admin_token&select=value`);
  const stored = rows?.[0]?.value?.v ?? rows?.[0]?.value;
  if (!stored || typeof stored !== 'string') {
    return fail('admin token is not configured on this deployment', 503);
  }
  const digest = await sha256(token);
  if (!timingSafeEqual(digest, stored)) return fail('invalid admin token', 401);
  return null;
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  // Neutralise spreadsheet formula injection: a leading =,+,-,@ is prefixed
  // with a quote so Sheets/Excel treat it as text, not as a formula.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

function toCsv(rows: any[]): string {
  const header = [
    'Name', 'Contact', 'Contact type', 'Country', 'Device', 'Age range', 'Source',
    'Campaign', 'Referral code', 'Joined', 'Status', 'Opted in', 'Installed',
    'Played', 'XP', 'Missions', 'Feedback', 'Bugs', 'Last activity', 'Notes',
  ];
  const body = rows.map((r) =>
    [
      r.nickname, r.contact, r.contact_kind, r.country, r.device, r.age_range,
      r.source, r.campaign, r.referral_code, r.created_at, r.status,
      r.opted_in, r.installed, r.played, r.xp, (r.missions_done ?? []).length,
      r.feedback_count, r.bug_count, r.last_seen_at, r.notes,
    ].map(csvCell).join(','),
  );
  return [header.map(csvCell).join(','), ...body].join('\r\n');
}

// ─── status derivation ───────────────────────────────────────────────────────

const INACTIVE_DAYS = 5;

function deriveStatus(row: any, hasFeedback: boolean): string {
  if (row.waitlisted) return 'LEAD';
  if (row.completed) return 'COMPLETED';
  const idleDays = (Date.now() - new Date(row.last_seen_at).getTime()) / 86_400_000;
  if (hasFeedback) return 'FEEDBACK';
  if (row.played) return idleDays > INACTIVE_DAYS ? 'INACTIVE' : 'ACTIVE';
  if (row.installed) return idleDays > INACTIVE_DAYS ? 'INACTIVE' : 'INSTALLED';
  if (row.opted_in) return 'JOINED';
  return 'INVITED';
}

// ─── router ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/betahub/, '').replace(/\/+$/, '') || '/';

  try {
    // ── public ───────────────────────────────────────────────────────────────

    if (route === '/public' && req.method === 'GET') {
      const [config, counts, posts, roadmap, ideas] = await Promise.all([
        readConfig(),
        db('beta_testers?select=id,waitlisted,opted_in,installed,played'),
        db('beta_posts?published=eq.true&select=*&order=pinned.desc,created_at.desc&limit=25'),
        db('beta_roadmap?select=*&order=sort.asc,created_at.asc'),
        db('beta_ideas?status=neq.declined&select=id,title,description,why,priority,status,votes,created_at&order=votes.desc,created_at.desc&limit=60'),
      ]);
      const all = counts ?? [];
      return json({
        ok: true,
        config,
        stats: {
          joined: all.filter((t: any) => !t.waitlisted).length,
          optedIn: all.filter((t: any) => t.opted_in).length,
          installed: all.filter((t: any) => t.installed).length,
          active: all.filter((t: any) => t.played).length,
          waitlist: all.filter((t: any) => t.waitlisted).length,
        },
        posts: posts ?? [],
        roadmap: roadmap ?? [],
        ideas: ideas ?? [],
      });
    }

    if (route === '/event' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const type = str(body.type, 40);
      if (!type) return fail('type required');
      if (await rateLimited(req, 'event', 400, 10)) return json({ ok: true, throttled: true });
      await db('beta_events', {
        method: 'POST',
        body: JSON.stringify([{
          type,
          visitor: str(body.visitor, 64),
          source: str(body.source, 40),
          campaign: str(body.campaign, 60),
          path: str(body.path, 120),
          meta: typeof body.meta === 'object' && body.meta ? body.meta : null,
        }]),
      });
      return json({ ok: true });
    }

    if (route === '/signup' && req.method === 'POST') {
      if (await rateLimited(req, 'signup', 12, 60)) {
        return fail('Too many signups from this connection. Try again in an hour.', 429);
      }
      const body = await req.json().catch(() => ({}));
      const nickname = str(body.nickname, 40);
      if (!nickname) return fail('Pick a nickname so we know who you are.');

      const contact = str(body.contact, 120);
      const contactKind = oneOf(body.contactKind, ['none', 'email', 'discord', 'other'], 'none');
      if (contactKind === 'email' && contact && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact)) {
        return fail('That email address does not look right.');
      }

      const config = await readConfig();
      const existing = await db('beta_testers?select=id,waitlisted');
      const joined = (existing ?? []).filter((t: any) => !t.waitlisted).length;
      const target = Number(config.targetTesters) || 20;
      const full = config.betaStatus === 'full' || (config.betaStatus !== 'open' && config.betaStatus !== 'launch');
      const waitlisted = Boolean(body.waitlist) || full || joined >= target;

      let referredBy: string | null = null;
      const refCode = str(body.ref, 12);
      if (refCode) {
        const rows = await db(`beta_testers?referral_code=eq.${encodeURIComponent(refCode.toUpperCase())}&select=id&limit=1`);
        referredBy = rows?.[0]?.id ?? null;
      }

      // Retry on the (astronomically unlikely) referral-code collision rather
      // than handing the visitor a 500 on the one form that matters most.
      let created: any = null;
      for (let attempt = 0; attempt < 4 && !created; attempt++) {
        try {
          const rows = await db('beta_testers', {
            method: 'POST',
            prefer: 'return=representation',
            body: JSON.stringify([{
              token: mintToken(),
              nickname,
              contact,
              contact_kind: contact ? contactKind : 'none',
              country: str(body.country, 60),
              device: str(body.device, 60),
              age_range: str(body.ageRange, 20),
              source: str(body.source, 40) ?? 'direct',
              campaign: str(body.campaign, 60),
              referral_code: mintReferralCode(),
              referred_by: referredBy,
              waitlisted,
              xp: XP.signup,
            }]),
          });
          created = rows?.[0];
        } catch (err) {
          if (attempt === 3) throw err;
        }
      }

      if (referredBy) await awardXp(referredBy, XP.referral);
      await db('beta_events', {
        method: 'POST',
        body: JSON.stringify([{
          type: waitlisted ? 'waitlist' : 'signup',
          tester_id: created.id,
          visitor: str(body.visitor, 64),
          source: created.source,
          campaign: created.campaign,
        }]),
      });

      return json({ ok: true, token: created.token, tester: publicTester(created), waitlisted });
    }

    if (route === '/me') {
      const tester = await testerFromToken(req);
      if (!tester) return fail('Unknown tester token. Sign up again to get a new one.', 404);

      if (req.method === 'GET') {
        const [feedback, bugs, ideas, referrals, earlier] = await Promise.all([
          db(`beta_feedback?tester_id=eq.${tester.id}&select=id,created_at,rating`),
          db(`beta_bugs?tester_id=eq.${tester.id}&select=id,created_at,title,status,severity`),
          db(`beta_ideas?tester_id=eq.${tester.id}&select=id,title,votes,status`),
          db(`beta_testers?referred_by=eq.${tester.id}&select=id,nickname,opted_in,installed,played,created_at`),
          // THIS tester's join position, not the running total. The "First 20"
          // badge has to stay earned once earned — deriving it from the live
          // headcount would silently revoke it from tester #5 the moment the
          // 21st person signed up.
          db(`beta_testers?waitlisted=eq.false&created_at=lte.${encodeURIComponent(tester.created_at)}&select=id`),
        ]);
        await db(`beta_testers?id=eq.${tester.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ last_seen_at: new Date().toISOString() }),
        });
        return json({
          ok: true,
          tester: publicTester(tester),
          rank: tester.waitlisted ? 0 : (earlier ?? []).length,
          feedbackCount: (feedback ?? []).length,
          bugs: bugs ?? [],
          ideas: ideas ?? [],
          referrals: (referrals ?? []).map((r: any) => ({
            nickname: r.nickname,
            joined: r.created_at,
            active: Boolean(r.played),
            installed: Boolean(r.installed),
          })),
          config: await readConfig(),
        });
      }

      if (req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        const patch: Record<string, unknown> = { last_seen_at: new Date().toISOString() };
        let gained = 0;

        // Each flag is one-way and only ever awards XP on the transition, so a
        // re-submitted form (or a double-tapped button) cannot farm XP.
        for (const step of ['opted_in', 'installed', 'played'] as const) {
          const camel = step === 'opted_in' ? 'optedIn' : step;
          if (body[camel] === true && !tester[step]) {
            patch[step] = true;
            gained += XP[step];
          }
        }

        const mission = str(body.mission, 60);
        if (mission) {
          const done: string[] = tester.missions_done ?? [];
          if (!done.includes(mission)) {
            patch.missions_done = [...done, mission].slice(0, 200);
            gained += XP.mission;
          }
        }

        if (gained > 0) patch.xp = (tester.xp ?? 0) + gained;

        const rows = await db(`beta_testers?id=eq.${tester.id}`, {
          method: 'PATCH',
          prefer: 'return=representation',
          body: JSON.stringify(patch),
        });
        return json({ ok: true, tester: publicTester(rows[0]), gainedXp: gained });
      }

      if (req.method === 'DELETE') {
        // Privacy: a tester can erase themselves. Feedback and bugs cascade or
        // detach per the schema's FK rules, so nothing personal survives.
        await db(`beta_testers?id=eq.${tester.id}`, { method: 'DELETE' });
        return json({ ok: true, deleted: true });
      }
    }

    if (route === '/feedback' && req.method === 'POST') {
      if (await rateLimited(req, 'feedback', 30, 60)) return fail('Slow down a moment.', 429);
      const tester = await testerFromToken(req);
      const body = await req.json().catch(() => ({}));
      const rating = intIn(body.rating, 1, 5);
      if (rating === null) return fail('Pick a star rating.');
      await db('beta_feedback', {
        method: 'POST',
        body: JSON.stringify([{
          tester_id: tester?.id ?? null,
          rating,
          mood: str(body.mood, 20),
          categories: strArray(body.categories, 12),
          best: str(body.best, 2000),
          confusing: str(body.confusing, 2000),
          change: str(body.change, 2000),
          keep: str(body.keep, 2000),
          stop: str(body.stop, 2000),
          app_version: str(body.appVersion, 20),
          hub_version: str(body.hubVersion, 20),
        }]),
      });
      if (tester) await awardXp(tester.id, XP.feedback);
      return json({ ok: true, gainedXp: tester ? XP.feedback : 0 });
    }

    if (route === '/bug' && req.method === 'POST') {
      if (await rateLimited(req, 'bug', 40, 60)) return fail('Slow down a moment.', 429);
      const tester = await testerFromToken(req);
      const body = await req.json().catch(() => ({}));
      const title = str(body.title, 140);
      if (!title) return fail('Give the bug a one-line title.');
      await db('beta_bugs', {
        method: 'POST',
        body: JSON.stringify([{
          tester_id: tester?.id ?? null,
          title,
          description: str(body.description, 4000),
          steps: str(body.steps, 4000),
          expected: str(body.expected, 1000),
          actual: str(body.actual, 1000),
          device: str(body.device, 80),
          android: str(body.android, 40),
          app_version: str(body.appVersion, 20),
          hub_version: str(body.hubVersion, 20),
          severity: oneOf(body.severity, ['low', 'medium', 'high', 'critical'], 'medium'),
          category: oneOf(
            body.category,
            ['crash', 'gameplay', 'ui', 'save', 'economy', 'performance', 'audio', 'ads', 'iap', 'other'],
            'other',
          ),
          attachment: str(body.attachment, 500),
        }]),
      });
      if (tester) await awardXp(tester.id, XP.bug);
      return json({ ok: true, gainedXp: tester ? XP.bug : 0 });
    }

    if (route === '/ideas' && req.method === 'GET') {
      const ideas = await db(
        'beta_ideas?status=neq.declined&select=id,title,description,why,priority,status,votes,created_at&order=votes.desc,created_at.desc&limit=120',
      );
      let voted: string[] = [];
      const tester = await testerFromToken(req);
      if (tester) {
        const rows = await db(`beta_idea_votes?tester_id=eq.${tester.id}&select=idea_id`);
        voted = (rows ?? []).map((r: any) => r.idea_id);
      }
      return json({ ok: true, ideas: ideas ?? [], voted });
    }

    if (route === '/idea' && req.method === 'POST') {
      if (await rateLimited(req, 'idea', 30, 60)) return fail('Slow down a moment.', 429);
      const tester = await testerFromToken(req);
      const body = await req.json().catch(() => ({}));
      const title = str(body.title, 140);
      if (!title) return fail('Name the feature in one line.');
      const rows = await db('beta_ideas', {
        method: 'POST',
        prefer: 'return=representation',
        body: JSON.stringify([{
          tester_id: tester?.id ?? null,
          title,
          description: str(body.description, 3000),
          why: str(body.why, 2000),
          priority: oneOf(body.priority, ['nice', 'want', 'need'], 'nice'),
        }]),
      });
      // The author's own vote is cast atomically with the idea, so a new idea
      // never renders at zero and the tally can never disagree with the ballots.
      if (tester) {
        await rpc('beta_cast_vote', { p_idea: rows[0].id, p_tester: tester.id });
        await awardXp(tester.id, XP.idea);
      }
      return json({ ok: true, idea: rows[0], gainedXp: tester ? XP.idea : 0 });
    }

    if (route === '/idea/vote' && req.method === 'POST') {
      const tester = await testerFromToken(req);
      if (!tester) return fail('Join the beta to vote on ideas.', 401);
      const body = await req.json().catch(() => ({}));
      const ideaId = str(body.id, 64);
      if (!ideaId || !/^[0-9a-f-]{36}$/i.test(ideaId)) return fail('Unknown idea.');
      const total = await rpc('beta_cast_vote', { p_idea: ideaId, p_tester: tester.id });
      if (total === null) return json({ ok: true, already: true });
      return json({ ok: true, votes: total });
    }

    // ── admin ────────────────────────────────────────────────────────────────

    if (route.startsWith('/admin')) {
      const denied = await requireAdmin(req);
      if (denied) return denied;
      const sub = route.replace('/admin', '') || '/';

      if (sub === '/overview' && req.method === 'GET') {
        const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
        const [testers, feedback, bugs, ideas, events, config] = await Promise.all([
          db('beta_testers?select=*&order=created_at.desc'),
          db('beta_feedback?select=id,tester_id,rating,mood,categories,best,confusing,change,keep,stop,created_at&order=created_at.desc&limit=200'),
          db('beta_bugs?select=*&order=created_at.desc&limit=200'),
          db('beta_ideas?select=*&order=votes.desc&limit=100'),
          db(`beta_events?created_at=gte.${since}&select=type,source,campaign,visitor,created_at`),
          readConfig(),
        ]);
        // Status is derived HERE and nowhere else. The CSV export and the admin
        // table read the same field, so a tester can never be "ACTIVE" in one
        // view and "INACTIVE" in the other.
        const feedbackBy = new Map<string, number>();
        for (const f of feedback ?? []) {
          if (f.tester_id) feedbackBy.set(f.tester_id, (feedbackBy.get(f.tester_id) ?? 0) + 1);
        }
        return json({
          ok: true,
          config,
          testers: (testers ?? []).map((t: any) => ({
            ...t,
            feedback_count: feedbackBy.get(t.id) ?? 0,
            status: deriveStatus(t, (feedbackBy.get(t.id) ?? 0) > 0),
          })),
          feedback: feedback ?? [],
          bugs: bugs ?? [],
          ideas: ideas ?? [],
          events: events ?? [],
        });
      }

      if (sub === '/tester' && req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        // Create a tester by hand (someone who DM'd you their details).
        if (!body.id) {
          const nickname = str(body.nickname, 40);
          if (!nickname) return fail('Nickname required.');
          const rows = await db('beta_testers', {
            method: 'POST',
            prefer: 'return=representation',
            body: JSON.stringify([{
              token: mintToken(),
              nickname,
              contact: str(body.contact, 120),
              contact_kind: oneOf(body.contactKind, ['none', 'email', 'discord', 'other'], 'none'),
              country: str(body.country, 60),
              device: str(body.device, 60),
              source: str(body.source, 40) ?? 'manual',
              campaign: str(body.campaign, 60),
              referral_code: mintReferralCode(),
              notes: str(body.notes, 2000),
              waitlisted: body.waitlisted === true,
            }]),
          });
          return json({ ok: true, tester: rows[0] });
        }
        const patch: Record<string, unknown> = {};
        for (const [key, column] of [
          ['nickname', 'nickname'], ['contact', 'contact'], ['country', 'country'],
          ['device', 'device'], ['notes', 'notes'], ['source', 'source'],
        ] as const) {
          if (key in body) patch[column] = str(body[key], 2000);
        }
        for (const flag of ['opted_in', 'installed', 'played', 'waitlisted', 'completed'] as const) {
          if (flag in body) patch[flag] = body[flag] === true;
        }
        if (!Object.keys(patch).length) return fail('Nothing to update.');
        const rows = await db(`beta_testers?id=eq.${encodeURIComponent(String(body.id))}`, {
          method: 'PATCH',
          prefer: 'return=representation',
          body: JSON.stringify(patch),
        });
        return json({ ok: true, tester: rows[0] });
      }

      if (sub === '/tester' && req.method === 'DELETE') {
        const id = url.searchParams.get('id') ?? '';
        if (!/^[0-9a-f-]{36}$/i.test(id)) return fail('Unknown tester.');
        await db(`beta_testers?id=eq.${id}`, { method: 'DELETE' });
        return json({ ok: true });
      }

      if (sub === '/bug' && req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        const id = str(body.id, 64);
        if (!id) return fail('Unknown bug.');
        await db(`beta_bugs?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: oneOf(body.status, ['open', 'triaged', 'fixed', 'wontfix', 'duplicate'], 'open'),
          }),
        });
        return json({ ok: true });
      }

      if (sub === '/idea' && req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        const id = str(body.id, 64);
        if (!id) return fail('Unknown idea.');
        await db(`beta_ideas?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: oneOf(
              body.status,
              ['new', 'considering', 'planned', 'building', 'shipped', 'declined'],
              'new',
            ),
          }),
        });
        return json({ ok: true });
      }

      if (sub === '/config' && req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        await writeConfig(body ?? {});
        return json({ ok: true, config: await readConfig() });
      }

      if (sub === '/post' && req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        const title = str(body.title, 160);
        const text = str(body.body, 8000);
        if (!title || !text) return fail('Title and body required.');
        const rows = await db('beta_posts', {
          method: 'POST',
          prefer: 'return=representation',
          body: JSON.stringify([{
            kind: oneOf(body.kind, ['announcement', 'devlog'], 'announcement'),
            title,
            body: text,
            pinned: body.pinned === true,
          }]),
        });
        return json({ ok: true, post: rows[0] });
      }

      if (sub === '/post' && req.method === 'DELETE') {
        const id = url.searchParams.get('id') ?? '';
        if (!/^[0-9a-f-]{36}$/i.test(id)) return fail('Unknown post.');
        await db(`beta_posts?id=eq.${id}`, { method: 'DELETE' });
        return json({ ok: true });
      }

      if (sub === '/roadmap' && req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        if (body.id) {
          await db(`beta_roadmap?id=eq.${encodeURIComponent(String(body.id))}`, {
            method: 'PATCH',
            body: JSON.stringify({
              column_key: oneOf(body.column, ['coming', 'building', 'done'], 'coming'),
            }),
          });
          return json({ ok: true });
        }
        const title = str(body.title, 160);
        if (!title) return fail('Title required.');
        const rows = await db('beta_roadmap', {
          method: 'POST',
          prefer: 'return=representation',
          body: JSON.stringify([{
            title,
            detail: str(body.detail, 1000),
            column_key: oneOf(body.column, ['coming', 'building', 'done'], 'coming'),
            sort: intIn(body.sort, 0, 999) ?? 0,
          }]),
        });
        return json({ ok: true, item: rows[0] });
      }

      if (sub === '/roadmap' && req.method === 'DELETE') {
        const id = url.searchParams.get('id') ?? '';
        if (!/^[0-9a-f-]{36}$/i.test(id)) return fail('Unknown roadmap item.');
        await db(`beta_roadmap?id=eq.${id}`, { method: 'DELETE' });
        return json({ ok: true });
      }

      if (sub === '/export' && req.method === 'GET') {
        const [testers, feedback, bugs] = await Promise.all([
          db('beta_testers?select=*&order=created_at.asc'),
          db('beta_feedback?select=tester_id'),
          db('beta_bugs?select=tester_id'),
        ]);
        const feedbackBy = new Map<string, number>();
        for (const f of feedback ?? []) {
          if (f.tester_id) feedbackBy.set(f.tester_id, (feedbackBy.get(f.tester_id) ?? 0) + 1);
        }
        const bugsBy = new Map<string, number>();
        for (const b of bugs ?? []) {
          if (b.tester_id) bugsBy.set(b.tester_id, (bugsBy.get(b.tester_id) ?? 0) + 1);
        }
        const rows = (testers ?? []).map((t: any) => ({
          ...t,
          feedback_count: feedbackBy.get(t.id) ?? 0,
          bug_count: bugsBy.get(t.id) ?? 0,
          status: deriveStatus(t, (feedbackBy.get(t.id) ?? 0) > 0),
        }));
        return new Response(toCsv(rows), {
          headers: {
            ...CORS,
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="deeplife-beta-testers.csv"',
          },
        });
      }
    }

    return fail(`No route for ${req.method} ${route}`, 404);
  } catch (error) {
    console.error('betahub error', error);
    return fail('Something broke on our side. Try again in a moment.', 500);
  }
});
