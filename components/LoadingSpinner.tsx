import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';

interface LoadingSpinnerProps {
  visible: boolean;
  message?: string;
  variant?: 'default' | 'overlay' | 'inline';
  size?: 'small' | 'large';
}

export default function LoadingSpinner({
  visible,
  message = 'Loading...',
  variant = 'default',
  size = 'large',
}: LoadingSpinnerProps) {
  if (!visible) return null;

  const renderContent = () => (
    <View style={styles.content}>
      <MotiView
        from={{ rotate: '0deg' }}
        animate={{ rotate: '360deg' }}
        transition={{
          type: 'timing',
          duration: 1000,
          loop: true,
        }}
        style={styles.spinnerContainer}
      >
        <ActivityIndicator
          size={size}
          color="#3B82F6"
          style={styles.spinner}
        />
      </MotiView>
      {message && <Text style={styles.message}>{message}</Text>}
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
    zIndex: 1000,
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
  },
  spinner: {
    width: 40,
    height: 40,
  },
  message: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    fontWeight: '500',
  },
});
