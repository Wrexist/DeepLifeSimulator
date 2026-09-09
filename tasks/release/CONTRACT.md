# Deep Life Simulator: release execution contract

Work only in `Wrexist/DeepLifeSimulator`. Read `CLAUDE.md`, current `tasks/todo.md`,
`tasks/release/queue.json` and this package's evidence before acting. Refresh main,
open PRs and their checks. Historical audits are leads, never proof of current bugs.

1. Reproduce or measure the current player problem. Record the inspected commit.
2. Refine the selected master prompt with exact files, scope, non-goals and acceptance
   criteria. Prioritize save/payment/crash failures, then confusing or broken journeys.
3. Implement the smallest sustainable fix. Preserve accepted Home guidance, existing
   React Native design, economic rates unless explicitly in scope, schema migration
   rules, and narrow state subscriptions. Do not add speculative features to this release.
4. Prove the acceptance criteria with behavioral tests and applicable existing gates.
   A skipped or unreached check is unverified. UI changes require before/after captures
   and visual inspection. Web captures cannot close native iOS or StoreKit gates.
5. Review the resulting diff, update evidence and queue, commit, push a focused PR,
   then inspect CI on its latest SHA. Read failing logs and fix causes. Never weaken
   gates. Keep one package active. Local package evidence and candidate-wide remote CI are
   separate gates. Never mark either complete from prose alone.
6. Generate/refine the next eligible prompt and execute it without asking permission
   for routine reversible work. If an external gate blocks a package, record the exact
   missing proof and continue only independent work. Do not pretend it was completed.

`npm run release:next` prints the next package plus this contract. `release:status`
shows every package. `release:check` validates the ledger and exits nonzero until all
required packages are verified. These commands select/check work; an AI session or
scheduled task performs the work. They do not secretly run an AI service.

Merge is a production action in this repository: `.github/workflows/eas-update.yml`
publishes an OTA on main. Do not auto-merge, dispatch native builds, submit to Apple,
change store version records, rotate keys, enable analytics or send community messages
without the corresponding authorization. Prepare the concrete candidate first.

Completion means all agreed release gates passed for the candidate: no open P0/P1,
addressed in-scope P2s, applicable CI/preflight/export gates, device save/payment/ads/
accessibility checks, accurate store assets/metadata and a reviewed submission packet.
It never means a guarantee of zero undiscovered defects or Apple approval. App Store
approval is a separate external result. Stop expanding scope once these gates pass.

Evidence for every verified package: commit, commands/results, artifact references,
reviewed limitations, and remaining external gates. If code changes invalidate an
assertion, reopen that package. Old native evidence cannot certify a different binary.
