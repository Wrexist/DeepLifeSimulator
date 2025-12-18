import React, { useEffect, useRef } from 'react';
import { Modal, View, StyleSheet, Dimensions, TouchableWithoutFeedback } from 'react-native';
import { MotiView, MotiText } from '@/components/anim/MotiStub';
// import { BlurView } from 'expo-blur'; // Removed - TurboModule crash fix
import { useGame } from '@/contexts/GameContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface AnimatedModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  animationType?: 'slide' | 'fade' | 'scale' | 'bounce';
  backdrop?: boolean;
  blur?: boolean;
  fullScreen?: boolean;
}

export default function AnimatedModal({
  visible,
  onClose,
  children,
  animationType = 'scale',
  backdrop = true,
  blur = true,
  fullScreen = false
}: AnimatedModalProps) {
  const { gameState } = useGame();
  const isDarkMode = gameState.settings.darkMode;

  const getAnimationProps = () => {
    switch (animationType) {
      case 'slide':
        return {
          from: { translateY: screenHeight, opacity: 0 },
          animate: { translateY: 0, opacity: 1 },
          exit: { translateY: screenHeight, opacity: 0 },
        };
      case 'fade':
        return {
          from: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        };
      case 'bounce':
        return {
          from: { scale: 0.3, opacity: 0, translateY: -50 },
          animate: { scale: 1, opacity: 1, translateY: 0 },
          exit: { scale: 0.3, opacity: 0, translateY: -50 },
        };
      default: // scale
        return {
          from: { scale: 0.8, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          exit: { scale: 0.8, opacity: 0 },
        };
    }
  };

  const animationProps = getAnimationProps();

  const getTransition = () => {
    switch (animationType) {
      case 'slide':
        return {
          type: 'spring' as const,
          damping: 20,
          stiffness: 300,
        };
      case 'bounce':
        return {
          type: 'spring' as const,
          damping: 12,
          stiffness: 200,
        };
      default:
        return {
          type: 'spring' as const,
          damping: 15,
          stiffness: 150,
        };
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Backdrop (clickable) */}
        {backdrop && (
          <TouchableWithoutFeedback onPress={onClose}>
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'timing', duration: 200 }}
              style={styles.backdrop}
            >
              {blur ? (
                <BlurView
                  intensity={isDarkMode ? 20 : 30}
                  tint={isDarkMode ? 'dark' : 'light'}
                  style={styles.blurBackdrop}
                />
              ) : (
                <View style={[styles.solidBackdrop, isDarkMode && styles.solidBackdropDark]} />
              )}
            </MotiView>
          </TouchableWithoutFeedback>
        )}

        {/* Content */}
        <MotiView
          {...animationProps}
          transition={getTransition()}
          style={[
            styles.content,
            fullScreen && styles.fullScreenContent,
            isDarkMode && styles.contentDark
          ]}
        >
          {children}
        </MotiView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  blurBackdrop: {
    flex: 1,
  },
  solidBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  solidBackdropDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    margin: 20,
    maxWidth: screenWidth * 0.9,
    maxHeight: screenHeight * 0.8,
    boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  contentDark: {
    backgroundColor: '#1F2937',
  },
  fullScreenContent: {
    width: screenWidth,
    height: screenHeight,
    margin: 0,
    borderRadius: 0,
    maxWidth: undefined,
    maxHeight: undefined,
  },
  touchableBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
