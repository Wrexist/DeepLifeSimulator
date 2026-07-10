#!/usr/bin/env node
// Validates App Store / Google Play character limits for locale files in this
// folder. Counts Unicode code points (what App Store Connect counts).
// Usage: node validate.js [file.md ...]   (no args = validate every *.md here)

const fs = require('fs');
const path = require('path');

const LIMITS = {
  app_name: 30,
  subtitle: 30,
  promotional_text: 170,
  keywords: 100,
  description: 4000,
  whats_new: 4000,
  gp_short_description: 80,
  gp_full_description: 4000,
};
const REQUIRED = Object.keys(LIMITS);

function parse(md) {
  const fields = {};
  const re = /^##\s+([a-z_]+)\s*$\r?\n+```(?:text)?\r?\n([\s\S]*?)\r?\n```/gm;
  let m;
  while ((m = re.exec(md)) !== null) fields[m[1]] = m[2];
  return fields;
}

function check(file) {
  const md = fs.readFileSync(file, 'utf8');
  const fields = parse(md);
  const problems = [];
  const report = [];
  for (const key of REQUIRED) {
    if (!(key in fields)) {
      problems.push(`MISSING field: ${key}`);
      continue;
    }
    const text = fields[key].trim();
    const n = [...text].length; // code points
    const limit = LIMITS[key];
    const ok = n <= limit && n > 0;
    report.push(`  ${ok ? 'ok ' : 'FAIL'} ${key.padEnd(22)} ${String(n).padStart(4)}/${limit}`);
    if (n === 0) problems.push(`EMPTY field: ${key}`);
    else if (n > limit) problems.push(`OVER LIMIT: ${key} is ${n}/${limit} (+${n - limit})`);
    if (key === 'keywords') {
      if (/,\s/.test(text)) problems.push('keywords: space after comma (wastes chars)');
      if (/\n/.test(text)) problems.push('keywords: contains newline');
      if (/bitlife|the sims/i.test(text)) problems.push('keywords: competitor trademark');
    }
  }
  console.log(path.basename(file));
  console.log(report.join('\n'));
  for (const p of problems) console.log(`  !! ${p}`);
  return problems.length === 0;
}

const args = process.argv.slice(2);
const files = args.length
  ? args
  : fs.readdirSync(__dirname).filter((f) => f.endsWith('.md') && !['BRIEF.md', 'README.md'].includes(f)).map((f) => path.join(__dirname, f));

let allOk = true;
for (const f of files) {
  try {
    if (!check(f)) allOk = false;
  } catch (e) {
    console.log(`${f}: ERROR ${e.message}`);
    allOk = false;
  }
  console.log('');
}
console.log(allOk ? 'ALL FILES PASS' : 'FAILURES FOUND');
process.exit(allOk ? 0 : 1);
