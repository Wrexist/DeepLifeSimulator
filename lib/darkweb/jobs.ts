/**
 * Multi-stage dark-web jobs.
 *
 * Replaces the one-button "perform hack" model with staged operations:
 *
 *   Recon → Social Engineering → Exploit → Exfiltrate → Fence
 *
 * Each stage tests a specific skill against a difficulty. Failing a stage
 * mid-job means you lose progress and accrue heat — but you keep the gear
 * you bought and you can plan again.
 *
 * Pure functions: stage definitions, advancement, payoff math, skill XP.
 */

const safe = (n: number, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export type JobStageKind = 'recon' | 'social' | 'exploit' | 'exfiltrate' | 'fence';

export interface JobStageDef {
  kind: JobStageKind;
  /** Skill id that's tested. */
  skill: DarkWebSkillId;
  /** Difficulty 1..100. Compared against skill level × 10 + small bonus. */
  difficulty: number;
  /** Heat added on failure. Successful stages add a small amount of heat too. */
  heatOnFail: number;
  heatOnSuccess: number;
  /** Energy cost to attempt the stage. */
  energyCost: number;
}

export type DarkWebSkillId = 'hacking' | 'social' | 'opsec' | 'laundering';

export interface DarkWebSkill {
  level: number;
  xp: number;
  /** Next-level threshold. */
  nextLevelXp: number;
}

export interface DarkWebJobTemplate {
  id: string;
  name: string;
  description: string;
  category: 'data-theft' | 'fraud' | 'corporate' | 'crypto';
  stages: JobStageDef[];
  /** Payoff in BTC on successful completion. */
  payoutBtc: number;
  /** XP awarded to each skill on completion. */
  xpReward: Partial<Record<DarkWebSkillId, number>>;
  /** Minimum skill levels required to even start the job. */
  requiresSkills?: Partial<Record<DarkWebSkillId, number>>;
}

export interface ActiveJob {
  id: string;
  templateId: string;
  startedWeek: number;
  currentStage: number;
  /** Stages completed so far, oldest first. */
  completedStages: { stage: number; week: number; outcome: 'success' | 'fail' }[];
  /** weeksLived when the job expires if not completed. */
  expiresWeek: number;
  status: 'in-progress' | 'completed' | 'failed' | 'expired';
}

/**
 * Library of available jobs. Tier ascending in payout + difficulty.
 */
export const JOB_TEMPLATES: DarkWebJobTemplate[] = [
  {
    id: 'phish-pack',
    name: 'Phishing Campaign',
    description: 'Launch a mass-mail phishing op against a regional bank\'s customers.',
    category: 'fraud',
    stages: [
      { kind: 'recon',       skill: 'opsec',   difficulty: 20, heatOnFail: 4,  heatOnSuccess: 1, energyCost: 8 },
      { kind: 'social',      skill: 'social',  difficulty: 30, heatOnFail: 6,  heatOnSuccess: 2, energyCost: 12 },
      { kind: 'exfiltrate',  skill: 'hacking', difficulty: 25, heatOnFail: 8,  heatOnSuccess: 3, energyCost: 10 },
      { kind: 'fence',       skill: 'laundering', difficulty: 20, heatOnFail: 3, heatOnSuccess: 1, energyCost: 6 },
    ],
    payoutBtc: 0.04,
    xpReward: { social: 30, hacking: 10, opsec: 10, laundering: 10 },
  },
  {
    id: 'card-dump',
    name: 'Credit Card Dump',
    description: 'Skim a small-business POS for a few thousand card numbers.',
    category: 'data-theft',
    stages: [
      { kind: 'recon',       skill: 'opsec',     difficulty: 30, heatOnFail: 5,  heatOnSuccess: 1, energyCost: 10 },
      { kind: 'exploit',     skill: 'hacking',   difficulty: 50, heatOnFail: 10, heatOnSuccess: 3, energyCost: 15 },
      { kind: 'exfiltrate',  skill: 'hacking',   difficulty: 45, heatOnFail: 8,  heatOnSuccess: 3, energyCost: 12 },
      { kind: 'fence',       skill: 'laundering', difficulty: 40, heatOnFail: 6, heatOnSuccess: 2, energyCost: 10 },
    ],
    payoutBtc: 0.12,
    xpReward: { hacking: 40, opsec: 15, laundering: 25 },
    requiresSkills: { hacking: 2 },
  },
  {
    id: 'corp-breach',
    name: 'Corporate Data Breach',
    description: 'Compromise a Fortune-500 employee, pivot to internal databases, exfiltrate the customer table.',
    category: 'corporate',
    stages: [
      { kind: 'recon',       skill: 'opsec',     difficulty: 50, heatOnFail: 6,  heatOnSuccess: 2, energyCost: 12 },
      { kind: 'social',      skill: 'social',    difficulty: 60, heatOnFail: 10, heatOnSuccess: 3, energyCost: 18 },
      { kind: 'exploit',     skill: 'hacking',   difficulty: 70, heatOnFail: 14, heatOnSuccess: 5, energyCost: 20 },
      { kind: 'exfiltrate',  skill: 'hacking',   difficulty: 60, heatOnFail: 12, heatOnSuccess: 4, energyCost: 15 },
      { kind: 'fence',       skill: 'laundering', difficulty: 55, heatOnFail: 8, heatOnSuccess: 3, energyCost: 12 },
    ],
    payoutBtc: 0.6,
    xpReward: { hacking: 80, social: 40, opsec: 30, laundering: 40 },
    requiresSkills: { hacking: 4, social: 3 },
  },
  {
    id: 'crypto-exchange-pivot',
    name: 'Exchange Hot-Wallet Drain',
    description: 'Targeted attack on a small crypto exchange\'s hot wallet. Maximum payout, maximum heat.',
    category: 'crypto',
    stages: [
      { kind: 'recon',       skill: 'opsec',     difficulty: 70, heatOnFail: 8,  heatOnSuccess: 3, energyCost: 18 },
      { kind: 'social',      skill: 'social',    difficulty: 65, heatOnFail: 10, heatOnSuccess: 3, energyCost: 18 },
      { kind: 'exploit',     skill: 'hacking',   difficulty: 90, heatOnFail: 20, heatOnSuccess: 8, energyCost: 25 },
      { kind: 'exfiltrate',  skill: 'hacking',   difficulty: 85, heatOnFail: 18, heatOnSuccess: 7, energyCost: 20 },
      { kind: 'fence',       skill: 'laundering', difficulty: 80, heatOnFail: 15, heatOnSuccess: 6, energyCost: 18 },
    ],
    payoutBtc: 4.5,
    xpReward: { hacking: 200, social: 60, opsec: 80, laundering: 120 },
    requiresSkills: { hacking: 6, social: 4, laundering: 4 },
  },
];

// ---------------------------------------------------------------------------
// Skill helpers
// ---------------------------------------------------------------------------

export function xpForLevel(level: number): number {
  // 100, 250, 500, 1000, 2000, ...
  const lv = Math.max(1, safe(level, 1));
  return Math.round(100 * Math.pow(1.7, lv - 1));
}

export function initialSkill(): DarkWebSkill {
  return { level: 1, xp: 0, nextLevelXp: xpForLevel(1) };
}

export function awardSkillXp(skill: DarkWebSkill, amount: number): DarkWebSkill {
  let xp = safe(skill.xp) + Math.max(0, safe(amount));
  let level = Math.max(1, safe(skill.level, 1));
  let next = xpForLevel(level);
  while (xp >= next && level < 20) {
    xp -= next;
    level++;
    next = xpForLevel(level);
  }
  return { level, xp, nextLevelXp: next };
}

// ---------------------------------------------------------------------------
// Stage outcome math
// ---------------------------------------------------------------------------

/**
 * Probability of passing a stage given skill level and stage difficulty.
 * skillEffective = skill.level × 10 + small constant offset.
 * P(success) = sigmoid((skillEffective - difficulty) / 12).
 */
export function stageSuccessProbability(skillLevel: number, difficulty: number): number {
  const eff = Math.max(0, safe(skillLevel, 1) * 10 + 5);
  const diff = Math.max(1, safe(difficulty, 50));
  return 1 / (1 + Math.exp(-(eff - diff) / 12));
}

export interface StageAttemptResult {
  success: boolean;
  /** Heat to add (positive). */
  heatAdded: number;
  /** XP awarded to the tested skill. Stages award XP regardless of outcome (smaller on fail). */
  xpAwarded: number;
}

/**
 * Attempt a stage with a deterministic roll in [0, 1).
 */
export function attemptStage(
  stage: JobStageDef,
  skillLevel: number,
  roll: number
): StageAttemptResult {
  const p = stageSuccessProbability(skillLevel, stage.difficulty);
  const r = Math.max(0, Math.min(0.9999, safe(roll, 0.5)));
  const success = r < p;
  return {
    success,
    heatAdded: success ? stage.heatOnSuccess : stage.heatOnFail,
    xpAwarded: success ? Math.round(stage.difficulty / 5) : Math.round(stage.difficulty / 15),
  };
}

/**
 * Build an ActiveJob for a template, gated by required skills.
 */
export function startJob(
  template: DarkWebJobTemplate,
  skills: Record<DarkWebSkillId, DarkWebSkill>,
  startedWeek: number,
  lifetimeWeeks = 6
): { ok: true; job: ActiveJob } | { ok: false; reason: string } {
  if (template.requiresSkills) {
    for (const [skill, minLevel] of Object.entries(template.requiresSkills)) {
      const cur = skills[skill as DarkWebSkillId];
      if ((cur?.level ?? 0) < (minLevel ?? 0)) {
        return { ok: false, reason: `Requires ${skill} ≥ level ${minLevel}` };
      }
    }
  }
  return {
    ok: true,
    job: {
      id: `job-${template.id}-${startedWeek}-${Math.floor(Math.random() * 1e6).toString(36)}`,
      templateId: template.id,
      startedWeek,
      currentStage: 0,
      completedStages: [],
      expiresWeek: startedWeek + lifetimeWeeks,
      status: 'in-progress',
    },
  };
}
