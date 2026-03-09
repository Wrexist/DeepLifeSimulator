import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';

interface GameUIContextType {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  loadingProgress: number;
  setLoadingProgress: (progress: number) => void;
  loadingMessage: string;
  setLoadingMessage: (message: string) => void;
  isCacheClearing: boolean;
  setIsCacheClearing: (clearing: boolean) => void;
  cacheUpdateInfo: { oldVersion?: string; newVersion?: string };
  setCacheUpdateInfo: (info: { oldVersion?: string; newVersion?: string }) => void;
}

const GameUIContext = createContext<GameUIContextType | undefined>(undefined);

export function useGameUI() {
  const context = useContext(GameUIContext);
  if (!context) {
    throw new Error('useGameUI must be used within GameUIProvider');
  }
  return context;
}

interface GameUIProviderProps {
  children: ReactNode;
}

export function GameUIProvider({ children }: GameUIProviderProps) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingMessage, setLoadingMessage] = useState<string>('Initializing...');
  const [isCacheClearing, setIsCacheClearing] = useState<boolean>(false);
  const [cacheUpdateInfo, setCacheUpdateInfo] = useState<{ oldVersion?: string; newVersion?: string }>({});

  const value = useMemo<GameUIContextType>(() => ({
    isLoading,
    setIsLoading,
    loadingProgress,
    setLoadingProgress,
    loadingMessage,
    setLoadingMessage,
    isCacheClearing,
    setIsCacheClearing,
    cacheUpdateInfo,
    setCacheUpdateInfo,
  }), [isLoading, loadingProgress, loadingMessage, isCacheClearing, cacheUpdateInfo]);

  return (
    <GameUIContext.Provider value={value}>
      {children}
    </GameUIContext.Provider>
  );
}

