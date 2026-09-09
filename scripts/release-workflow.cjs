#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { validateQueue, nextPackage } = require('./lib/releaseWorkflow.cjs');
const { validateEvidenceHistory } = require('./lib/releaseEvidence.cjs');
const root = path.resolve(__dirname, '..');
try {
  const queue = JSON.parse(fs.readFileSync(path.join(root, 'tasks/release/queue.json'), 'utf8'));
  const errors = validateQueue(queue);
  if (!errors.length) errors.push(...validateEvidenceHistory(queue, { cwd: root }));
  for (const p of queue.packages ?? []) {
    if (p.prompt === `tasks/release/${p.id}.md` && !fs.existsSync(path.join(root, p.prompt))) errors.push(`${p.id}: prompt missing`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  const command = process.argv[2] ?? 'status';
  if (command === 'next') {
    const next = nextPackage(queue);
    if (next) {
      console.log(fs.readFileSync(path.join(root, 'tasks/release/CONTRACT.md'), 'utf8'));
      console.log(fs.readFileSync(path.join(root, next.prompt), 'utf8'));
    } else console.log(queue.packages.every(p => p.status === 'verified')
      ? 'All ledger gates verified. Reconcile candidate evidence before owner submission.'
      : 'HOLD: no eligible package. Resolve the recorded external gates or prerequisites.');
  } else if (command === 'status' || command === 'check') {
    console.log(`Deep Life Simulator | binary ${queue.release.binaryVersion} | schema ${queue.release.stateVersion}`);
    for (const p of queue.packages) console.log(`${p.id} ${p.status.padEnd(8)} ${p.title}${p.blocker && p.status === 'blocked' ? ` — ${p.blocker}` : ''}`);
    const remaining = queue.packages.filter(p => p.status !== 'verified').length;
    console.log(remaining ? `HOLD: ${remaining} package(s) unverified.` : 'All ledger gates verified; Apple approval is separate.');
    if (command === 'check' && remaining) process.exitCode = 1;
  } else throw new Error('Usage: node scripts/release-workflow.cjs [status|next|check]');
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
