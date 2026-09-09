'use strict';

const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
const STATUSES = new Set(['pending', 'active', 'verified', 'blocked']);

function validateQueue(queue) {
  const errors = [];
  if (queue?.repository !== 'Wrexist/DeepLifeSimulator' || queue?.schemaVersion !== 1) {
    errors.push('Wrong repository or unsupported queue schema');
  }
  if (!Array.isArray(queue?.packages) || !queue.packages.length) return [...errors, 'Empty release queue'];
  const packages = queue.packages;
  const ids = new Set(packages.map(p => p?.id));
  if (ids.size !== packages.length) errors.push('Duplicate package IDs');
  if (packages.filter(p => p?.status === 'active').length > 1) errors.push('Only one package may be active');
  const byId = new Map(packages.map(p => [p?.id, p]));
  for (const p of packages) {
    if (!p || !/^R\d{2}$/.test(p.id) || !STATUSES.has(p.status) || !PRIORITIES.includes(p.priority) || !p.title) {
      errors.push('Invalid package identity, title or status');
      continue;
    }
    if (p.prompt !== `tasks/release/${p.id}.md`) errors.push(`${p.id}: invalid prompt path`);
    if (!Array.isArray(p.dependsOn) || p.dependsOn.some(id => !ids.has(id) || id === p.id)) {
      errors.push(`${p.id}: invalid dependencies`);
    }
    if (p.status === 'blocked' && !p.blocker?.trim()) errors.push(`${p.id}: missing blocker`);
    if (p.status === 'verified') {
      if (!Array.isArray(p.evidence) || !p.evidence.length || p.evidence.some(e =>
        !/^[a-f0-9]{7,40}$/.test(e?.commit ?? '') || !e?.result?.trim() ||
        !Array.isArray(e.references) || !e.references.length || e.references.some(r => typeof r !== 'string' || !r.trim()))) {
        errors.push(`${p.id}: verified requires commit, results and references`);
      }
    }
    if (['active', 'verified'].includes(p.status) && (Array.isArray(p.dependsOn) ? p.dependsOn : []).some(id => byId.get(id)?.status !== 'verified')) {
      errors.push(`${p.id}: prerequisite not verified`);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) { errors.push(`Dependency cycle at ${id}`); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    const deps = byId.get(id)?.dependsOn;
    for (const dep of Array.isArray(deps) ? deps : []) if (ids.has(dep)) visit(dep);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of ids) visit(id);
  return errors;
}

function nextPackage(queue) {
  const errors = validateQueue(queue);
  if (errors.length) throw new Error(errors.join('\n'));
  const verified = new Set(queue.packages.filter(p => p.status === 'verified').map(p => p.id));
  return queue.packages.find(p => p.status === 'active') ??
    queue.packages.filter(p => p.status === 'pending' && p.dependsOn.every(id => verified.has(id)))
      .sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority))[0] ?? null;
}

// Every browser branch must reach its acceptance checks. A clean but partial run
// is a failed release gate, not permission to ship.
const REQUIRED_BROWSER_CHECKS = [
  'A1-startup', 'A2-save-config', 'A3-fresh-life', 'A4-coherent-state', 'A5-tabs', 'A6-apps-grid',
  'B1-advance', 'B2-save', 'B3a-continue-offered', 'B3-relaunch-continuity',
  'C1-death-screen', 'C2-life-length', 'C3-escape-death', 'C4-lands-somewhere', 'C5-relaunch-after-death',
  'D1-revive', 'E-430-overflow', 'E-390-overflow', 'E-360-overflow',
  'F1-rapid-advance', 'F2-modal-churn', 'F3-kill-during-save',
  'G1-page-errors', 'G2-console-errors',
];
function browserGateFailures(results, required = REQUIRED_BROWSER_CHECKS) {
  if (!Array.isArray(results) || !results.length) return ['No browser evidence'];
  const errors = [];
  const ids = new Set();
  for (const r of results) {
    if (!r || typeof r.id !== 'string' || !['PASS', 'WARN', 'FAIL', 'UNREACHED'].includes(r.status)) {
      errors.push('Malformed browser result'); continue;
    }
    if (ids.has(r.id)) errors.push(`Duplicate browser check: ${r.id}`);
    ids.add(r.id);
    if (r.status === 'FAIL' || r.status === 'UNREACHED') errors.push(`${r.id}: ${r.status}`);
    if (r.status === 'WARN' && r.id !== 'G2-console-errors') errors.push(`${r.id}: unresolved warning`);
  }
  for (const id of required) if (!ids.has(id)) errors.push(`${id}: missing`);
  return errors;
}

module.exports = { validateQueue, nextPackage, browserGateFailures, REQUIRED_BROWSER_CHECKS };
