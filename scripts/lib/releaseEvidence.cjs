'use strict';
const { execFileSync } = require('node:child_process');

// Shape validation is useful for editing, but cannot establish provenance.
// Resolve every evidence entry (including partial work in blocked packages)
// against the candidate. Never turn missing/shallow history into a pass.
function validateEvidenceHistory(queue, { cwd, candidate = 'HEAD' } = {}) {
  const errors = [];
  const git = (...args) => execFileSync('git', args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  let head;
  try { head = git('rev-parse', '--verify', '--end-of-options', `${candidate}^{commit}`); }
  catch { return ['Candidate commit unavailable; fetch candidate history before verifying evidence']; }
  for (const p of queue.packages ?? []) {
    for (const e of p.evidence ?? []) {
      if (!/^[a-f0-9]{7,40}$/.test(e?.commit ?? '')) {
        errors.push(`${p.id}: invalid evidence commit`);
        continue;
      }
      let commit;
      try { commit = git('rev-parse', '--verify', `${e.commit}^{commit}`); }
      catch {
        errors.push(`${p.id}: evidence commit ${e.commit} unavailable or ambiguous; fetch full history and verify published provenance`);
        continue;
      }
      try { git('merge-base', '--is-ancestor', commit, head); }
      catch { errors.push(`${p.id}: evidence commit ${e.commit} is not a proven ancestor of candidate ${head}; check branch or fetch missing history`); }
    }
  }
  return errors;
}

module.exports = { validateEvidenceHistory };
