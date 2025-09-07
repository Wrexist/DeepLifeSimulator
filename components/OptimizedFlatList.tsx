import React, { useCallback, useMemo } from 'react';
import { FlatList, FlatListProps, ViewStyle, ListRenderItem } from 'react-native';

interface OptimizedFlatListProps<T> extends Omit<FlatListProps<T>, 'renderItem'> {
  data: T[];
  renderItem: ListRenderItem<T>;
  itemHeight?: number;
  keyExtractor?: (item: T, index: number) => string;
  contentContainerStyle?: ViewStyle;
  showsVerticalScrollIndicator?: boolean;
  showsHorizontalScrollIndicator?: boolean;
  removeClippedSubviews?: boolean;
  maxToRenderPerBatch?: number;
  windowSize?: number;
  initialNumToRender?: number;
  updateCellsBatchingPeriod?: number;
  onEndReachedThreshold?: number;
  onEndReached?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
}

const OptimizedFlatList = React.memo(<T extends any>({
  data,
  renderItem,
  itemHeight = 80,
  keyExtractor,
  contentContainerStyle,
  showsVerticalScrollIndicator = false,
  showsHorizontalScrollIndicator = false,
  removeClippedSubviews = true,
  maxToRenderPerBatch = 20, // Increased for faster rendering
  windowSize = 15, // Increased window size
  initialNumToRender = 10, // Increased initial render
  updateCellsBatchingPeriod = 10, // Faster updates
  onEndReachedThreshold = 0.5,
  onEndReached,
  refreshing = false,
  onRefresh,
  ...props
}: OptimizedFlatListProps<T>) => {
  
  const defaultKeyExtractor = useCallback((item: T, index: number) => {
    if (keyExtractor) {
      return keyExtractor(item, index);
    }
    // Fallback to index if no keyExtractor provided
    return index.toString();
  }, [keyExtractor]);

  const getItemLayout = useCallback((data: ArrayLike<T> | null | undefined, index: number) => ({
    length: itemHeight,
    offset: itemHeight * index,
    index,
  }), [itemHeight]);

  const memoizedRenderItem = useCallback((info: any) => {
    return renderItem(info);
  }, [renderItem]);

  const memoizedOnEndReached = useCallback(() => {
    if (onEndReached) {
      onEndReached();
    }
  }, [onEndReached]);

  const memoizedOnRefresh = useCallback(() => {
    if (onRefresh) {
      onRefresh();
    }
  }, [onRefresh]);

  return (
    <FlatList
      data={data}
      keyExtractor={defaultKeyExtractor}
      renderItem={memoizedRenderItem}
      getItemLayout={getItemLayout}
      removeClippedSubviews={removeClippedSubviews}
      maxToRenderPerBatch={maxToRenderPerBatch}
      windowSize={windowSize}
      initialNumToRender={initialNumToRender}
      updateCellsBatchingPeriod={updateCellsBatchingPeriod}
      onEndReachedThreshold={onEndReachedThreshold}
      onEndReached={memoizedOnEndReached}
      refreshing={refreshing}
      onRefresh={memoizedOnRefresh}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
      contentContainerStyle={contentContainerStyle}
      {...props}
    />
  );
});

export default OptimizedFlatList;
