import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface TutorialRefContextType {
  registerRef: (id: string, ref: any) => void;
  unregisterRef: (id: string) => void;
  getRef: (id: string) => any;
  getAllRefs: () => { [key: string]: any };
}

const TutorialRefContext = createContext<TutorialRefContextType | undefined>(undefined);

export function TutorialRefProvider({ children }: { children: ReactNode }) {
  const [refs, setRefs] = useState<{ [key: string]: any }>({});

  const registerRef = useCallback((id: string, ref: any) => {
    setRefs(prev => ({
      ...prev,
      [id]: ref,
    }));
  }, []);

  const unregisterRef = useCallback((id: string) => {
    setRefs(prev => {
      const newRefs = { ...prev };
      delete newRefs[id];
      return newRefs;
    });
  }, []);

  const getRef = useCallback((id: string) => {
    return refs[id];
  }, [refs]);

  const getAllRefs = useCallback(() => {
    return refs;
  }, [refs]);

  const value: TutorialRefContextType = {
    registerRef,
    unregisterRef,
    getRef,
    getAllRefs,
  };

  return (
    <TutorialRefContext.Provider value={value}>
      {children}
    </TutorialRefContext.Provider>
  );
}

export function useTutorialRef() {
  const context = useContext(TutorialRefContext);
  if (context === undefined) {
    throw new Error('useTutorialRef must be used within a TutorialRefProvider');
  }
  return context;
}

// Hook for components to register themselves
export function useTutorialRefRegistration(id: string, ref: any) {
  const { registerRef, unregisterRef } = useTutorialRef();

  React.useEffect(() => {
    if (ref) {
      registerRef(id, ref);
    }
    return () => {
      unregisterRef(id);
    };
  }, [id, ref, registerRef, unregisterRef]);
}
