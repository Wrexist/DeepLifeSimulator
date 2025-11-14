import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TutorialHighlightState {
  highlightedItem?: string;
  highlightTarget?: string;
  highlightMessage?: string;
}

interface TutorialHighlightContextType extends TutorialHighlightState {
  setHighlight: (itemId?: string, target?: string, message?: string) => void;
  clearHighlight: () => void;
}

const TutorialHighlightContext = createContext<TutorialHighlightContextType | undefined>(undefined);

export function TutorialHighlightProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TutorialHighlightState>({});

  const setHighlight = (itemId?: string, target?: string, message?: string) => {
    setState({
      highlightedItem: itemId,
      highlightTarget: target,
      highlightMessage: message,
    });
  };

  const clearHighlight = () => {
    setState({});
  };

  return (
    <TutorialHighlightContext.Provider value={{
      ...state,
      setHighlight,
      clearHighlight,
    }}>
      {children}
    </TutorialHighlightContext.Provider>
  );
}

export function useTutorialHighlight() {
  const context = useContext(TutorialHighlightContext);
  if (context === undefined) {
    throw new Error('useTutorialHighlight must be used within a TutorialHighlightProvider');
  }
  return context;
}
