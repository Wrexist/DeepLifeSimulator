import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { X, TrendingUp, TrendingDown } from 'lucide-react-native';
import WeeklyResultSheet from './WeeklyResultSheet';

export default function DailySummaryModal() {
  const { gameState, setGameState } = useGame();
  const { settings } = gameState;

  if (!settings.notificationsEnabled || !gameState.dailySummary) return null;

  const { moneyChange, statsChange, events } = gameState.dailySummary;

  const handleClose = () => {
    // Clear the daily summary
    setGameState(prev => ({
      ...prev,
      dailySummary: undefined,
    }));
  };

  return (
    <WeeklyResultSheet visible onClose={handleClose}>
        <View style={[styles.popup, settings.darkMode && styles.popupDark]}>
          <View style={styles.header}>
            <Text style={[styles.title, settings.darkMode && styles.titleDark]}>Week {gameState.week} Summary</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={settings.darkMode ? '#D1D5DB' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {moneyChange !== 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>Financial</Text>
                <View
                  style={[
                    styles.changeItem,
                    moneyChange > 0
                      ? settings.darkMode ? styles.positiveDark : styles.positive
                      : settings.darkMode ? styles.negativeDark : styles.negative,
                  ]}>
                  {moneyChange > 0 ? (
                    <TrendingUp size={16} color="#10B981" />
                  ) : (
                    <TrendingDown size={16} color="#EF4444" />
                  )}
                  <Text style={[styles.changeText, moneyChange > 0 ? styles.positiveText : styles.negativeText]}>
                    Money: {moneyChange > 0 ? '+' : ''}${moneyChange}
                  </Text>
                </View>
              </View>
            )}

            {Object.keys(statsChange).length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>Stats Changes</Text>
                {Object.entries(statsChange).map(([stat, change]) => {
                  if (change === 0) return null;
                  return (
                    <View
                      key={stat}
                      style={[
                        styles.changeItem,
                        change! > 0
                          ? settings.darkMode ? styles.positiveDark : styles.positive
                          : settings.darkMode ? styles.negativeDark : styles.negative,
                      ]}>
                      {change! > 0 ? (
                        <TrendingUp size={16} color="#10B981" />
                      ) : (
                        <TrendingDown size={16} color="#EF4444" />
                      )}
                      <Text style={[styles.changeText, change! > 0 ? styles.positiveText : styles.negativeText]}>
                        {stat.charAt(0).toUpperCase() + stat.slice(1)}: {change! > 0 ? '+' : ''}{change}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {events.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>Events</Text>
                  {events.map(event => (
                    <View key={event} style={[styles.eventItem, settings.darkMode && styles.eventItemDark]}>
                      <Text style={[styles.eventText, settings.darkMode && styles.eventTextDark]}>• {event}</Text>
                    </View>
                  ))}
                </View>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.continueButton} onPress={handleClose}>
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
    </WeeklyResultSheet>
  );
}

const styles = StyleSheet.create({
  popup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    maxWidth: 400,
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  popupDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
    paddingTop: 10,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  sectionTitleDark: {
    color: '#D1D5DB',
  },
  changeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  positive: {
    backgroundColor: '#F0FDF4',
  },
  positiveDark: {
    backgroundColor: '#064E3B',
  },
  negative: {
    backgroundColor: '#FEF2F2',
  },
  negativeDark: {
    backgroundColor: '#7F1D1D',
  },
  changeText: {
    fontSize: 14,
    marginLeft: 8,
  },
  positiveText: {
    color: '#059669',
  },
  negativeText: {
    color: '#DC2626',
  },
  eventItem: {
    padding: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginBottom: 4,
  },
  eventItemDark: {
    backgroundColor: '#374151',
  },
  eventText: {
    fontSize: 14,
    color: '#374151',
  },
  eventTextDark: {
    color: '#F9FAFB',
  },
  continueButton: {
    backgroundColor: '#3B82F6',
    padding: 16,
    margin: 20,
    marginTop: 0,
    borderRadius: 8,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});