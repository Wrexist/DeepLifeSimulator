export type MemoryCategory = 'skill' | 'story' | 'warning' | 'achievement' | 'secret';

export interface Memory {
  id: string;
  title: string;
  description: string;
  category: MemoryCategory;
  generation: number; // Generation it originated from
  ancestorName: string;
  date: number; // Timestamp
  
  // Effects when unlocked/viewed/integrated
  effects?: {
    xpBonus?: { skillId: string; amount: number };
    happiness?: number;
    reputation?: number;
    unlockId?: string; // Unlocks specific content (career, item, etc.)
  };
  
  unlocked: boolean; // Has the current player unlocked/understood this memory?
  
  // Conditions to unlock this memory's benefits
  unlockCondition?: {
    age?: number;
    skillLevel?: { skillId: string; level: number };
    event?: string; // Triggered by specific event ID
    similarity?: number; // Requires similarity to ancestor (future feature)
  };
  
  tags: string[];
}

// Helper to create a memory ID
export const generateMemoryId = (generation: number, category: string): string => {
  return `mem_g${generation}_${category}_${Date.now().toString(36)}`;
};

// Memory templates for common life events
export const MEMORY_TEMPLATES = {
  mastered_skill: (skillName: string, ancestorName: string): Partial<Memory> => ({
    title: `Mastery of ${skillName}`,
    description: `${ancestorName} spent a lifetime mastering the art of ${skillName}. Their techniques feel familiar to your hands.`,
    category: 'skill',
    tags: ['skill', skillName.toLowerCase()],
  }),
  
  fortune_made: (amount: string, ancestorName: string): Partial<Memory> => ({
    title: 'The Family Fortune',
    description: `${ancestorName} amassed a great fortune of ${amount}. They left notes on their financial strategies.`,
    category: 'achievement',
    tags: ['wealth', 'money'],
  }),
  
  bankruptcy: (ancestorName: string): Partial<Memory> => ({
    title: 'A Lesson in Ruin',
    description: `${ancestorName} lost everything. The pain of their failure serves as a stark warning against reckless spending.`,
    category: 'warning',
    tags: ['money', 'failure'],
  }),
  
  criminal_mastermind: (ancestorName: string): Partial<Memory> => ({
    title: 'Shadows of the Past',
    description: `${ancestorName} walked the dark path so you wouldn't have to... or perhaps to show you the way.`,
    category: 'secret',
    tags: ['crime', 'secret'],
  }),
};

