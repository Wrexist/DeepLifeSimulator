declare module '@react-native-firebase/analytics' {
  export type FirebaseAnalytics = {
    logEvent: (name: string, params?: Record<string, unknown>) => Promise<void>;
    setUserProperty: (name: string, value: string) => Promise<void>;
    setUserId: (id: string | null) => Promise<void>;
  };

  const analytics: () => FirebaseAnalytics;
  export default analytics;
}

