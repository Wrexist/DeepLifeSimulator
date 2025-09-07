import { useGame } from '@/contexts/GameContext';
import { t, type Language } from '@/utils/translations';

export function useTranslation() {
  const { gameState } = useGame();
  const language = gameState.settings.language as Language;

  const translate = (key: string): string => {
    return t(language, key);
  };

  return {
    t: translate,
    language,
  };
}
