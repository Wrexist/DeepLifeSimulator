import type { GameState, Disease } from '@/contexts/game/types';

/**
 * Disease template interface for defining disease types
 */
export interface DiseaseTemplate {
  id: string;
  name: string;
  severity: 'mild' | 'serious' | 'critical';
  effects: Partial<import('@/contexts/game/types').GameStats>;
  curable: boolean;
  treatmentRequired?: boolean;
  weeksUntilDeath?: number;
  naturalRecoveryWeeks?: number;
  description: string;
  preventionTips: string[];
  ageRiskModifier: number; // Multiplier for age-based risk
  healthRiskModifier: number; // Multiplier for health-based risk
  fitnessRiskModifier: number; // Multiplier for fitness-based risk
  baseChance: number; // Base chance of this disease (0-1)
  chronic?: boolean; // If true, disease is manageable but not curable
}

/**
 * Disease definitions library
 * Contains all disease templates with their properties
 */
export const DISEASE_DEFINITIONS: DiseaseTemplate[] = [
  // Mild Diseases
  {
    id: 'common_cold',
    name: 'Common Cold',
    severity: 'mild',
    effects: {
      health: -2,
      energy: -3,
      happiness: -1,
    },
    curable: true,
    treatmentRequired: false,
    naturalRecoveryWeeks: 2,
    description: 'A mild viral infection causing runny nose, sneezing, and fatigue.',
    preventionTips: [
      'Wash hands regularly',
      'Get plenty of rest',
      'Stay hydrated',
    ],
    ageRiskModifier: 1.0,
    healthRiskModifier: 1.2, // Slightly higher risk with low health
    fitnessRiskModifier: 1.1,
    baseChance: 0.015, // 1.5% base chance per week
  },
  {
    id: 'minor_infection',
    name: 'Minor Infection',
    severity: 'mild',
    effects: {
      health: -3,
      energy: -2,
    },
    curable: true,
    treatmentRequired: false,
    naturalRecoveryWeeks: 3,
    description: 'A small bacterial infection that causes mild discomfort.',
    preventionTips: [
      'Keep wounds clean',
      'Maintain good hygiene',
    ],
    ageRiskModifier: 1.0,
    healthRiskModifier: 1.3,
    fitnessRiskModifier: 1.0,
    baseChance: 0.01, // 1% base chance
  },
  {
    id: 'fatigue',
    name: 'Chronic Fatigue',
    severity: 'mild',
    effects: {
      energy: -5,
      happiness: -2,
    },
    curable: true,
    treatmentRequired: false,
    naturalRecoveryWeeks: 4,
    description: 'Persistent tiredness and lack of energy affecting daily activities.',
    preventionTips: [
      'Get adequate sleep',
      'Manage stress levels',
      'Maintain regular exercise',
    ],
    ageRiskModifier: 1.1,
    healthRiskModifier: 1.4,
    fitnessRiskModifier: 1.5, // Higher risk with low fitness
    baseChance: 0.012,
  },
  {
    id: 'stress',
    name: 'High Stress',
    severity: 'mild',
    effects: {
      happiness: -4,
      energy: -2,
      health: -1,
    },
    curable: true,
    treatmentRequired: false,
    naturalRecoveryWeeks: 3,
    description: 'Elevated stress levels affecting mental and physical well-being.',
    preventionTips: [
      'Practice meditation',
      'Take breaks from work',
      'Engage in hobbies',
    ],
    ageRiskModifier: 1.0,
    healthRiskModifier: 1.2,
    fitnessRiskModifier: 1.3,
    baseChance: 0.02, // 2% base chance
  },

  // Serious Diseases
  {
    id: 'flu',
    name: 'Influenza',
    severity: 'serious',
    effects: {
      health: -5,
      energy: -8,
      happiness: -3,
      fitness: -2,
    },
    curable: true,
    treatmentRequired: true,
    naturalRecoveryWeeks: 4,
    description: 'A serious viral infection causing fever, body aches, and severe fatigue.',
    preventionTips: [
      'Get annual flu vaccination',
      'Avoid close contact with sick people',
      'Maintain strong immune system',
    ],
    ageRiskModifier: 1.2, // Higher risk for older players
    healthRiskModifier: 1.5,
    fitnessRiskModifier: 1.3,
    baseChance: 0.008, // 0.8% base chance
  },
  {
    id: 'pneumonia',
    name: 'Pneumonia',
    severity: 'serious',
    effects: {
      health: -8,
      energy: -10,
      happiness: -4,
      fitness: -3,
    },
    curable: true,
    treatmentRequired: true,
    naturalRecoveryWeeks: 6,
    description: 'A lung infection causing difficulty breathing, chest pain, and severe fatigue.',
    preventionTips: [
      'Get pneumonia vaccine',
      'Avoid smoking',
      'Treat respiratory infections early',
    ],
    ageRiskModifier: 1.5, // Much higher risk for older players
    healthRiskModifier: 1.8,
    fitnessRiskModifier: 1.4,
    baseChance: 0.005, // 0.5% base chance
  },
  {
    id: 'diabetes',
    name: 'Type 2 Diabetes',
    severity: 'serious',
    effects: {
      health: -4,
      energy: -3,
      fitness: -5,
    },
    curable: false,
    treatmentRequired: true,
    chronic: true,
    description: 'A chronic condition affecting blood sugar regulation. Requires ongoing management.',
    preventionTips: [
      'Maintain healthy weight',
      'Exercise regularly',
      'Eat balanced diet',
    ],
    ageRiskModifier: 1.8, // Much higher risk with age
    healthRiskModifier: 1.6,
    fitnessRiskModifier: 2.0, // Much higher risk with low fitness
    baseChance: 0.003, // 0.3% base chance
  },
  {
    id: 'high_blood_pressure',
    name: 'High Blood Pressure',
    severity: 'serious',
    effects: {
      health: -3,
      energy: -2,
      fitness: -3,
    },
    curable: false,
    treatmentRequired: true,
    chronic: true,
    description: 'Elevated blood pressure requiring medication and lifestyle changes.',
    preventionTips: [
      'Reduce salt intake',
      'Exercise regularly',
      'Maintain healthy weight',
    ],
    ageRiskModifier: 1.6,
    healthRiskModifier: 1.4,
    fitnessRiskModifier: 1.7,
    baseChance: 0.004,
  },
  {
    id: 'depression',
    name: 'Depression',
    severity: 'serious',
    effects: {
      happiness: -10,
      energy: -5,
      health: -2,
    },
    curable: true,
    treatmentRequired: true,
    naturalRecoveryWeeks: 8,
    description: 'A mental health condition causing persistent sadness and loss of interest.',
    preventionTips: [
      'Seek therapy',
      'Maintain social connections',
      'Practice self-care',
    ],
    ageRiskModifier: 1.1,
    healthRiskModifier: 1.7, // Higher risk with low health
    fitnessRiskModifier: 1.4,
    baseChance: 0.006,
  },

  // Critical Diseases
  {
    id: 'cancer',
    name: 'Cancer',
    severity: 'critical',
    effects: {
      health: -10,
      energy: -12,
      happiness: -8,
      fitness: -5,
    },
    curable: true,
    treatmentRequired: true,
    weeksUntilDeath: 20, // 20 weeks to death if untreated
    description: 'A life-threatening disease requiring immediate and aggressive treatment.',
    preventionTips: [
      'Regular health screenings',
      'Avoid smoking',
      'Maintain healthy lifestyle',
    ],
    ageRiskModifier: 2.0, // Much higher risk with age
    healthRiskModifier: 1.5,
    fitnessRiskModifier: 1.3,
    baseChance: 0.001, // 0.1% base chance (very rare)
  },
  {
    id: 'heart_disease',
    name: 'Heart Disease',
    severity: 'critical',
    effects: {
      health: -8,
      energy: -6,
      fitness: -8,
      happiness: -3,
    },
    curable: false,
    treatmentRequired: true,
    weeksUntilDeath: 15,
    chronic: true,
    description: 'A serious cardiovascular condition requiring ongoing medical management.',
    preventionTips: [
      'Exercise regularly',
      'Eat heart-healthy diet',
      'Avoid smoking',
      'Manage stress',
    ],
    ageRiskModifier: 1.9,
    healthRiskModifier: 1.6,
    fitnessRiskModifier: 2.2, // Much higher risk with low fitness
    baseChance: 0.002,
  },
  {
    id: 'stroke',
    name: 'Stroke',
    severity: 'critical',
    effects: {
      health: -15,
      energy: -10,
      fitness: -10,
      happiness: -5,
    },
    curable: false,
    treatmentRequired: true,
    weeksUntilDeath: 12,
    description: 'A medical emergency causing brain damage. Immediate treatment is critical.',
    preventionTips: [
      'Control blood pressure',
      'Manage cholesterol',
      'Exercise regularly',
      'Avoid smoking',
    ],
    ageRiskModifier: 2.1,
    healthRiskModifier: 1.8,
    fitnessRiskModifier: 1.6,
    baseChance: 0.0015,
  },
  {
    id: 'organ_failure',
    name: 'Organ Failure',
    severity: 'critical',
    effects: {
      health: -12,
      energy: -15,
      fitness: -12,
      happiness: -6,
    },
    curable: false,
    treatmentRequired: true,
    weeksUntilDeath: 10,
    description: 'Severe organ dysfunction requiring immediate medical intervention.',
    preventionTips: [
      'Maintain overall health',
      'Avoid substance abuse',
      'Regular medical checkups',
    ],
    ageRiskModifier: 2.2,
    healthRiskModifier: 2.0,
    fitnessRiskModifier: 1.5,
    baseChance: 0.0008, // Very rare
  },

  // ─── Phase 3 additions: Mental Health ─────────────────────────────
  {
    id: 'anxiety',
    name: 'Anxiety Disorder',
    severity: 'serious',
    effects: {
      happiness: -7,
      energy: -4,
      health: -1,
    },
    curable: true,
    treatmentRequired: true,
    naturalRecoveryWeeks: 10,
    description: 'Persistent worry and nervousness that interferes with daily life.',
    preventionTips: [
      'Practice mindfulness and breathing',
      'Limit caffeine intake',
      'Seek therapy or counseling',
    ],
    ageRiskModifier: 1.0,
    healthRiskModifier: 1.5,
    fitnessRiskModifier: 1.3,
    baseChance: 0.007,
  },
  {
    id: 'ptsd',
    name: 'PTSD',
    severity: 'serious',
    effects: {
      happiness: -8,
      energy: -6,
      health: -2,
    },
    curable: true,
    treatmentRequired: true,
    naturalRecoveryWeeks: 16,
    description: 'Post-traumatic stress disorder following a traumatic event. Causes flashbacks and emotional distress.',
    preventionTips: [
      'Seek professional support after trauma',
      'Build strong social connections',
      'Practice grounding techniques',
    ],
    ageRiskModifier: 1.0,
    healthRiskModifier: 1.3,
    fitnessRiskModifier: 1.1,
    baseChance: 0.003,
  },
  {
    id: 'eating_disorder',
    name: 'Eating Disorder',
    severity: 'serious',
    effects: {
      health: -6,
      energy: -5,
      happiness: -6,
      fitness: -4,
    },
    curable: true,
    treatmentRequired: true,
    naturalRecoveryWeeks: 12,
    description: 'An unhealthy relationship with food affecting physical and mental health.',
    preventionTips: [
      'Develop healthy relationship with food',
      'Seek therapy for body image issues',
      'Avoid extreme diets',
    ],
    ageRiskModifier: 0.8, // More common in younger people
    healthRiskModifier: 1.4,
    fitnessRiskModifier: 1.2,
    baseChance: 0.004,
  },
  {
    id: 'insomnia',
    name: 'Chronic Insomnia',
    severity: 'mild',
    effects: {
      energy: -6,
      happiness: -3,
      health: -2,
    },
    curable: true,
    treatmentRequired: false,
    naturalRecoveryWeeks: 5,
    description: 'Persistent difficulty falling or staying asleep, leading to daytime fatigue.',
    preventionTips: [
      'Maintain consistent sleep schedule',
      'Avoid screens before bed',
      'Create a relaxing bedtime routine',
    ],
    ageRiskModifier: 1.2,
    healthRiskModifier: 1.3,
    fitnessRiskModifier: 1.1,
    baseChance: 0.01,
  },

  // ─── Phase 3 additions: Addiction ─────────────────────────────────
  {
    id: 'alcohol_addiction',
    name: 'Alcohol Addiction',
    severity: 'serious',
    effects: {
      health: -5,
      happiness: -4,
      energy: -3,
      fitness: -3,
      reputation: -5,
    },
    curable: true,
    treatmentRequired: true,
    naturalRecoveryWeeks: 20,
    chronic: true,
    description: 'Dependency on alcohol causing physical and social damage. Recovery is possible but requires commitment.',
    preventionTips: [
      'Drink in moderation',
      'Seek help if drinking increases',
      'Find alternative coping mechanisms',
    ],
    ageRiskModifier: 1.0,
    healthRiskModifier: 1.5,
    fitnessRiskModifier: 1.2,
    baseChance: 0.004,
  },
  {
    id: 'substance_abuse',
    name: 'Substance Abuse',
    severity: 'critical',
    effects: {
      health: -8,
      happiness: -6,
      energy: -8,
      fitness: -5,
      reputation: -8,
    },
    curable: true,
    treatmentRequired: true,
    weeksUntilDeath: 30,
    description: 'Dangerous drug dependency causing severe physical and mental decline. Requires professional rehab.',
    preventionTips: [
      'Avoid recreational drug use',
      'Seek help immediately if using',
      'Build strong support network',
    ],
    ageRiskModifier: 0.9,
    healthRiskModifier: 1.4,
    fitnessRiskModifier: 1.1,
    baseChance: 0.002,
  },

  // ─── Phase 3 additions: Physical Injuries ─────────────────────────
  {
    id: 'back_injury',
    name: 'Back Injury',
    severity: 'serious',
    effects: {
      health: -5,
      energy: -6,
      fitness: -6,
      happiness: -3,
    },
    curable: true,
    treatmentRequired: true,
    naturalRecoveryWeeks: 8,
    description: 'A back injury causing chronic pain and limited mobility.',
    preventionTips: [
      'Lift with your legs, not your back',
      'Maintain good posture',
      'Strengthen core muscles',
    ],
    ageRiskModifier: 1.4,
    healthRiskModifier: 1.3,
    fitnessRiskModifier: 1.8,
    baseChance: 0.005,
  },
  {
    id: 'sports_injury',
    name: 'Sports Injury',
    severity: 'mild',
    effects: {
      fitness: -5,
      energy: -3,
      happiness: -2,
    },
    curable: true,
    treatmentRequired: false,
    naturalRecoveryWeeks: 4,
    description: 'An injury sustained during physical activity or sports.',
    preventionTips: [
      'Warm up before exercise',
      'Use proper form',
      'Don\'t push past your limits',
    ],
    ageRiskModifier: 1.0,
    healthRiskModifier: 1.1,
    fitnessRiskModifier: 0.8, // Fit people exercise more, slightly more risk
    baseChance: 0.008,
  },
  {
    id: 'concussion',
    name: 'Concussion',
    severity: 'serious',
    effects: {
      health: -7,
      energy: -8,
      happiness: -4,
    },
    curable: true,
    treatmentRequired: true,
    naturalRecoveryWeeks: 6,
    description: 'A traumatic brain injury causing headaches, confusion, and memory problems.',
    preventionTips: [
      'Wear helmets during risky activities',
      'Avoid contact sports without protection',
      'Rest after any head impact',
    ],
    ageRiskModifier: 1.0,
    healthRiskModifier: 1.2,
    fitnessRiskModifier: 1.0,
    baseChance: 0.003,
  },

  // ─── Phase 3 additions: Common Illnesses ──────────────────────────
  {
    id: 'food_poisoning',
    name: 'Food Poisoning',
    severity: 'mild',
    effects: {
      health: -4,
      energy: -5,
      happiness: -3,
    },
    curable: true,
    treatmentRequired: false,
    naturalRecoveryWeeks: 1,
    description: 'Illness from contaminated food causing nausea and stomach pain.',
    preventionTips: [
      'Check food expiration dates',
      'Cook food thoroughly',
      'Practice proper food storage',
    ],
    ageRiskModifier: 1.0,
    healthRiskModifier: 1.2,
    fitnessRiskModifier: 1.0,
    baseChance: 0.01,
  },
  {
    id: 'migraine',
    name: 'Chronic Migraines',
    severity: 'mild',
    effects: {
      happiness: -4,
      energy: -4,
      health: -1,
    },
    curable: true,
    treatmentRequired: false,
    naturalRecoveryWeeks: 3,
    description: 'Severe recurring headaches with sensitivity to light and sound.',
    preventionTips: [
      'Manage stress levels',
      'Stay hydrated',
      'Get regular sleep',
    ],
    ageRiskModifier: 1.0,
    healthRiskModifier: 1.3,
    fitnessRiskModifier: 1.1,
    baseChance: 0.008,
  },
  {
    id: 'allergies',
    name: 'Severe Allergies',
    severity: 'mild',
    effects: {
      health: -2,
      energy: -3,
      happiness: -2,
    },
    curable: false,
    treatmentRequired: false,
    chronic: true,
    naturalRecoveryWeeks: 6,
    description: 'Seasonal or environmental allergies causing congestion, sneezing, and fatigue.',
    preventionTips: [
      'Avoid known allergens',
      'Take antihistamines',
      'Keep living space clean',
    ],
    ageRiskModifier: 0.9,
    healthRiskModifier: 1.1,
    fitnessRiskModifier: 1.0,
    baseChance: 0.012,
  },
  {
    id: 'asthma',
    name: 'Asthma',
    severity: 'serious',
    effects: {
      health: -3,
      energy: -4,
      fitness: -4,
    },
    curable: false,
    treatmentRequired: true,
    chronic: true,
    description: 'A chronic respiratory condition causing breathing difficulty, especially during exercise.',
    preventionTips: [
      'Avoid triggers (dust, smoke, cold air)',
      'Use prescribed inhalers',
      'Monitor breathing regularly',
    ],
    ageRiskModifier: 0.9,
    healthRiskModifier: 1.4,
    fitnessRiskModifier: 1.5,
    baseChance: 0.004,
  },
  {
    id: 'arthritis',
    name: 'Arthritis',
    severity: 'serious',
    effects: {
      health: -3,
      fitness: -5,
      energy: -3,
      happiness: -2,
    },
    curable: false,
    treatmentRequired: true,
    chronic: true,
    description: 'Joint inflammation causing pain and stiffness, worsening with age.',
    preventionTips: [
      'Maintain healthy weight',
      'Stay physically active',
      'Protect joints from injury',
    ],
    ageRiskModifier: 2.0,
    healthRiskModifier: 1.3,
    fitnessRiskModifier: 1.6,
    baseChance: 0.003,
  },
  {
    id: 'kidney_disease',
    name: 'Kidney Disease',
    severity: 'critical',
    effects: {
      health: -8,
      energy: -10,
      fitness: -6,
      happiness: -5,
    },
    curable: false,
    treatmentRequired: true,
    weeksUntilDeath: 25,
    chronic: true,
    description: 'Progressive kidney damage requiring dialysis or transplant.',
    preventionTips: [
      'Stay hydrated',
      'Control blood pressure',
      'Limit salt and protein intake',
    ],
    ageRiskModifier: 1.8,
    healthRiskModifier: 1.7,
    fitnessRiskModifier: 1.3,
    baseChance: 0.001,
  },
  {
    id: 'dementia',
    name: 'Dementia',
    severity: 'critical',
    effects: {
      happiness: -10,
      energy: -6,
      health: -5,
    },
    curable: false,
    treatmentRequired: true,
    chronic: true,
    description: 'Progressive cognitive decline affecting memory, thinking, and behavior.',
    preventionTips: [
      'Stay mentally active',
      'Exercise regularly',
      'Maintain social connections',
    ],
    ageRiskModifier: 2.5, // Very age-dependent
    healthRiskModifier: 1.3,
    fitnessRiskModifier: 1.4,
    baseChance: 0.001,
  },
];

/**
 * Get disease template by ID
 */
export function getDiseaseTemplate(id: string): DiseaseTemplate | undefined {
  return DISEASE_DEFINITIONS.find(d => d.id === id);
}

/**
 * Get all disease templates by severity
 */
export function getDiseasesBySeverity(severity: 'mild' | 'serious' | 'critical'): DiseaseTemplate[] {
  return DISEASE_DEFINITIONS.filter(d => d.severity === severity);
}

/**
 * Get all curable diseases
 */
export function getCurableDiseases(): DiseaseTemplate[] {
  return DISEASE_DEFINITIONS.filter(d => d.curable);
}

/**
 * Get all chronic diseases
 */
export function getChronicDiseases(): DiseaseTemplate[] {
  return DISEASE_DEFINITIONS.filter(d => d.chronic === true);
}

/**
 * Create a Disease instance from a template
 */
export function createDiseaseFromTemplate(
  template: DiseaseTemplate,
  contractedWeek: number
): Disease {
  return {
    id: template.id,
    name: template.name,
    severity: template.severity,
    effects: { ...template.effects },
    curable: template.curable,
    treatmentRequired: template.treatmentRequired,
    weeksUntilDeath: template.weeksUntilDeath,
    naturalRecoveryWeeks: template.naturalRecoveryWeeks,
    contractedWeek,
    description: template.description,
    preventionTips: template.preventionTips,
  };
}

