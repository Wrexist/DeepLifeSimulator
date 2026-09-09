# Deep Life Simulator: next-release workspace

Start with `npm run release:status`, then `npm run release:next`.
The queue is `queue.json`. The execution rules are `CONTRACT.md`.
The fresh audit and evidence live in `AUDIT.md`.

The R00–R11 files contain every currently planned master prompt, including native
and store gates. Refine each against current code when it becomes eligible.
A new issue enters the queue only with concrete evidence and a release impact.
Do not turn future content ideas into an endless release requirement.

An agent continues sequentially during its session. A scheduled continuation can
resume from this branch/PR, recheck CI and work on the next eligible package.
Blocked external work stays blocked and must not be silently signed off.
The read-only CLI never builds, merges, uploads, purchases or submits anything.

Status values: pending, active, verified, blocked. Only verified satisfies a
prerequisite. Verified means the package acceptance scope passed with recorded evidence.
Candidate-wide remote CI remains a separate R08 gate, even after local verification. Verified evidence must
include a commit, a result summary and at least one artifact/reference.
`release:check` exits 1 while any package is unverified, 2 for an invalid ledger.
