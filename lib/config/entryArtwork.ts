import type { ImageSourcePropType } from 'react-native';

/** Contextual studio props; shared by subject, never used to imply owned items. */
const props = {
  office: require('@/assets/images/scenes/work-office-modern.webp'),
  study: require('@/assets/images/scenes/work-study-modern.webp'),
  food: require('@/assets/images/scenes/work-food-modern.webp'),
  health: require('@/assets/images/scenes/health-modern.webp'),
  contacts: require('@/assets/images/scenes/contacts-modern.webp'),
  wallet: require('@/assets/images/scenes/entry-wallet.webp'),
  travel: require('@/assets/images/scenes/entry-travel.webp'),
  medical: require('@/assets/images/scenes/entry-medical.webp'),
  keys: require('@/assets/images/scenes/entry-keys.webp'),
  camera: require('@/assets/images/scenes/entry-camera.webp'),
  planner: require('@/assets/images/scenes/entry-planner.webp'),
  plant: require('@/assets/images/scenes/entry-plant.webp'),
  safe: require('@/assets/images/scenes/entry-safe.webp'),
  dice: require('@/assets/images/scenes/entry-dice.webp'),
  collection: require('@/assets/images/scenes/entry-collection.webp'),
  headphones: require('@/assets/images/scenes/entry-headphones.webp'),
};
export const entryArtwork: Readonly<Partial<Record<string, ImageSourcePropType>>> = {
  corporate_intern: require('@/assets/images/scenes/work-office-modern.webp'),
  aspiring_entrepreneur: require('@/assets/images/scenes/work-office-modern.webp'),
  tech_prodigy: require('@/assets/images/scenes/work-office-modern.webp'),
  fitness_enthusiast: require('@/assets/images/scenes/health-modern.webp'),
  highschool_dropout: props.study, food_courier: props.food,
  street_hustler: props.wallet, influencer_wannabe: props.camera,
  trust_fund_baby: props.safe, immigrant_story: props.travel,
  second_chance: props.keys, single_parent_life: props.contacts,
  medical_student: props.medical, military_recruit: props.travel,
  real_estate_hustler: props.keys,
};

export const challengeArtwork: Readonly<Partial<Record<string, ImageSourcePropType>>> = {
  rags_to_riches: props.wallet, academic_excellence: props.study,
  social_butterfly: props.contacts, entrepreneur: props.office,
  family_focused: props.contacts, single_parent: props.contacts,
  criminal_empire: props.safe, political_dynasty: props.planner,
  tech_mogul: props.office, real_estate_tycoon: props.keys,
  speedrun: props.planner, balanced_life: props.plant,
  debt_escape: props.wallet, fame_seeker: props.camera,
  minimalist: props.plant, athletes_journey: props.health,
  creative_legend: props.headphones, late_bloomer: props.plant,
  lottery_winner: props.dice, redemption_arc: props.keys,
  health_recovery: props.medical, world_traveler: props.travel,
  survival_expert: props.travel,
};

export const perkArtwork: Readonly<Partial<Record<string, ImageSourcePropType>>> = {
  astute_planner: props.planner, legacy_builder: props.keys,
  iron_will: props.health, social_butterfly: props.contacts,
  fast_learner: props.study, financial_guru: props.wallet,
  lucky_charm: props.dice, longevity: props.medical,
  optimist: props.plant, trust_fund: props.safe,
  family_first: props.contacts, crime_boss: props.safe,
  escape_master: props.keys, legacy_guardian: props.safe,
  innovator: props.office, landlord: props.keys,
  blockchain_believer: props.office, collector_spirit: props.collection,
  star_quality: props.camera, inner_peace: props.plant,
};

export const mindsetArtwork: Readonly<Partial<Record<string, ImageSourcePropType>>> = {
  frugal: props.wallet, workaholic: props.office, socialite: props.contacts,
  optimist: props.plant, perfectionist: props.planner, adventurous: props.travel,
  gambler: props.dice, riskAverse: props.safe, investor: props.wallet,
  spender: props.collection, hustler: props.office,
};
