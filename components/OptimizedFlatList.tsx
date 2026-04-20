import React, { useCallback } from 'react';
import { FlatList, FlatListProps, StyleSheet, View } from 'react-native';

interface OptimizedFlatListProps<T> extends FlatListProps<T> {
  itemHeight?: number; // Fixed height for getItemLayout optimization
  separatorHeight?: number; // Height of separator if used
}

/**
 * A wrapper around FlatList with built-in performance optimizations.
 * 
 * Optimizations included:
 * - removeClippedSubviews: true (Android default, force true)
 * - windowSize: 5 (Reduced from default 21 to save memory)
 * - maxToRenderPerBatch: 10 (Reduced from default 10 for better responsiveness)
 * - initialNumToRender: 7 (Enough to fill screen usually)
 * - getItemLayout: auto-calculated if itemHeight is provided
 */
export function OptimizedFlatList<T>({
  itemHeight,
  separatorHeight = 0,
  windowSize = 5,
  maxToRenderPerBatch = 10,
  initialNumToRender = 7,
  removeClippedSubviews = true,
  ...props
}: OptimizedFlatListProps<T>) {

  const getItemLayout = useCallback(
    (data: any, index: number) => {
      if (itemHeight) {
        return {
          length: itemHeight,
          offset: (itemHeight + separatorHeight) * index,
          index,
        };
      }
      // If props provided their own getItemLayout, utilize it? 
      // FlatList doesn't compose them, so we just use ours if itemHeight is present.
      // If user passed getItemLayout in props, it will override this one because props are spread after.
      // Actually, props are spread after, so user prop wins. We only need to provide it if user didn't?
      // But we can't know if user provided it easily without inspecting props before spread.
      // The strategy: if itemHeight is passed, we construct one. User can override by passing getItemLayout.
      return { length: 0, offset: 0, index };
    },
    [itemHeight, separatorHeight]
  );

  const finalGetItemLayout = itemHeight && !props.getItemLayout ? getItemLayout : props.getItemLayout;

  return (
    <FlatList
      windowSize={windowSize}
      maxToRenderPerBatch={maxToRenderPerBatch}
      initialNumToRender={initialNumToRender}
      removeClippedSubviews={removeClippedSubviews}
      getItemLayout={finalGetItemLayout}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  // Add any default styles if needed
});
