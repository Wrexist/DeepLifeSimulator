import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { MotiView, MotiText } from '@/components/anim/MotiStub';
import { Loader } from 'lucide-react-native';

interface LoadingSpinnerProps {
  visible: boolean;
  message?: string;
  variant?: 'default' | 'overlay' | 'inline' | 'compact';
  size?: 'small' | 'large';
  color?: string;
}

export default function LoadingSpinner({
  visible,
  message = 'Loading...',
  variant = 'default',
  size = 'large',
  color = '#3B82F6',
}: LoadingSpinnerProps) {
  if (!visible) return null;

  const iconSize = size === 'large' ? 40 : 24;

  const renderContent = () => (
    <View style={styles.content}>
      <MotiView
        from={{ rotate: '0deg' }}
        animate={{ rotate: '360deg' }}
        transition={{
          type: 'timing',
          duration: 1500,
          loop: true,
          repeatReverse: false,
        }}
        style={[styles.spinnerContainer, !message && { marginBottom: 0 }]}
      >
        <Loader size={iconSize} color={color} />
      </MotiView>
      {message ? <Text style={[styles.message, { color }]}>{message}</Text> : null}
    </View>
  );

  if (variant === 'overlay') {
    return (
      <View style={styles.overlay}>
        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.5)']}
          style={styles.overlayGradient}
        >
          <View style={styles.overlayContent}>
            {renderContent()}
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (variant === 'inline') {
    return (
      <View style={styles.inlineContainer}>
        {renderContent()}
      </View>
    );
  }

  if (variant === 'compact') {
    return renderContent();
  }

  return (
    <View style={styles.defaultContainer}>
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 500, // Z_INDEX.LOADING
  },
  overlayGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContent: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 8,
  },
  defaultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  inlineContainer: {
    padding: 16,
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  spinnerContainer: {
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    fontWeight: '500',
  },
});

