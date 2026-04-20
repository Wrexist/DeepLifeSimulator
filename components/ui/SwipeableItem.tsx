import React, { useRef } from 'react';
import { View, StyleSheet, Animated, PanResponderGestureState } from 'react-native';
// Import Swipeable from react-native-gesture-handler
import { Swipeable } from 'react-native-gesture-handler';

interface SwipeableItemProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  swipeThreshold?: number;
  disabled?: boolean;
}

export default function SwipeableItem({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  swipeThreshold = 100,
  disabled = false,
}: SwipeableItemProps) {
  const swipeableRef = useRef<Swipeable>(null);

  const renderLeftActions = () => {
    if (!leftAction || !onSwipeLeft) return null;
    return (
      <View style={styles.leftAction}>
        {leftAction}
      </View>
    );
  };

  const renderRightActions = () => {
    if (!rightAction || !onSwipeRight) return null;
    return (
      <View style={styles.rightAction}>
        {rightAction}
      </View>
    );
  };

  if (disabled) {
    return <View>{children}</View>;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableLeftOpen={onSwipeLeft}
      onSwipeableRightOpen={onSwipeRight}
      leftThreshold={swipeThreshold}
      rightThreshold={swipeThreshold}
      friction={2}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  leftAction: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    backgroundColor: '#10B981',
    paddingLeft: 20,
  },
  rightAction: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
    backgroundColor: '#EF4444',
    paddingRight: 20,
  },
});

