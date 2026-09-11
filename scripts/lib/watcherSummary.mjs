import fs from 'node:fs';

export function watcherSummary(message) {
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `- ${message}\n`);
}
