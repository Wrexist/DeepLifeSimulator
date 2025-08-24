import React, { createContext, useContext, useState } from 'react';
import { Scenario } from './scenarioData';

interface OnboardingState {
  slot: number;
  scenario?: Scenario;
  firstName: string;
  lastName: string;
  sex: 'male' | 'female' | 'random';
  sexuality: 'straight' | 'gay' | 'bi';
  perks: string[];
}

interface OnboardingContextType {
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
}

const defaultState: OnboardingState = {
  slot: 1,
  firstName: '',
  lastName: '',
  sex: 'random',
  sexuality: 'straight',
  perks: [],
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<OnboardingState>(defaultState);
  return <OnboardingContext.Provider value={{ state, setState }}>{children}</OnboardingContext.Provider>;
};

export const useOnboarding = () => {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
};
