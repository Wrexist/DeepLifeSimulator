/**
 * Backward compatibility wrapper for the new split context architecture.
 *
 * This file re-exports everything from the new 'contexts/game' module.
 * It ensures that existing imports like:
 * import { useGame } from '@/contexts/GameContext';
 * continue to work without changes.
 */

export * from './game';

// Export new specialized action hooks
export { useMoneyActions } from './game/MoneyActionsContext';
export { useJobActions } from './game/JobActionsContext';
export { useItemActions } from './game/ItemActionsContext';
export { useSocialActions } from './game/SocialActionsContext';




























