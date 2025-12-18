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
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Link,
} from 'lucide-react-native';
import { SystemInterconnection } from '@/lib/depth/systemInterconnections';
import { scale, fontScale, responsivePadding, responsiveSpacing, responsiveBorderRadius } from '@/utils/scaling';

interface SystemInterconnectionIndicatorProps {
  interconnections: SystemInterconnection[];
  compact?: boolean;
  darkMode?: boolean;
  onPress?: () => void;
}

const SYSTEM_ICONS: Record<string, string> = {
  career: '💼',
  relationships: '❤️',
  health: '🏥',
  hobbies: '🎨',
  money: '💰',
  happiness: '😊',
  energy: '⚡',
  reputation: '⭐',
  education: '📚',
  travel: '✈️',
  politics: '🏛️',
  rd: '🔬',
  company: '🏢',
  realEstate: '🏠',
  stocks: '📈',
  socialMedia: '📱',
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
          <Link size={scale(16)} color={darkMode ? '#60A5FA' : '#3B82F6'} />
          <Text style={[styles.headerText, darkMode && styles.headerTextDark]}>
            Affects {activeInterconnections.length} system{activeInterconnections.length !== 1 ? 's' : ''}
          </Text>
          {!compact && (
            expanded ? (
              <ChevronUp size={scale(16)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
            ) : (
              <ChevronDown size={scale(16)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
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
  const sourceIcon = SYSTEM_ICONS[interconnection.sourceSystem] || '🔗';
  const targetIcon = SYSTEM_ICONS[interconnection.targetSystem] || '🔗';

  return (
    <View style={[styles.item, darkMode && styles.itemDark]}>
      <View style={styles.itemContent}>
        <Text style={styles.icon}>{sourceIcon}</Text>
        <ArrowRight size={scale(12)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
        <Text style={styles.icon}>{targetIcon}</Text>
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
    backgroundColor: '#F3F4F6',
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
    marginVertical: responsiveSpacing.xs,
  },
  containerDark: {
    backgroundColor: '#374151',
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
    color: '#374151',
    flex: 1,
  },
  headerTextDark: {
    color: '#D1D5DB',
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
    backgroundColor: '#4B5563',
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
    color: '#6B7280',
    flex: 1,
  },
  itemTextDark: {
    color: '#9CA3AF',
  },
});

