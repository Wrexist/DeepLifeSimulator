/**
 * System Interconnection Indicator
 * Visual indicator showing system effects when performing actions
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import {
  ArrowRight,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  FlaskConical,
  GraduationCap,
  Heart,
  Home,
  Landmark,
  Link as LinkIcon,
  Palette,
  Plane,
  Smartphone,
  Smile,
  Star,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react-native';
import { SystemInterconnection } from '@/lib/depth/systemInterconnections';
import { scale, fontScale, responsivePadding, responsiveSpacing, responsiveBorderRadius } from '@/utils/scaling';

interface SystemInterconnectionIndicatorProps {
  interconnections: SystemInterconnection[];
  compact?: boolean;
  darkMode?: boolean;
  onPress?: () => void;
}

type LucideIcon = React.ComponentType<{ size?: number; color?: string }>;

const SYSTEM_ICONS: Record<string, LucideIcon> = {
  career: Briefcase,
  relationships: Heart,
  health: Stethoscope,
  hobbies: Palette,
  money: DollarSign,
  happiness: Smile,
  energy: Zap,
  reputation: Star,
  education: GraduationCap,
  travel: Plane,
  politics: Landmark,
  rd: FlaskConical,
  company: Building2,
  realEstate: Home,
  stocks: TrendingUp,
  socialMedia: Smartphone,
};

export default function SystemInterconnectionIndicator({
  interconnections,
  compact = false,
  darkMode = false,
  onPress,
}: SystemInterconnectionIndicatorProps) {
  const [expanded, setExpanded] = useState(!compact);
  const [animation] = useState(new Animated.Value(expanded ? 1 : 0));

  React.useEffect(() => {
    Animated.timing(animation, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [expanded, animation]);

  if (!interconnections || interconnections.length === 0) {
    return null;
  }

  const activeInterconnections = interconnections.filter(ic => ic.isActive);
  if (activeInterconnections.length === 0) {
    return null;
  }

  const height = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [compact ? scale(40) : scale(50), scale(50) + (activeInterconnections.length * scale(35))],
  });

  const handleToggle = () => {
    if (!compact) {
      setExpanded(!expanded);
    }
    onPress?.();
  };

  return (
    <Animated.View style={[styles.container, { height }, darkMode && styles.containerDark]}>
      <TouchableOpacity
        onPress={handleToggle}
        activeOpacity={0.7}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <LinkIcon size={scale(16)} color={darkMode ? '#60A5FA' : '#3B82F6'} />
          <Text style={[styles.headerText, darkMode && styles.headerTextDark]}>
            Affects {activeInterconnections.length} system{activeInterconnections.length !== 1 ? 's' : ''}
          </Text>
          {!compact && (
            expanded ? (
              <ChevronUp size={scale(16)} color={darkMode ? '#94A3B8' : '#64748B'} />
            ) : (
              <ChevronDown size={scale(16)} color={darkMode ? '#94A3B8' : '#64748B'} />
            )
          )}
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.interconnectionsList}>
          {activeInterconnections.map((ic, index) => (
            <InterconnectionItem
              key={`${ic.sourceSystem}-${ic.targetSystem}-${index}`}
              interconnection={ic}
              darkMode={darkMode}
            />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

function InterconnectionItem({
  interconnection,
  darkMode,
}: {
  interconnection: SystemInterconnection;
  darkMode: boolean;
}) {
  const isPositive = interconnection.effectType === 'positive';
  const SourceIcon = SYSTEM_ICONS[interconnection.sourceSystem] || LinkIcon;
  const TargetIcon = SYSTEM_ICONS[interconnection.targetSystem] || LinkIcon;
  const iconColor = darkMode ? '#CBD5E1' : '#334155';

  return (
    <View style={[styles.item, darkMode && styles.itemDark]}>
      <View style={styles.itemContent}>
        <SourceIcon size={scale(14)} color={iconColor} />
        <ArrowRight size={scale(12)} color={darkMode ? '#94A3B8' : '#64748B'} />
        <TargetIcon size={scale(14)} color={iconColor} />
        <View style={styles.effectIndicator}>
          {isPositive ? (
            <TrendingUp size={scale(12)} color="#10B981" />
          ) : (
            <TrendingDown size={scale(12)} color="#EF4444" />
          )}
        </View>
        <Text style={[styles.itemText, darkMode && styles.itemTextDark]} numberOfLines={1}>
          {interconnection.description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F1F5F9',
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
    marginVertical: responsiveSpacing.xs,
  },
  containerDark: {
    backgroundColor: '#334155',
  },
  header: {
    paddingHorizontal: responsivePadding.small,
    paddingVertical: responsiveSpacing.sm,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  headerText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  headerTextDark: {
    color: '#CBD5E1',
  },
  interconnectionsList: {
    paddingHorizontal: responsivePadding.small,
    paddingBottom: responsiveSpacing.sm,
  },
  item: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.sm,
    padding: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.xs,
  },
  itemDark: {
    backgroundColor: '#475569',
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  icon: {
    fontSize: fontScale(14),
  },
  effectIndicator: {
    marginLeft: responsiveSpacing.xs,
  },
  itemText: {
    fontSize: fontScale(11),
    color: '#64748B',
    flex: 1,
  },
  itemTextDark: {
    color: '#94A3B8',
  },
});

