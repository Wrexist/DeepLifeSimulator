import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, X, Zap, DollarSign, Heart, Briefcase, ShoppingCart, Home, TrendingUp, Plane } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useRouter } from 'expo-router';
import { responsiveSpacing, responsiveBorderRadius, responsiveFontSize } from '@/utils/scaling';
import TravelModal from './TravelModal';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string[];
  onPress: () => void;
  disabled?: boolean;
}

interface QuickActionsPanelProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export default function QuickActionsPanel({ position = 'bottom-right' }: QuickActionsPanelProps) {
  const { gameState, nextWeek, saveGame } = useGame();
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTravelModal, setShowTravelModal] = useState(false);
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  const { width } = Dimensions.get('window');

  const quickActions: QuickAction[] = [
    {
      id: 'nextWeek',
      label: 'Next Week',
      icon: Zap,
      color: ['#10B981', '#059669'],
      onPress: () => {
        nextWeek();
        setIsExpanded(false);
      },
    },
    {
      id: 'travel',
      label: 'Travel',
      icon: Plane,
      color: ['#8B5CF6', '#7C3AED'],
      onPress: () => {
        setShowTravelModal(true);
        setIsExpanded(false);
      },
    },
    {
      id: 'work',
      label: 'Work',
      icon: Briefcase,
      color: ['#3B82F6', '#2563EB'],
      onPress: () => {
        router.push('/(tabs)/work');
        setIsExpanded(false);
      },
    },
    {
      id: 'market',
      label: 'Market',
      icon: ShoppingCart,
      color: ['#F59E0B', '#D97706'],
      onPress: () => {
        router.push('/(tabs)/market');
        setIsExpanded(false);
      },
    },
    {
      id: 'bank',
      label: 'Bank',
      icon: DollarSign,
      color: ['#8B5CF6', '#7C3AED'],
      onPress: () => {
        router.push('/(tabs)/bank');
        setIsExpanded(false);
      },
    },
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      color: ['#EC4899', '#DB2777'],
      onPress: () => {
        router.push('/(tabs)/');
        setIsExpanded(false);
      },
    },
    {
      id: 'save',
      label: 'Save',
      icon: TrendingUp,
      color: ['#06B6D4', '#0891B2'],
      onPress: async () => {
        await saveGame();
        setIsExpanded(false);
      },
    },
  ];

  React.useEffect(() => {
    if (isExpanded) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isExpanded]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const getPositionStyle = () => {
    const baseStyle = {
      position: 'absolute' as const,
      zIndex: 1000,
    };

    switch (position) {
      case 'bottom-right':
        return { ...baseStyle, bottom: 20, right: 20 };
      case 'bottom-left':
        return { ...baseStyle, bottom: 20, left: 20 };
      case 'top-right':
        return { ...baseStyle, top: 20, right: 20 };
      case 'top-left':
        return { ...baseStyle, top: 20, left: 20 };
      default:
        return { ...baseStyle, bottom: 20, right: 20 };
    }
  };

  return (
    <View style={[styles.container, getPositionStyle()]}>
      {/* Action Buttons */}
      {quickActions.map((action, index) => {
        const Icon = action.icon;
        const translateY = scaleAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -(index + 1) * 60],
        });

        return (
          <Animated.View
            key={action.id}
            style={[
              styles.actionButtonContainer,
              {
                opacity: opacityAnim,
                transform: [
                  { translateY },
                  { scale: scaleAnim },
                ],
              },
            ]}
          >
            <TouchableOpacity
              onPress={action.onPress}
              disabled={action.disabled}
              style={styles.actionButton}
              activeOpacity={0.8}
              accessibilityLabel={action.label}
              accessibilityRole="button"
            >
              <LinearGradient
                colors={action.color}
                style={styles.actionButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Icon size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
            <View style={styles.actionLabelContainer}>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </View>
          </Animated.View>
        );
      })}

      {/* Main FAB */}
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        style={styles.fab}
        activeOpacity={0.8}
        accessibilityLabel={isExpanded ? "Close quick actions" : "Open quick actions"}
        accessibilityRole="button"
      >
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <LinearGradient
            colors={['#3B82F6', '#2563EB']}
            style={styles.fabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {isExpanded ? (
              <X size={24} color="#FFFFFF" />
            ) : (
              <Plus size={24} color="#FFFFFF" />
            )}
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>

      <TravelModal visible={showTravelModal} onClose={() => setShowTravelModal(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonContainer: {
    position: 'absolute',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  actionButtonGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabelContainer: {
    position: 'absolute',
    right: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 12,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

