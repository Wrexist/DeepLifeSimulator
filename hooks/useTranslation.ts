// Leaf context, NOT the @/contexts/GameContext barrel: the barrel does
// `export * from './game'`, dragging the whole provider graph (GameProvider →
// IAPHandler → barrel) into every screen that translates. That require cycle
// resolved to `undefined` in the production Hermes bundle ("Element type is
// invalid" the moment the first translated screen — MainMenu — mounted). This
// hook only needs gameState.settings.language, so the leaf state context is enough.
import { useGameState } from '@/contexts/game/GameStateContext';
import { t, type Language } from '@/utils/translations';
import { logger } from '@/utils/logger';

export function useTranslation() {
  const { gameState } = useGameState();
  
  // Ensure the language is properly typed and has a fallback
  const language = (gameState.settings.language as Language) || 'English';

  const translate = (key: string): string => {
    try {
      const result = t(language, key);
      
      // Debug logging to catch any potential issues
      if (__DEV__ && (result.includes('computer.') || result.includes('mobile.') || result.includes('work.') || result.includes('market.') || result.includes('health.'))) {
        logger.warn('Translation contains potential prefix issue:', { key, result, language });
      }
      
      return result;
    } catch (error) {
      if (__DEV__) {
        logger.error('Translation error:', { error, key, language });
      }
      return key; // Return the key if translation fails
    }
  };

  return {
    t: translate,
    language,
  };
}
