import { useGame } from '@/contexts/GameContext';
import { t, type Language } from '@/utils/translations';

export function useTranslation() {
  const { gameState } = useGame();
  
  // Ensure the language is properly typed and has a fallback
  const language = (gameState.settings.language as Language) || 'English';

  const translate = (key: string): string => {
    try {
      const result = t(language, key);
      
      // Debug logging to catch any potential issues
      if (__DEV__ && (result.includes('computer.') || result.includes('mobile.') || result.includes('work.') || result.includes('market.') || result.includes('health.'))) {
        console.warn('Translation contains potential prefix issue:', { key, result, language });
      }
      
      return result;
    } catch (error) {
      console.error('Translation error:', error, 'Key:', key, 'Language:', language);
      return key; // Return the key if translation fails
    }
  };

  return {
    t: translate,
    language,
  };
}
