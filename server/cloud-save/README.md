# Cloud save backend

The two edge functions behind **device backup** and the **leaderboard**.

| | |
|---|---|
| Provider | Supabase — the **same project** as the Beta Hub |
| Project | `deeplife-backend` (`gyxmoqanjdvvllwjfsst`), region `eu-north-1` |
| Functions | `save`, `leaderboard` (both `verify_jwt: false` — they authenticate themselves) |
| Base URL | `https://gyxmoqanjdvvllwjfsst.supabase.co/functions/v1/{save,leaderboard}` |
| Tables | `cloud_saves`, `leaderboard_entries`, `backend_config` |
| Client | `services/CloudSyncService.ts` → `lib/progress/cloud.ts` |
| Contract | **`docs/CLOUD-SAVE-BACKEND.md` is canonical** — it documents the wire format |

## Why this directory exists

Until 2026-08-20 the source of both deployed functions **existed nowhere in this
repo**. The only copy was the one running in Supabase, reachable through the
dashboard or the management API. That meant no review, no diff, no history, and
no way to answer "what changed?" — the code could be altered and nothing here
would show it.

That is not hypothetical. Both functions bumped `v1 → v2` at
**2026-08-20T16:48:06Z**, with byte-identical `updated_at` timestamps on both —
the signature of a platform-side rebundle rather than a hand edit, and the
source matched the documented contract exactly. But *establishing* that took an
API round trip and a careful read, because there was no baseline to diff
against. From this commit on, there is one.

## Layout

```text
server/cloud-save/
  save/index.ts         deployed as function slug `save`
  leaderboard/index.ts  deployed as function slug `leaderboard`
  schema.sql            the three tables, introspected from the live database
  README.md             this file
```

`save/index.ts` and `leaderboard/index.ts` are the **canonical** source. Edit
here, then deploy — never edit in the dashboard, or this directory silently goes
stale again and the whole point is lost.

## Auth

One shared bearer token, stored in `backend_config.cloud_auth_token` and checked
by both functions on every request.

**This token is not a real secret.** Unlike the Beta Hub's admin token, it ships
**inlined in the app bundle** (`EXPO_PUBLIC_CLOUD_AUTH_TOKEN`), so anyone with
the APK can extract it. It is an abuse barrier that keeps casual traffic out —
nothing more. Treat every request as potentially attacker-controlled and do not
rely on this token for anything that must actually hold.

The functions **fail closed**: if `cloud_auth_token` is missing from
`backend_config`, `expectedToken()` returns `null` and every request is
answered `401`.

## Deploying

Both functions are plain single-file Deno modules with no import map and no
local dependencies, so deployment is just the file.

```bash
supabase functions deploy save        --project-ref gyxmoqanjdvvllwjfsst
supabase functions deploy leaderboard --project-ref gyxmoqanjdvvllwjfsst
```

Confirm afterwards that the deployed source matches this directory — the
management API returns the live file, so a diff against it is the real check.

## Testing from outside

The repo sandbox cannot reach `*.supabase.co` (the agent proxy answers
`CONNECT tunnel failed, 403`), so a `curl` smoke test fails for reasons that
have nothing to do with the backend. Two options that do work:

- the Supabase MCP tools (`execute_sql`, `query_logs`, `get_edge_function`), or
- the `http` extension **from inside the database**, which has its own egress:

```sql
create extension if not exists http with schema extensions;
select (extensions.http_get('https://…/functions/v1/save?userId=…&slotId=slot_1')).status;
drop extension if exists http;   -- always drop it again; it is a tool, not schema
```
