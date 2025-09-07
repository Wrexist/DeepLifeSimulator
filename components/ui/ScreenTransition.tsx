import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, ViewStyle } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ScreenTransitionProps {
  children: React.ReactNode;
  visible: boolean;
  type?: 'slide' | 'fade' | 'scale' | 'slideUp' | 'slideDown';
  duration?: number;
  style?: ViewStyle;
}

export default function ScreenTransition({
  children,
  visible,
  type = 'slide',
  duration = 300,
  style,
}: ScreenTransitionProps) {
  const animatedValue = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: visible ? 1 : 0,
      duration: duration,
      useNativeDriver: true,
    }).start();
  }, [visible, duration, animatedValue]);

  const getTransitionStyle = () => {
    switch (type) {
      case 'slide':
        return {
          transform: [
            {
              translateX: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [screenWidth, 0],
              }),
            },
          ],
        };
      case 'slideUp':
        return {
          transform: [
            {
              translateY: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [screenHeight, 0],
              }),
            },
          ],
        };
      case 'slideDown':
        return {
          transform: [
            {
              translateY: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [-screenHeight, 0],
              }),
            },
          ],
        };
      case 'scale':
        return {
          transform: [
            {
              scale: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              }),
            },
          ],
          opacity: animatedValue,
        };
      case 'fade':
      default:
        return {
          opacity: animatedValue,
        };
    }
  };

  return (
    <Animated.View style={[getTransitionStyle(), style]}>
      {children}
    </Animated.View>
  );
}
