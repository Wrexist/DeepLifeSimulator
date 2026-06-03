import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';

const LinearGradient = LinearGradientFallback;

interface OnboardingFloatingButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export default function OnboardingFloatingButton({
  title,
  onPress,
  disabled = false,
  icon,
}: OnboardingFloatingButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.floatingButton, disabled ? styles.disabled : undefined]}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={['#10B981', '#059669', '#047857']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.iconContainer}>
            {icon || <ArrowRight size={24} color="#FFFFFF" />}
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 16,
    ...Platform.select({
      web: { boxShadow: '0px 8px 20px rgba(16, 185, 129, 0.6)' } as any,
      default: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
      },
    }),
  },
  disabled: {
    opacity: 0.5,
  },
  gradient: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
    minHeight: 64,
    justifyContent: 'center',
    elevation: 8,
    ...Platform.select({
      web: { boxShadow: '0px 4px 12px rgba(16, 185, 129, 0.5)' } as any,
      default: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
      },
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    width: '100%',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    ...Platform.select({
      web: { textShadow: '0px 2px 4px rgba(0, 0, 0, 0.3)' } as any,
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
      },
    }),
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    elevation: 3,
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(255, 255, 255, 0.1)' } as any,
      default: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
});
