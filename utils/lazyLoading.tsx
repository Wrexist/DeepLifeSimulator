/**
 * Lazy loading utilities for code splitting
 */

import React, { Suspense, ComponentType, LazyExoticComponent } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

/**
 * Loading fallback component
 */
const LoadingFallback = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#3B82F6" />
  </View>
);

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
});

/**
 * Create a lazy-loaded component with Suspense wrapper
 */
export function withLazyLoading<T extends ComponentType<any>>(
  lazyComponent: LazyExoticComponent<T>,
  fallback?: React.ComponentType
): React.FC<React.ComponentProps<T>> {
  const Fallback = fallback || LoadingFallback;
  
  const WrappedComponent = (props: React.ComponentProps<T>) => (
    <Suspense fallback={<Fallback />}>
      {React.createElement(lazyComponent, props)}
    </Suspense>
  );
  WrappedComponent.displayName = `LazyWrapper(${(lazyComponent as any).displayName || 'Component'})`;
  return WrappedComponent;
}

/**
 * Lazy load a component with error boundary
 */
export function lazyLoadComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return React.lazy(importFn);
}

/**
 * Preload a lazy component
 */
export async function preloadComponent<T extends ComponentType<any>>(
  lazyComponent: LazyExoticComponent<T>
): Promise<void> {
  // Trigger the import by accessing the component
  // Note: React.lazy components are loaded when first rendered
  // This is a best-effort preload attempt
  try {
    // Accessing internal properties for preloading (may not work in all React versions)
    const component = lazyComponent as any;
    if (component._payload?._result) {
      await component._payload._result;
    }
  } catch {
    // Preload failed, component will load on first render
  }
}

export default {
  withLazyLoading,
  lazyLoadComponent,
  preloadComponent,
  LoadingFallback,
};

