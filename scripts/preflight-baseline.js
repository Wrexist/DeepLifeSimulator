#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const quick = args.includes('--quick');
const outArgIndex = args.indexOf('--out');
const explicitOut = outArgIndex >= 0 ? args[outArgIndex + 1] : undefined;

const now = new Date();
const dateStamp = now.toISOString().slice(0, 10);
const outputPath = explicitOut
  ? path.resolve(process.cwd(), explicitOut)
  : path.resolve(process.cwd(), 'tasks', `baseline-failures-${dateStamp}.md`);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function extractNumber(output, pattern) {
  const match = output.match(pattern);
  if (!match || !match[1]) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTypeCheck(output) {
  let errors = extractNumber(output, /Found\s+(\d+)\s+errors?/i);
  let files = extractNumber(output, /errors?\s+in\s+(\d+)\s+files?/i);

  if (errors === null) {
    const errorMatches = output.match(/error TS\d+:/g) || [];
    errors = errorMatches.length;
  }

  if (files === null) {
    const fileMatches = output.match(/^(.+?)\(\d+,\d+\): error TS\d+:/gm) || [];
    const uniqueFiles = new Set(fileMatches.map((line) => line.split('(')[0]));
    files = uniqueFiles.size;
  }

  return { errors, files };
}

function parseLint(output) {
  const problems = extractNumber(output, /[✖x]\s+(\d+)\s+problems?/i);
  const errors = extractNumber(output, /problems?\s+\((\d+)\s+errors?/i);
  const warnings = extractNumber(output, /errors?,\s*(\d+)\s+warnings?\)/i);
  return { problems, errors, warnings };
}

function parseJest(output) {
  const suitesFailed = extractNumber(output, /Test Suites:\s+(\d+)\s+failed/i);
  const suitesPassed = extractNumber(output, /Test Suites:.*?(\d+)\s+passed/i);
  const suitesTotal = extractNumber(output, /Test Suites:.*?(\d+)\s+total/i);
  const testsFailed = extractNumber(output, /Tests:\s+(\d+)\s+failed/i);
  const testsPassed = extractNumber(output, /Tests:.*?(\d+)\s+passed/i);
  const testsTotal = extractNumber(output, /Tests:.*?(\d+)\s+total/i);
  return {
    suitesFailed,
    suitesPassed,
    suitesTotal,
    testsFailed,
    testsPassed,
    testsTotal,
  };
}

function runStep(step) {
  const startedAt = Date.now();
  const commandLine = [step.command, ...step.args].join(' ');
  const result = spawnSync(commandLine, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: true,
    maxBuffer: 30 * 1024 * 1024,
  });
  const durationMs = Date.now() - startedAt;
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  return { ...step, commandLine, exitCode, durationMs, output };
}

function markdownStep(stepResult) {
  const status = stepResult.exitCode === 0 ? 'PASS' : 'FAIL';
  let parsed = {};
  if (stepResult.id === 'type-check') parsed = parseTypeCheck(stepResult.output);
  if (stepResult.id === 'lint') parsed = parseLint(stepResult.output);
  if (stepResult.id === 'test') parsed = parseJest(stepResult.output);

  const summaryLines = stepResult.output
    .split(/\r?\n/)
    .filter((line) => /(Found\s+\d+\s+errors?|problems?\s*\(|Test Suites:|Tests:)/i.test(line))
    .slice(-3);

  return [
    `### ${stepResult.title}`,
    `- Command: \`${stepResult.commandLine}\``,
    `- Status: ${status} (exit ${stepResult.exitCode})`,
    `- Duration: ${(stepResult.durationMs / 1000).toFixed(1)}s`,
    `- Parsed: \`${JSON.stringify(parsed)}\``,
    ...(summaryLines.length > 0
      ? ['- Key output:', ...summaryLines.map((line) => `  - \`${line.trim()}\``)]
      : ['- Key output: `(no summary line matched)`']),
    '',
  ].join('\n');
}

function main() {
  const steps = [
    {
      id: 'type-check',
      title: 'Type Check Baseline',
      command: npmCommand,
      args: ['run', 'type-check', '--', '--pretty', 'false'],
    },
    {
      id: 'lint',
      title: 'Lint Baseline',
      command: npmCommand,
      args: ['run', 'lint'],
    },
  ];

  if (!quick) {
    steps.push({
      id: 'test',
      title: 'Test Baseline',
      command: npmCommand,
      args: ['run', 'test', '--', '--watch=false', '--runInBand'],
    });
  }

  const results = steps.map(runStep);
  const content = [
    '# Baseline Failures Report',
    '',
    `- Generated: ${now.toISOString()}`,
    `- CWD: \`${process.cwd()}\``,
    `- Mode: ${quick ? 'quick (type-check + lint)' : 'full (type-check + lint + test)'}`,
    '',
    ...results.map(markdownStep),
  ].join('\n');

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, 'utf8');

  console.log(`Baseline report written to: ${outputPath}`);

  const failedSteps = results.filter((step) => step.exitCode !== 0).map((step) => step.id);
  if (failedSteps.length > 0) {
    console.log(`Detected baseline failures in: ${failedSteps.join(', ')}`);
  } else {
    console.log('No baseline failures detected.');
  }
}

main();
