import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useGame } from '@/contexts/GameContext';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  progress?: number;
  showProgress?: boolean;
}

export function LoadingOverlay({ 
  visible, 
  message = 'Loading...', 
  progress,
  showProgress = false 
}: LoadingOverlayProps) {
  const { gameState } = useGame();
  const { settings } = gameState;

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
    >
      <View style={styles.overlay}>
        <LinearGradient
          colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.container}
        >
          <View style={styles.content}>
            <ActivityIndicator 
              size="large" 
              color={settings.darkMode ? '#3B82F6' : '#1F2937'} 
            />
            <Text style={[
              styles.message,
              settings.darkMode && styles.messageDark
            ]}>
              {message}
            </Text>
            
            {showProgress && progress !== undefined && (
              <View style={styles.progressContainer}>
                <View style={[
                  styles.progressBar,
                  settings.darkMode && styles.progressBarDark
                ]}>
                  <View 
                    style={[
                      styles.progressFill,
                      { width: `${Math.min(100, Math.max(0, progress))}%` }
                    ]} 
                  />
                </View>
                <Text style={[
                  styles.progressText,
                  settings.darkMode && styles.progressTextDark
                ]}>
                  {Math.round(progress)}%
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

interface LoadingButtonProps {
  loading: boolean;
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
  disabled?: boolean;
}

export function LoadingButton({ 
  loading, 
  onPress, 
  children, 
  style, 
  disabled = false 
}: LoadingButtonProps) {
  return (
    <View style={[styles.buttonContainer, style]}>
      {loading && (
        <View style={styles.buttonLoading}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      )}
      <Text style={[
        styles.buttonText,
        (loading || disabled) && styles.buttonTextDisabled
      ]}>
        {children}
      </Text>
    </View>
  );
}

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  message?: string;
}

export function LoadingSpinner({ 
  size = 'large', 
  color = '#3B82F6',
  message 
}: LoadingSpinnerProps) {
  return (
    <View style={styles.spinnerContainer}>
      <ActivityIndicator size={size} color={color} />
      {message && (
        <Text style={styles.spinnerMessage}>{message}</Text>
      )}
    </View>
  );
}

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export function SkeletonLoader({ 
  width = '100%', 
  height = 20, 
  borderRadius = 4,
  style 
}: SkeletonLoaderProps) {
  return (
    <View 
      style={[
        styles.skeleton,
        { width, height, borderRadius },
        style
      ]} 
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 200,
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    alignItems: 'center',
  },
  message: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginTop: 16,
    textAlign: 'center',
  },
  messageDark: {
    color: '#F9FAFB',
  },
  progressContainer: {
    width: '100%',
    marginTop: 20,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarDark: {
    backgroundColor: '#374151',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  progressTextDark: {
    color: '#9CA3AF',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    minHeight: 44,
  },
  buttonLoading: {
    marginRight: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextDisabled: {
    opacity: 0.6,
  },
  spinnerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  spinnerMessage: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center',
  },
  skeleton: {
    backgroundColor: '#E5E7EB',
    opacity: 0.6,
  },
});
