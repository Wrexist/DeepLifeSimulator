import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { calcWeeklyPassiveIncome } from '@/lib/economy/passiveIncome';
import { calcWeeklyExpenses } from '@/lib/economy/expenses';
import { getWeeklyInflationRate } from '@/lib/economy/inflation';

interface LoanSummary {
  principal?: number;
}

export default function FinanceOverview() {
  const { gameState } = useGame();
  const passive = calcWeeklyPassiveIncome(gameState);
  const expenses = calcWeeklyExpenses(gameState as typeof gameState & { loans?: LoanSummary[] });
  const loans = ((gameState as typeof gameState & { loans?: LoanSummary[] }).loans) || [];
  const totalLoans = loans.reduce((sum, l) => sum + (l.principal ?? 0), 0);
  const inflation = getWeeklyInflationRate(gameState) * 100;

  const containerStyle = [styles.container, gameState.settings.darkMode && styles.containerDark];
  const titleStyle = [styles.title, gameState.settings.darkMode && styles.titleDark];
  const textStyle = [styles.text, gameState.settings.darkMode && styles.textDark];

  return (
    <View style={containerStyle}>
      <Text style={titleStyle}>Finance Overview</Text>
      <Text style={textStyle}>Passive Income: ${passive.total.toFixed(2)}</Text>
      <Text style={textStyle}>Expenses: ${expenses.total.toFixed(2)}</Text>
      <Text style={textStyle}>Loans: ${totalLoans.toFixed(2)}</Text>
      <Text style={textStyle}>Inflation: {inflation.toFixed(2)}%/week</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  containerDark: {
    backgroundColor: '#1F2937',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  titleDark: {
    color: '#F9FAFB',
  },
  text: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 4,
  },
  textDark: {
    color: '#D1D5DB',
  },
});
