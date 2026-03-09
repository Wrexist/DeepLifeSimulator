/**
 * Career-specific event templates: performance reviews, workplace events, firing
 *
 * Performance is calculated from player stats each week:
 *   base 50 + (energy - 50) * 0.3 + (happiness - 50) * 0.2 + (health - 50) * 0.1
 * Clamped to 0-100. Below 30 triggers warnings; 3 warnings = terminated.
 */
import type { EventTemplate } from './engine';
import type { GameState } from '@/contexts/GameContext';

/** Helper: get current career performance (or estimate from stats) */
function getPerformance(state: GameState): number {
  if (!state.currentJob) return 0;
  const careers = Array.isArray(state.careers) ? state.careers : [];
  const career = careers.find(c => c && c.id === state.currentJob && c.accepted);
  if (!career) return 0;
  // Use stored performance if available, otherwise estimate from stats
  if (typeof career.performance === 'number') return career.performance;
  const s = state.stats || { energy: 50, happiness: 50, health: 50 };
  return Math.max(0, Math.min(100, 50 + (s.energy - 50) * 0.3 + (s.happiness - 50) * 0.2 + (s.health - 50) * 0.1));
}

function getCareerName(state: GameState): string {
  const careers = Array.isArray(state.careers) ? state.careers : [];
  const career = careers.find(c => c && c.id === state.currentJob && c.accepted);
  if (!career || !career.levels) return 'your job';
  const safeLevel = Math.max(0, Math.min(career.level, career.levels.length - 1));
  return career.levels[safeLevel]?.name || 'your job';
}

function getWeeksEmployed(state: GameState): number {
  const careers = Array.isArray(state.careers) ? state.careers : [];
  const career = careers.find(c => c && c.id === state.currentJob && c.accepted);
  if (!career?.startedWeeksLived) return 0;
  return (state.weeksLived || 0) - career.startedWeeksLived;
}

// ─── Performance Review (quarterly — every ~13 weeks) ───────────────
const performanceReview: EventTemplate = {
  id: 'performance_review',
  category: 'economy',
  weight: 0.25,
  condition: (state) => {
    if (!state.currentJob) return false;
    const weeksEmployed = getWeeksEmployed(state);
    // Only trigger after at least 12 weeks, and roughly quarterly
    return weeksEmployed >= 12 && weeksEmployed % 13 < 2;
  },
  generate: (state) => {
    const perf = getPerformance(state);
    const name = getCareerName(state);

    if (perf >= 75) {
      return {
        id: 'performance_review',
        description: `Your quarterly review as ${name} went great! Your manager praised your consistent work and mentioned a possible bonus.`,
        choices: [
          {
            id: 'thank',
            text: 'Thank them and keep pushing',
            effects: { money: 200, stats: { happiness: 10, reputation: 5 } },
          },
          {
            id: 'negotiate',
            text: 'Ask for a raise',
            effects: { money: perf >= 90 ? 500 : 100, stats: { reputation: perf >= 90 ? 5 : -2 } },
          },
        ],
      };
    } else if (perf >= 40) {
      return {
        id: 'performance_review',
        description: `Your quarterly review as ${name} was mixed. Your manager noted some areas for improvement but acknowledged your effort.`,
        choices: [
          {
            id: 'improve',
            text: 'Promise to improve',
            effects: { stats: { happiness: -5, energy: -5 } },
          },
          {
            id: 'excuse',
            text: 'Make excuses',
            effects: { stats: { reputation: -5 } },
            karma: { dimension: 'honesty', amount: -1, reason: 'Made excuses during performance review' },
          },
        ],
      };
    } else {
      return {
        id: 'performance_review',
        description: `Your quarterly review as ${name} was harsh. Your manager put you on a formal performance improvement plan. One more bad review could mean termination.`,
        choices: [
          {
            id: 'accept',
            text: 'Accept and work harder',
            effects: { stats: { happiness: -15, energy: -10 } },
          },
          {
            id: 'argue',
            text: 'Argue with your manager',
            effects: { stats: { happiness: -5, reputation: -10 } },
            karma: { dimension: 'loyalty', amount: -1, reason: 'Argued with manager during review' },
          },
        ],
      };
    }
  },
};

// ─── Formal Warning ─────────────────────────────────────────────────
const formalWarning: EventTemplate = {
  id: 'formal_warning',
  category: 'economy',
  weight: (state) => {
    const perf = getPerformance(state);
    if (perf < 20) return 0.4;
    if (perf < 35) return 0.2;
    return 0;
  },
  condition: (state) => {
    if (!state.currentJob) return false;
    const perf = getPerformance(state);
    return perf < 35 && getWeeksEmployed(state) >= 8;
  },
  generate: (state) => {
    const name = getCareerName(state);
    const careers = Array.isArray(state.careers) ? state.careers : [];
    const career = careers.find(c => c && c.id === state.currentJob && c.accepted);
    const warnings = (career?.warningsReceived || 0) + 1;

    return {
      id: 'formal_warning',
      description: `You've received a formal warning (${warnings}/3) at your job as ${name}. Your performance has been below expectations. ${warnings >= 2 ? 'One more and you could be terminated.' : 'Take this seriously.'}`,
      choices: [
        {
          id: 'accept_warning',
          text: 'Accept and commit to improving',
          effects: { stats: { happiness: -10, energy: -5 } },
          special: 'add_career_warning',
        },
        {
          id: 'push_back',
          text: 'Push back on the criticism',
          effects: { stats: { happiness: -5, reputation: -5 } },
          special: 'add_career_warning',
          karma: { dimension: 'honesty', amount: -1, reason: 'Denied legitimate performance criticism' },
        },
      ],
    };
  },
};

// ─── Termination (fired) ────────────────────────────────────────────
const jobTermination: EventTemplate = {
  id: 'job_termination',
  category: 'economy',
  weight: 0.5,
  condition: (state) => {
    if (!state.currentJob) return false;
    const careers = Array.isArray(state.careers) ? state.careers : [];
    const career = careers.find(c => c && c.id === state.currentJob && c.accepted);
    // Fire after 3 warnings OR extremely low performance for extended period
    return (career?.warningsReceived || 0) >= 3 || (getPerformance(state) < 15 && getWeeksEmployed(state) >= 16);
  },
  generate: (state) => {
    const name = getCareerName(state);
    return {
      id: 'job_termination',
      description: `Your manager has called you into the office. After repeated performance issues, the company has decided to let you go from your position as ${name}. You're being terminated effective immediately.`,
      choices: [
        {
          id: 'accept_termination',
          text: 'Accept and leave quietly',
          effects: { stats: { happiness: -20 } },
          special: 'fire_from_job',
          karma: { dimension: 'loyalty', amount: 1, reason: 'Accepted termination gracefully' },
        },
        {
          id: 'negotiate_severance',
          text: 'Negotiate a severance package',
          effects: { money: 500, stats: { happiness: -15 } },
          special: 'fire_from_job',
        },
      ],
    };
  },
};

// ─── Coworker Conflict ──────────────────────────────────────────────
const coworkerConflict: EventTemplate = {
  id: 'coworker_conflict',
  category: 'general',
  weight: 0.2,
  condition: (state) => Boolean(state.currentJob) && getWeeksEmployed(state) >= 4,
  generate: (state) => {
    const name = getCareerName(state);
    return {
      id: 'coworker_conflict',
      description: `A coworker at your ${name} position has been taking credit for your work and badmouthing you to management.`,
      choices: [
        {
          id: 'confront',
          text: 'Confront them directly',
          effects: { stats: { happiness: -5, reputation: 3 } },
          karma: { dimension: 'honesty', amount: 1, reason: 'Confronted dishonest coworker' },
        },
        {
          id: 'report',
          text: 'Report to HR',
          effects: { stats: { reputation: 5 } },
        },
        {
          id: 'ignore',
          text: 'Ignore it',
          effects: { stats: { happiness: -10, reputation: -5 } },
        },
      ],
    };
  },
};

// ─── Surprise Raise ─────────────────────────────────────────────────
const surpriseRaise: EventTemplate = {
  id: 'surprise_raise',
  category: 'economy',
  weight: 0.15,
  condition: (state) => {
    if (!state.currentJob) return false;
    return getPerformance(state) >= 80 && getWeeksEmployed(state) >= 20;
  },
  generate: (state) => {
    const name = getCareerName(state);
    const careers = Array.isArray(state.careers) ? state.careers : [];
    const career = careers.find(c => c && c.id === state.currentJob && c.accepted);
    const salary = career?.levels?.[career.level]?.salary || 100;
    const raiseAmount = Math.round(salary * 4); // ~4 weeks salary as bonus

    return {
      id: 'surprise_raise',
      description: `Your outstanding performance as ${name} hasn't gone unnoticed. Management is offering you a ${raiseAmount > 500 ? 'substantial' : 'modest'} bonus for your hard work!`,
      choices: [
        {
          id: 'accept_raise',
          text: `Accept the $${raiseAmount} bonus`,
          effects: { money: raiseAmount, stats: { happiness: 15, reputation: 5 } },
        },
        {
          id: 'negotiate_more',
          text: 'Push for even more',
          effects: {
            money: Math.random() > 0.4 ? Math.round(raiseAmount * 1.5) : Math.round(raiseAmount * 0.5),
            stats: { reputation: Math.random() > 0.4 ? 3 : -5 },
          },
        },
      ],
    };
  },
};

// ─── Office Party ───────────────────────────────────────────────────
const officeParty: EventTemplate = {
  id: 'office_party',
  category: 'general',
  weight: 0.15,
  condition: (state) => Boolean(state.currentJob) && getWeeksEmployed(state) >= 8,
  generate: () => ({
    id: 'office_party',
    description: 'Your workplace is throwing a party after work. Your coworkers are all going.',
    choices: [
      {
        id: 'attend',
        text: 'Attend the party',
        effects: { stats: { happiness: 10, energy: -10, reputation: 5 } },
        karma: { dimension: 'loyalty', amount: 1, reason: 'Participated in team bonding' },
      },
      {
        id: 'skip',
        text: 'Skip and go home',
        effects: { stats: { energy: 10, reputation: -3 } },
      },
    ],
  }),
};

// ─── Overtime Request ───────────────────────────────────────────────
const overtimeRequest: EventTemplate = {
  id: 'overtime_request',
  category: 'economy',
  weight: 0.25,
  condition: (state) => Boolean(state.currentJob),
  generate: (state) => {
    const careers = Array.isArray(state.careers) ? state.careers : [];
    const career = careers.find(c => c && c.id === state.currentJob && c.accepted);
    const salary = career?.levels?.[career.level]?.salary || 50;
    const overtimePay = Math.round(salary * 1.5);

    return {
      id: 'overtime_request',
      description: `Your manager asks if you can work overtime this week. The pay would be $${overtimePay} extra.`,
      choices: [
        {
          id: 'accept_overtime',
          text: 'Work the overtime',
          effects: { money: overtimePay, stats: { energy: -20, happiness: -8 } },
        },
        {
          id: 'decline_overtime',
          text: 'Decline politely',
          effects: { stats: { reputation: -2 } },
        },
      ],
    };
  },
};

// ─── Workplace Injury ───────────────────────────────────────────────
const workplaceInjury: EventTemplate = {
  id: 'workplace_injury',
  category: 'health',
  weight: 0.1,
  condition: (state) => Boolean(state.currentJob),
  generate: (state) => {
    const name = getCareerName(state);
    return {
      id: 'workplace_injury',
      description: `You've been injured on the job as ${name}. Your back is sore and you can barely move.`,
      choices: [
        {
          id: 'take_leave',
          text: 'Take medical leave',
          effects: { money: -200, stats: { health: 10, happiness: -5 } },
        },
        {
          id: 'push_through',
          text: 'Keep working through the pain',
          effects: { stats: { health: -15, energy: -15, reputation: 5 } },
        },
        {
          id: 'file_claim',
          text: 'File a workers comp claim',
          effects: { money: 300, stats: { reputation: -3 } },
        },
      ],
    };
  },
};

// ─── Boss Favoritism ────────────────────────────────────────────────
const bossFavoritism: EventTemplate = {
  id: 'boss_favoritism',
  category: 'general',
  weight: 0.15,
  condition: (state) => Boolean(state.currentJob) && getWeeksEmployed(state) >= 12,
  generate: (state) => {
    const name = getCareerName(state);
    return {
      id: 'boss_favoritism',
      description: `Your boss at ${name} is clearly showing favoritism to another employee, giving them the best projects and praising them in meetings.`,
      choices: [
        {
          id: 'speak_up',
          text: 'Speak to your boss about it',
          effects: { stats: { reputation: Math.random() > 0.5 ? 5 : -5, happiness: -5 } },
          karma: { dimension: 'honesty', amount: 1, reason: 'Addressed workplace favoritism' },
        },
        {
          id: 'outperform',
          text: 'Work harder to outshine them',
          effects: { stats: { energy: -15, reputation: 5 } },
          karma: { dimension: 'ambition', amount: 1, reason: 'Chose to outwork the competition' },
        },
        {
          id: 'accept_it',
          text: 'Accept it and move on',
          effects: { stats: { happiness: -8 } },
        },
      ],
    };
  },
};

// ─── Company Layoffs ────────────────────────────────────────────────
const companyLayoffs: EventTemplate = {
  id: 'company_layoffs',
  category: 'economy',
  weight: 0.08,
  condition: (state) => Boolean(state.currentJob) && getWeeksEmployed(state) >= 16,
  generate: (state) => {
    const name = getCareerName(state);
    const perf = getPerformance(state);
    // High performers have a better chance of surviving layoffs
    const surviveChance = perf >= 70 ? 0.85 : perf >= 50 ? 0.6 : 0.3;

    return {
      id: 'company_layoffs',
      description: `The company is going through a round of layoffs. As ${name}, your position might be at risk. Rumors say ${perf >= 70 ? 'top performers are safe' : 'nobody is safe'}.`,
      choices: [
        {
          id: 'stay_calm',
          text: 'Stay calm and keep working',
          effects: Math.random() < surviveChance
            ? { stats: { happiness: -10, reputation: 5 } }
            : { stats: { happiness: -25 } },
          special: Math.random() < surviveChance ? undefined : 'fire_from_job',
        },
        {
          id: 'volunteer_leave',
          text: 'Volunteer for the severance package',
          effects: { money: 1000, stats: { happiness: -10 } },
          special: 'fire_from_job',
        },
      ],
    };
  },
};

export const careerEventTemplates: EventTemplate[] = [
  performanceReview,
  formalWarning,
  jobTermination,
  coworkerConflict,
  surpriseRaise,
  officeParty,
  overtimeRequest,
  workplaceInjury,
  bossFavoritism,
  companyLayoffs,
];

/**
 * Calculate job performance from player stats.
 * Called each week to update career.performance.
 *
 * Formula: base 50, modified by how far stats are from 50 (neutral point)
 *   - Energy has the highest weight (0.3) — tired workers perform poorly
 *   - Happiness is secondary (0.2) — morale matters
 *   - Health is tertiary (0.1) — sick workers still show up
 */
export function calculatePerformance(stats: { energy: number; happiness: number; health: number }): number {
  const base = 50;
  const energyBonus = ((stats.energy || 50) - 50) * 0.3;
  const happinessBonus = ((stats.happiness || 50) - 50) * 0.2;
  const healthBonus = ((stats.health || 50) - 50) * 0.1;
  return Math.max(0, Math.min(100, Math.round(base + energyBonus + happinessBonus + healthBonus)));
}
