# Player-facing Discord update notes

Plan: replace linked PR titles with authored player benefits; protect live store
notes from GitHub links; verify offline and prepare a PR without posting.

The development watcher reads bullet points under `## Player update notes` in
merged PR descriptions. The PR template explains the opt-in format. Empty or
technical-only PRs are silently checkpointed; no generic invented feature copy.
HTML template comments and later internal sections never become notes. Identical
notes are deduplicated. Oversized announcements fail before posting/checkpointing
instead of silently dropping changes. Development copy explicitly says upcoming;
live release notes still use the existing authored store text and store links.

GitHub URLs/PR references are removed from both player-note paths. Development
announcements disable mentions. No live message or old post was edited, deleted,
backfilled or sent. Once merged, future scheduled posts use the new format.

Verification: focused Discord copy/parser tests and targeted ESLint; final
results and latest CI status are recorded in the PR. No gameplay/native changes.
