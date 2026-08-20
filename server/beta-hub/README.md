# Beta Hub backend

The API behind the **Deep Life Simulator Beta Hub** (`support-site/android/`).

| | |
|---|---|
| Provider | Supabase — the **same project** as cloud save / leaderboard / analytics |
| Project | `deeplife-backend` (`gyxmoqanjdvvllwjfsst`), region `eu-north-1` |
| Function | `betahub` (`verify_jwt: false` — it authenticates itself, see below) |
| Base URL | `https://gyxmoqanjdvvllwjfsst.supabase.co/functions/v1/betahub` |
| Tables | `beta_config`, `beta_testers`, `beta_feedback`, `beta_bugs`, `beta_ideas`, `beta_idea_votes`, `beta_events`, `beta_posts`, `beta_roadmap`, `beta_ratelimit` |

Everything is **additive**. Nothing here touches `cloud_saves`,
`leaderboard_entries`, `analytics_events` or `backend_config`, and the game app
does not read any of it.

`index.ts` is the canonical source. `schema.sql` is the canonical schema; both
are already applied to the project above.

---

## Auth, in three tiers

| Tier | Credential | Reaches |
|---|---|---|
| **Public** | none | `/public`, `/event`, `/signup`, `/feedback`, `/bug`, `/idea`, `/ideas` |
| **Tester** | `X-Tester-Token` | `/me` (GET/POST/DELETE), `/idea/vote` |
| **Admin** | `Authorization: Bearer …` | everything under `/admin` |

**The tester token** is minted server-side at signup and handed to that browser
once. It reaches exactly one tester row. It is a capability, not an account —
there is no password to lose and nothing to reset.

**The admin token is a real secret**, unlike the game's `cloud_auth_token`
(which ships inlined in the app bundle and is only an abuse barrier). It is:

- never in this repo,
- never in the published site,
- never in the database — only its **SHA-256 digest** is stored, in
  `beta_config.admin_token`,
- typed into `admin.html` by the operator and held in that tab's
  `sessionStorage` until the tab closes.

`POST /admin/config` writes through an **allow-list** that deliberately excludes
`admin_token`, so the settings form cannot escalate privileges, and `readConfig`
skips the key so no response can echo it back.

### Setting or rotating the admin token

`schema.sql` creates `beta_config` empty — it seeds no `admin_token` row. Until
one exists every `/admin` route answers **503 `admin token is not configured on
this deployment`**, so this is a required setup step on a new project, not only
a rotation step.

```bash
# 1. mint a new one and hash it (never paste the plaintext anywhere but the admin page)
node -e "const c=require('crypto');const t=c.randomBytes(24).toString('base64url');\
console.log('token:',t);console.log('hash :',c.createHash('sha256').update(t).digest('hex'))"
```

```sql
-- 2. store ONLY the hash. Upsert, not update: on a fresh project there is no
-- row to update, and a bare UPDATE would match zero rows, report success, and
-- leave every admin route answering 503 with nothing to show for it.
insert into public.beta_config (key, value, updated_at)
values ('admin_token', jsonb_build_object('v', '<hash>'), now())
on conflict (key) do update
   set value = excluded.value, updated_at = excluded.updated_at;
```

Verify it landed — this must print `64`, the length of a SHA-256 hex digest:

```sql
select length(value->>'v') from public.beta_config where key = 'admin_token';
```

The old token stops working immediately. Any open admin tab keeps its stale
token in memory until it is reloaded.

---

## Row-level security

RLS is **enabled on every table with no policies**, matching the posture
documented in `docs/CLOUD-SAVE-BACKEND.md`: `anon` and `authenticated` can do
nothing at all, and the edge function reaches the tables with the service role.
The Supabase linter reports `rls_enabled_no_policy` as INFO — that is intended,
not a gap.

---

## Endpoints

### Public

| Method | Path | Notes |
|---|---|---|
| `GET` | `/public` | Config, live counts, announcements, roadmap, top ideas. The only call the landing page needs. |
| `POST` | `/event` | First-party funnel event. Holds a random visitor id, never an IP or anything personal. |
| `POST` | `/signup` | Creates a tester, returns `{ token, tester, waitlisted }`. Routes to the waitlist automatically once the target is reached. |
| `POST` | `/feedback` · `/bug` · `/idea` | Accepts an `X-Tester-Token` if present; works anonymously without one. |
| `GET` | `/ideas` | The board, plus which ideas the calling tester has already voted for. |

### Tester (`X-Tester-Token`)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/me` | Tester, join rank, referrals, their bugs and ideas, current config. |
| `POST` | `/me` | Funnel confirmations and mission completions. Flags are one-way; XP is awarded only on a first-time transition, so a double tap pays once. |
| `DELETE` | `/me` | Privacy erase. Feedback cascades; bugs and ideas are detached rather than deleted, so the report survives without the person. |
| `POST` | `/idea/vote` | One vote per tester, enforced by a primary key inside `beta_cast_vote`. |

### Admin (`Authorization: Bearer …`)

`GET /admin/overview` · `POST|DELETE /admin/tester` · `POST /admin/bug` ·
`POST /admin/idea` · `POST /admin/config` · `POST|DELETE /admin/post` ·
`POST|DELETE /admin/roadmap` · `GET /admin/export` (CSV).

---

## What this deliberately does not do

- **It has no visibility into Google Play and never claims any.** `opted_in`,
  `installed` and `played` are the tester's own confirmations, made in their own
  dashboard. Nothing polls, scrapes or infers Play Store state.
- **It sends no messages.** The admin dashboard hands you copy to send yourself.
  A tester gave a contact method for beta instructions, not for automated mail,
  and a message from a person is what actually gets replies.
- **It cannot manufacture engagement.** XP comes only from actions inside this
  hub, and every award is gated on a first-time transition checked against the
  stored row.

---

## Redeploying

```bash
supabase functions deploy betahub \
  --project-ref gyxmoqanjdvvllwjfsst \
  --no-verify-jwt
```

Run from a directory where `supabase/functions/betahub/index.ts` is this file,
or pass `--use-api` with the file. `--no-verify-jwt` is required: the function
does its own auth and must be reachable from a static page with no Supabase
session.

To re-apply the schema on a fresh project, run `schema.sql`, then insert the
admin-token hash as above.

## Housekeeping

```sql
-- remove a roadmap item or an announcement
delete from public.beta_roadmap where title = '…';
delete from public.beta_posts    where title = '…';

-- expired rate-limit buckets (the function sweeps these itself; this is a manual catch-up)
delete from public.beta_ratelimit where expires_at < now();
```
