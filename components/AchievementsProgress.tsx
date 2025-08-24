import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useGame } from '@/contexts/GameContext';
import { Trophy, Gem } from 'lucide-react-native';
import { useAchievements } from '@/hooks/useAchievements';

export default function AchievementsProgress() {
  const { gameState, claimProgressAchievement } = useGame();
  const { achievements } = useAchievements();
  const [sort, setSort] = useState<'progress' | 'title'>('progress');
  const display = useMemo(
    () =>
      [...achievements].sort(
        sort === 'progress'
          ? (a, b) => b.progress - a.progress
          : (a, b) => a.title.localeCompare(b.title)
      ),
    [achievements, sort]
  );

  return (
    <View style={[styles.container, gameState.settings.darkMode && styles.containerDark]}>
      <View style={styles.header}>
        <Trophy size={24} color={gameState.settings.darkMode ? '#FBBF24' : '#F59E0B'} />
        <Text style={[styles.title, gameState.settings.darkMode && styles.titleDark]}>Achievements in Progress</Text>
      </View>
      <View style={styles.controls}>
        <TouchableOpacity
          onPress={() => setSort(sort === 'progress' ? 'title' : 'progress')}
          style={styles.sortToggle}
        >
          <Text
            style={[
              styles.controlText,
              gameState.settings.darkMode && styles.controlTextDark,
            ]}
          >
            Sort: {sort === 'progress' ? 'Progress' : 'Title'}
          </Text>
        </TouchableOpacity>
      </View>
      <View>
        {display.length === 0 && (
          <Text style={[styles.empty, gameState.settings.darkMode && styles.cardDescDark]}>No achievements in progress.</Text>
        )}
        {display.map(a => {
          const progress = Math.min(1, a.progress);
          return (
            <View key={a.id} style={[styles.card, gameState.settings.darkMode && styles.cardDark]}>
              <View style={styles.cardHeader}>
                {a.icon && <Image source={a.icon} style={styles.achievementIcon} />}
                <Text style={[styles.cardTitle, gameState.settings.darkMode && styles.cardTitleDark]}>{a.title}</Text>
                <View style={styles.headerRight}>
                  <Text style={styles.stackText}>{`${a.stackIndex + 1}/${a.stackSize}`}</Text>
                  {a.goldReward > 0 && (
                    <View style={styles.reward}>
                      <Gem size={16} color="#3B82F6" />
                      <Text style={[styles.rewardText, { color: '#3B82F6' }]}>{a.goldReward}</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={[styles.cardDesc, gameState.settings.darkMode && styles.cardDescDark]}>{a.description}</Text>
              {a.nextTitle && (
                <Text style={[styles.nextText, gameState.settings.darkMode && styles.cardDescDark]}>
                  Next: {a.nextTitle}
                </Text>
              )}
              {a.progress >= 1 ? (
                <TouchableOpacity onPress={() => claimProgressAchievement(a.id, a.goldReward)}>
                  <LinearGradient
                    colors={['#3B82F6', '#1D4ED8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.claimButton}
                  >
                    <Text style={styles.claimText}>Claim</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` }]}
                  >
                    <LinearGradient
                      colors={['#60A5FA', '#3B82F6', '#2563EB']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  containerDark: {
    backgroundColor: '#374151',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
  },
  titleDark: {
    color: '#F9FAFB',
  },
  card: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  cardDark: {
    backgroundColor: '#1F2937',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  achievementIcon: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  cardTitleDark: {
    color: '#F9FAFB',
  },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardText: {
    marginLeft: 4,
    color: '#FBBF24',
    fontWeight: '600',
  },
  stackText: {
    marginRight: 8,
    color: '#9CA3AF',
    fontSize: 12,
  },
  cardDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  cardDescDark: {
    color: '#D1D5DB',
  },
  nextText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  empty: {
    textAlign: 'center',
    marginBottom: 8,
    color: '#6B7280',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 12,
  },
  controlText: {
    color: '#1F2937',
  },
  controlTextDark: {
    color: '#F9FAFB',
  },
  sortToggle: {
    padding: 4,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  unlocked: {
    color: '#10B981',
    fontWeight: '600',
  },
  claimButton: {
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 3,
  },
  claimText: {
    fontWeight: '600',
    color: '#1F2937',
  },
});
