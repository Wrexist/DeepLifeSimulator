import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, TouchableOpacity } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  style?: ViewStyle;
  titleStyle?: TextStyle;
  descriptionStyle?: TextStyle;
  darkMode?: boolean;
}

export default function EmptyState({
  icon = '\u{1F52D}',
  title,
  description,
  actionText,
  onAction,
  style,
  titleStyle,
  descriptionStyle,
  darkMode = false,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={darkMode ? ['#374151', '#1F2937'] : ['#F9FAFB', '#F3F4F6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <Text style={styles.icon}>{icon}</Text>

          <Text style={[styles.title, darkMode && styles.titleDark, titleStyle]}>
            {title}
          </Text>

          {description && (
            <Text style={[styles.description, darkMode && styles.descriptionDark, descriptionStyle]}>
              {description}
            </Text>
          )}

          {actionText && onAction && (
            <TouchableOpacity
              style={styles.actionContainer}
              onPress={onAction}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionText, darkMode && styles.actionTextDark]}>
                {actionText}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

// Predefined empty states for common use cases
export function EmptyPortfolio({ onAddInvestment }: { onAddInvestment?: () => void }) {
  return (
    <EmptyState
      icon={'\u{1F4C8}'}
      title="No Investments Yet"
      description="Start building your portfolio by investing in stocks, crypto, or real estate."
      actionText="Start Investing"
      onAction={onAddInvestment}
    />
  );
}

export function EmptyProperties({ onBuyProperty }: { onBuyProperty?: () => void }) {
  return (
    <EmptyState
      icon={'\u{1F3E0}'}
      title="No Properties Owned"
      description="Invest in real estate to generate passive income and build wealth."
      actionText="Browse Properties"
      onAction={onBuyProperty}
    />
  );
}

export function EmptyAchievements() {
  return (
    <EmptyState
      icon={'\u{1F3C6}'}
      title="No Achievements Yet"
      description="Complete various life milestones to unlock achievements and earn rewards."
    />
  );
}

export function EmptyNotifications() {
  return (
    <EmptyState
      icon={'\u{1F514}'}
      title="No Notifications"
      description="You're all caught up! Check back later for updates."
    />
  );
}

export function EmptySearch({ searchTerm }: { searchTerm?: string }) {
  return (
    <EmptyState
      icon={'\u{1F50D}'}
      title="No Results Found"
      description={searchTerm ? `No results found for "${searchTerm}"` : "Try adjusting your search criteria."}
    />
  );
}

export function EmptyTransactions() {
  return (
    <EmptyState
      icon={'\u{1F4B3}'}
      title="No Transactions"
      description="Your transaction history will appear here once you start making purchases."
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  gradient: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minHeight: 200,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    maxWidth: 300,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  descriptionDark: {
    color: '#9CA3AF',
  },
  actionContainer: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionTextDark: {
    color: '#FFFFFF',
  },
});
