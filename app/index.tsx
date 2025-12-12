import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import PremiumLoadingScreen from '@/components/PremiumLoadingScreen';
import { usePreload } from '@/hooks/usePreload';

export default function Index() {
  const { isPreloaded, preloadProgress } = usePreload();
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Initializing DeepLife Simulator...');

  useEffect(() => {
    if (isPreloaded) {
      const loadingSteps = [
        { progress: 20, message: 'Loading game assets...' },
        { progress: 40, message: 'Initializing game state...' },
        { progress: 60, message: 'Loading scaling utilities...' },
        { progress: 80, message: 'Preparing UI components...' },
        { progress: 95, message: 'Almost ready...' },
        { progress: 100, message: 'Welcome to DeepLife!' },
      ];

      let currentStep = 0;
      let timeoutId: NodeJS.Timeout | null = null;
      const interval = setInterval(() => {
        if (currentStep < loadingSteps.length) {
          const step = loadingSteps[currentStep];
          setProgress(step.progress);
          setLoadingMessage(step.message);
          currentStep++;
        } else {
          clearInterval(interval);
          timeoutId = setTimeout(() => {
            setIsLoading(false);
            timeoutId = null;
          }, 500);
        }
      }, 800);

      return () => {
        clearInterval(interval);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };
    }
  }, [isPreloaded]);

  if (isLoading || !isPreloaded) {
    const currentProgress = isPreloaded ? progress : preloadProgress;
    const currentMessage = isPreloaded ? loadingMessage : 'Initializing scaling system...';
    
    return (
      <View style={{ flex: 1 }}>
        <PremiumLoadingScreen 
          progress={currentProgress}
          message={currentMessage}
        />
      </View>
    );
  }

  return <Redirect href="/(onboarding)/MainMenu" />;
}
