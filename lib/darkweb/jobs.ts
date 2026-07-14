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
 * Library of available jobs. MUST stay sorted by `payoutBtc` ascending — the
 * roster is a monotone risk/reward curve (higher payout ⇒ higher stage
 * difficulty, more heat, and a steeper skill gate), asserted by the tests. New
 * jobs are interleaved into the existing four (phish-pack / card-dump /
 * corp-breach / crypto-exchange-pivot) to fill in the curve from grind-tier
 * data-entry gigs up to an elite nation-state contract above the exchange drain.
 */
export const JOB_TEMPLATES: DarkWebJobTemplate[] = [
  {
    id: 'data-entry-gig',
    name: 'Ghost Data Entry',
    description: 'Grind bulk data-entry and CAPTCHA-solving for a botnet operator. Tedious, low-pay, low-risk.',
    category: 'fraud',
    stages: [
      { kind: 'recon',       skill: 'opsec',      difficulty: 10, heatOnFail: 2, heatOnSuccess: 1, energyCost: 5 },
      { kind: 'exfiltrate',  skill: 'hacking',    difficulty: 12, heatOnFail: 2, heatOnSuccess: 1, energyCost: 6 },
      { kind: 'fence',       skill: 'laundering', difficulty: 15, heatOnFail: 2, heatOnSuccess: 1, energyCost: 5 },
    ],
    payoutBtc: 0.01,
    xpReward: { opsec: 8, hacking: 6, laundering: 6 },
  },
  {
    id: 'survey-fraud',
    name: 'Survey Bot Farm',
    description: 'Run a farm of fake identities to drain paid-survey and sign-up referral bonuses.',
    category: 'fraud',
    stages: [
      { kind: 'recon',  skill: 'opsec',      difficulty: 12, heatOnFail: 3, heatOnSuccess: 1, energyCost: 6 },
      { kind: 'social', skill: 'social',     difficulty: 20, heatOnFail: 3, heatOnSuccess: 1, energyCost: 8 },
      { kind: 'fence',  skill: 'laundering', difficulty: 16, heatOnFail: 3, heatOnSuccess: 1, energyCost: 6 },
    ],
    payoutBtc: 0.02,
    xpReward: { social: 14, opsec: 8, laundering: 8 },
  },
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
    id: 'account-takeover',
    name: 'Account Takeover Kit',
    description: 'Credential-stuff a wave of reused passwords, seize the accounts, and resell them in bulk.',
    category: 'data-theft',
    stages: [
      { kind: 'recon',       skill: 'opsec',      difficulty: 28, heatOnFail: 5, heatOnSuccess: 1, energyCost: 10 },
      { kind: 'social',      skill: 'social',     difficulty: 30, heatOnFail: 6, heatOnSuccess: 2, energyCost: 12 },
      { kind: 'exploit',     skill: 'hacking',    difficulty: 40, heatOnFail: 8, heatOnSuccess: 3, energyCost: 14 },
      { kind: 'fence',       skill: 'laundering', difficulty: 32, heatOnFail: 5, heatOnSuccess: 2, energyCost: 10 },
    ],
    payoutBtc: 0.07,
    xpReward: { hacking: 35, social: 20, opsec: 12, laundering: 15 },
    requiresSkills: { hacking: 2 },
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
    id: 'sim-swap',
    name: 'SIM-Swap Heist',
    description: 'Social-engineer a carrier into porting a target\'s number, then drain their 2FA-guarded accounts.',
    category: 'fraud',
    stages: [
      { kind: 'recon',       skill: 'opsec',      difficulty: 40, heatOnFail: 6,  heatOnSuccess: 2, energyCost: 12 },
      { kind: 'social',      skill: 'social',     difficulty: 55, heatOnFail: 10, heatOnSuccess: 3, energyCost: 18 },
      { kind: 'exfiltrate',  skill: 'hacking',    difficulty: 45, heatOnFail: 8,  heatOnSuccess: 3, energyCost: 14 },
      { kind: 'fence',       skill: 'laundering', difficulty: 42, heatOnFail: 6,  heatOnSuccess: 2, energyCost: 12 },
    ],
    payoutBtc: 0.18,
    xpReward: { social: 50, opsec: 20, hacking: 20, laundering: 25 },
    requiresSkills: { social: 3 },
  },
  {
    id: 'ransomware-smb',
    name: 'SMB Ransomware',
    description: 'Deploy ransomware against a small business, exfiltrate first for double-extortion leverage, then collect.',
    category: 'corporate',
    stages: [
      { kind: 'recon',       skill: 'opsec',      difficulty: 45, heatOnFail: 7,  heatOnSuccess: 2, energyCost: 14 },
      { kind: 'exploit',     skill: 'hacking',    difficulty: 60, heatOnFail: 12, heatOnSuccess: 4, energyCost: 20 },
      { kind: 'exfiltrate',  skill: 'hacking',    difficulty: 50, heatOnFail: 9,  heatOnSuccess: 3, energyCost: 15 },
      { kind: 'fence',       skill: 'laundering', difficulty: 48, heatOnFail: 8,  heatOnSuccess: 3, energyCost: 12 },
    ],
    payoutBtc: 0.3,
    xpReward: { hacking: 70, opsec: 25, laundering: 35 },
    requiresSkills: { hacking: 3, laundering: 2 },
  },
  {
    id: 'medical-records',
    name: 'Medical Records Exfil',
    description: 'Breach a hospital network and lift a database of patient records for the identity-theft market.',
    category: 'data-theft',
    stages: [
      { kind: 'recon',       skill: 'opsec',      difficulty: 55, heatOnFail: 8,  heatOnSuccess: 3, energyCost: 14 },
      { kind: 'social',      skill: 'social',     difficulty: 45, heatOnFail: 8,  heatOnSuccess: 3, energyCost: 14 },
      { kind: 'exploit',     skill: 'hacking',    difficulty: 65, heatOnFail: 12, heatOnSuccess: 4, energyCost: 20 },
      { kind: 'exfiltrate',  skill: 'hacking',    difficulty: 60, heatOnFail: 11, heatOnSuccess: 4, energyCost: 16 },
      { kind: 'fence',       skill: 'laundering', difficulty: 50, heatOnFail: 8,  heatOnSuccess: 3, energyCost: 12 },
    ],
    payoutBtc: 0.45,
    xpReward: { hacking: 80, opsec: 35, social: 25, laundering: 30 },
    requiresSkills: { hacking: 3, opsec: 3 },
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
    id: 'wire-fraud-bec',
    name: 'BEC Wire Fraud',
    description: 'Business-email-compromise: impersonate an executive and trick finance into wiring a fortune to a mule.',
    category: 'fraud',
    stages: [
      { kind: 'recon',       skill: 'opsec',      difficulty: 55, heatOnFail: 8,  heatOnSuccess: 3, energyCost: 14 },
      { kind: 'social',      skill: 'social',     difficulty: 72, heatOnFail: 12, heatOnSuccess: 4, energyCost: 20 },
      { kind: 'exfiltrate',  skill: 'hacking',    difficulty: 55, heatOnFail: 10, heatOnSuccess: 3, energyCost: 15 },
      { kind: 'fence',       skill: 'laundering', difficulty: 68, heatOnFail: 12, heatOnSuccess: 4, energyCost: 18 },
    ],
    payoutBtc: 0.9,
    xpReward: { social: 90, laundering: 70, opsec: 35, hacking: 30 },
    requiresSkills: { social: 4, laundering: 4 },
  },
  {
    id: 'defi-flashloan',
    name: 'DeFi Flash-Loan Exploit',
    description: 'Exploit a re-entrancy bug with a flash loan and drain a DeFi liquidity pool in a single block.',
    category: 'crypto',
    stages: [
      { kind: 'recon',       skill: 'opsec',      difficulty: 60, heatOnFail: 9,  heatOnSuccess: 3, energyCost: 16 },
      { kind: 'exploit',     skill: 'hacking',    difficulty: 82, heatOnFail: 16, heatOnSuccess: 6, energyCost: 22 },
      { kind: 'exfiltrate',  skill: 'hacking',    difficulty: 75, heatOnFail: 14, heatOnSuccess: 5, energyCost: 18 },
      { kind: 'fence',       skill: 'laundering', difficulty: 70, heatOnFail: 12, heatOnSuccess: 4, energyCost: 18 },
    ],
    payoutBtc: 1.6,
    xpReward: { hacking: 150, laundering: 90, opsec: 60 },
    requiresSkills: { hacking: 5, laundering: 4 },
  },
  {
    id: 'supply-chain',
    name: 'Supply-Chain Backdoor',
    description: 'Compromise a software vendor and slip a backdoor into their update pipeline to reach thousands downstream.',
    category: 'corporate',
    stages: [
      { kind: 'recon',       skill: 'opsec',      difficulty: 70, heatOnFail: 12, heatOnSuccess: 4, energyCost: 18 },
      { kind: 'social',      skill: 'social',     difficulty: 68, heatOnFail: 12, heatOnSuccess: 4, energyCost: 18 },
      { kind: 'exploit',     skill: 'hacking',    difficulty: 86, heatOnFail: 18, heatOnSuccess: 6, energyCost: 24 },
      { kind: 'exfiltrate',  skill: 'hacking',    difficulty: 80, heatOnFail: 16, heatOnSuccess: 5, energyCost: 20 },
      { kind: 'fence',       skill: 'laundering', difficulty: 72, heatOnFail: 13, heatOnSuccess: 4, energyCost: 18 },
    ],
    payoutBtc: 2.6,
    xpReward: { hacking: 170, social: 70, opsec: 90, laundering: 80 },
    requiresSkills: { hacking: 5, social: 4, opsec: 4 },
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
  {
    id: 'apt-nation-state',
    name: 'Nation-State APT Contract',
    description: 'A deniable contract from a shadowy handler: burn a chain of zero-days against a hardened state target. Maximum everything.',
    category: 'corporate',
    stages: [
      { kind: 'recon',       skill: 'opsec',      difficulty: 82, heatOnFail: 12, heatOnSuccess: 5, energyCost: 22 },
      { kind: 'social',      skill: 'social',     difficulty: 78, heatOnFail: 14, heatOnSuccess: 5, energyCost: 20 },
      { kind: 'exploit',     skill: 'hacking',    difficulty: 95, heatOnFail: 22, heatOnSuccess: 9, energyCost: 26 },
      { kind: 'exfiltrate',  skill: 'hacking',    difficulty: 90, heatOnFail: 20, heatOnSuccess: 8, energyCost: 22 },
      { kind: 'fence',       skill: 'laundering', difficulty: 85, heatOnFail: 18, heatOnSuccess: 7, energyCost: 20 },
    ],
    payoutBtc: 7.5,
    xpReward: { hacking: 240, opsec: 120, social: 80, laundering: 140 },
    requiresSkills: { hacking: 8, opsec: 6, social: 5, laundering: 5 },
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
