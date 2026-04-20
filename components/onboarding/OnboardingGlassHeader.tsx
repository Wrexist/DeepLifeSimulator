import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowLeft, Info } from 'lucide-react-native';
import { responsiveFontSize, responsivePadding, responsiveSpacing } from '@/utils/scaling';

interface OnboardingGlassHeaderProps {
  title: string;
  onBack: () => void;
  onInfo?: () => void;
}

export default function OnboardingGlassHeader({ title, onBack, onInfo }: OnboardingGlassHeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity accessibilityLabel="Go back" onPress={onBack} style={styles.buttonWrap}>
        <View style={styles.glassButton}>
          <View style={styles.glassOverlay} />
          <ArrowLeft size={24} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      {onInfo ? (
        <TouchableOpacity accessibilityLabel="More information" onPress={onInfo} style={styles.buttonWrap}>
          <View style={styles.glassButton}>
            <View style={styles.glassOverlay} />
            <Info size={20} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsivePadding.large,
    paddingTop: responsiveSpacing.lg,
    paddingBottom: responsiveSpacing.lg,
  },
  buttonWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  glassButton: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  glassOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  title: {
    fontSize: responsiveFontSize['3xl'],
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    marginBottom: 8,
    ...Platform.select({
      web: { textShadow: '1px 1px 3px rgba(0, 0, 0, 0.5)' } as any,
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
      },
    }),
  },
  placeholder: {
    width: 48,
    height: 48,
  },
});
