import { ImageSourcePropType } from 'react-native';
import { GameState } from '@/contexts/game/types';

export type MindsetId = 
  // Personality traits
  | 'frugal' | 'workaholic' | 'socialite' | 'optimist' | 'perfectionist' | 'adventurous'
  // Financial traits
  | 'gambler' | 'riskAverse' | 'investor' | 'spender' | 'hustler';

export type MindsetCategory = 'personality' | 'financial';

export interface MindsetTrait {
  id: MindsetId;
  name: string;
  description: string;
  category: MindsetCategory;
  icon: ImageSourcePropType;
}

// Personality-focused mindsets (affect behavior and lifestyle)
export const PERSONALITY_TRAITS: MindsetTrait[] = [
  {
    id: 'frugal',
    name: 'Frugal',
    description: 'You save a bit more, but big spending hurts your happiness slightly.',
    category: 'personality',
    icon: require('@/assets/images/Mindsets/Frugal_final.png'),
  },
  {
    id: 'workaholic',
    name: 'Workaholic',
    description: 'Higher income from work but faster burnout.',
    category: 'personality',
    icon: require('@/assets/images/Mindsets/Workaholic_final.png'),
  },
  {
    id: 'socialite',
    name: 'Socialite',
    description: 'Relationships grow faster, but you tend to spend more.',
    category: 'personality',
    icon: require('@/assets/images/Mindsets/Socialite_final.png'),
  },
  {
    id: 'optimist',
    name: 'Optimist',
    description: 'Happiness recovers faster, but you might overlook risks.',
    category: 'personality',
    icon: require('@/assets/images/Mindsets/Optimist_final.png'),
  },
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Better work quality and reputation gain, but higher stress.',
    category: 'personality',
    icon: require('@/assets/images/Mindsets/Perfectionist_final.png'),
  },
  {
    id: 'adventurous',
    name: 'Adventurous',
    description: 'Travel costs less and gives more happiness, but you get restless staying home.',
    category: 'personality',
    icon: require('@/assets/images/Mindsets/Adventurous_final.png'),
  },
];

// Financial-focused mindsets (affect money and investments)
export const FINANCIAL_TRAITS: MindsetTrait[] = [
  {
    id: 'gambler',
    name: 'Gambler',
    description: 'Higher risk, higher reward on risky actions.',
    category: 'financial',
    icon: require('@/assets/images/Mindsets/Gambler_final.png'),
  },
  {
    id: 'riskAverse',
    name: 'Risk Averse',
    description: 'You avoid big losses, but also cap your upside a bit.',
    category: 'financial',
    icon: require('@/assets/images/Mindsets/Risk Averse_final.png'),
  },
  {
    id: 'investor',
    name: 'Investor',
    description: 'Better returns on stocks and real estate, but higher initial costs.',
    category: 'financial',
    icon: require('@/assets/images/Mindsets/Investor_final.png'),
  },
  {
    id: 'spender',
    name: 'Big Spender',
    description: 'Shopping gives more happiness, but you tend to overspend.',
    category: 'financial',
    icon: require('@/assets/images/Mindsets/Big Spender_final.png'),
  },
  {
    id: 'hustler',
    name: 'Hustler',
    description: 'Extra income from side jobs, but can strain relationships.',
    category: 'financial',
    icon: require('@/assets/images/Mindsets/Hustler_final.png'),
  },
];

// All traits combined (for backwards compatibility)
export const MINDSET_TRAITS: MindsetTrait[] = [...PERSONALITY_TRAITS, ...FINANCIAL_TRAITS];

interface StatChange {
  moneyDelta?: number;
  healthDelta?: number;
  happinessDelta?: number;
}

export interface MindsetFeedback {
  message?: string;
  type?: 'bonus' | 'penalty' | 'info';
}

export function applyMindsetEffects(
  state: GameState,
  change: StatChange,
): StatChange & { feedback?: MindsetFeedback } {
  const traits = state.mindset?.traits as MindsetId[] | undefined;
  if (!traits || traits.length === 0) return change;

  let { moneyDelta = 0, healthDelta = 0, happinessDelta = 0 } = change;
  const feedbacks: MindsetFeedback[] = [];

  // Apply effects for all active traits
  for (const active of traits) {
  switch (active) {
    case 'frugal': {
      if (moneyDelta > 0) {
        const original = moneyDelta;
        moneyDelta *= 1.1;
        const bonus = Math.round(moneyDelta - original);
        if (bonus > 0) {
            feedbacks.push({
              message: `Frugal: You saved a bit extra (+${bonus.toLocaleString()})`,
            type: 'bonus',
            });
        }
      }
      if (moneyDelta < 0 && Math.abs(moneyDelta) > state.stats.money * 0.3) {
        happinessDelta -= 1;
          feedbacks.push({
          message: 'Frugal: Big spending hurts your happiness (-1)',
          type: 'penalty',
          });
      }
      break;
    }
    case 'gambler': {
      const original = moneyDelta;
      moneyDelta *= 1 + (Math.random() - 0.5) * 0.4; // ±20%
        const diff = Math.round(moneyDelta - original);
        if (Math.abs(diff) > 0) {
          feedbacks.push({
            message: `Gambler: ${diff > 0 ? 'Lucky!' : 'Unlucky!'} (${diff > 0 ? '+' : ''}${diff.toLocaleString()})`,
            type: diff > 0 ? 'bonus' : 'penalty',
          });
      }
      break;
    }
    case 'workaholic': {
      if (moneyDelta > 0) {
        const original = moneyDelta;
        moneyDelta *= 1.1;
        const bonus = Math.round(moneyDelta - original);
          healthDelta -= 1;
          happinessDelta -= 1;
        if (bonus > 0) {
            feedbacks.push({
              message: `Workaholic: +${bonus.toLocaleString()} income, -1 health, -1 happiness`,
            type: 'bonus',
            });
        }
      }
      break;
    }
    case 'socialite': {
      if (moneyDelta < 0) {
        const original = moneyDelta;
        moneyDelta *= 1.1;
        const extra = Math.round(Math.abs(moneyDelta - original));
        if (extra > 0) {
            feedbacks.push({
              message: `Socialite: Spent more on social activities (+${extra.toLocaleString()} extra)`,
            type: 'info',
            });
          }
        }
      break;
    }
    case 'riskAverse': {
      if (moneyDelta < 0) {
        const original = moneyDelta;
        moneyDelta *= 0.85;
        const saved = Math.round(Math.abs(moneyDelta - original));
        if (saved > 0) {
            feedbacks.push({
              message: `Risk Averse: Avoided bigger loss (saved ${saved.toLocaleString()})`,
            type: 'bonus',
            });
        }
      } else if (moneyDelta > 0) {
        const original = moneyDelta;
        moneyDelta *= 0.95;
        const reduced = Math.round(original - moneyDelta);
        if (reduced > 0) {
            feedbacks.push({
            message: `Risk Averse: Capped upside (${reduced.toLocaleString()} less)`,
            type: 'info',
            });
        }
        }
        break;
      }
      case 'optimist': {
        if (happinessDelta < 0) {
          happinessDelta = Math.ceil(happinessDelta * 0.7); // 30% less happiness loss
          feedbacks.push({
            message: 'Optimist: You stayed positive despite setbacks',
            type: 'bonus',
          });
        }
        break;
      }
      case 'perfectionist': {
        if (moneyDelta > 0) {
          const bonus = Math.round(moneyDelta * 0.05);
          moneyDelta += bonus;
          healthDelta -= 1; // Stress
          if (bonus > 0) {
            feedbacks.push({
              message: `Perfectionist: Quality work (+${bonus.toLocaleString()}, -1 health from stress)`,
              type: 'bonus',
            });
          }
        }
        break;
      }
      case 'adventurous': {
        // Effects handled elsewhere (travel system)
        break;
      }
      case 'investor': {
        // Effects handled in investment systems
        break;
      }
      case 'spender': {
        if (moneyDelta < 0) {
          happinessDelta += 2; // Shopping makes you happy
          feedbacks.push({
            message: 'Big Spender: Shopping therapy! (+2 happiness)',
            type: 'bonus',
          });
        }
        break;
      }
      case 'hustler': {
        if (moneyDelta > 0) {
          const bonus = Math.round(moneyDelta * 0.15);
          moneyDelta += bonus;
          feedbacks.push({
            message: `Hustler: Side income boost (+${bonus.toLocaleString()})`,
            type: 'bonus',
          });
      }
      break;
      }
    }
  }

  // Return first feedback (or combine if multiple)
  const feedback = feedbacks.length > 0 ? feedbacks[0] : undefined;
  return { moneyDelta, healthDelta, happinessDelta, feedback };
}


