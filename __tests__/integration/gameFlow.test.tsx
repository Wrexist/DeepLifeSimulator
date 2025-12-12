import { GameProvider, useGame } from '@/contexts/GameContext';
import { render, act, waitFor } from '@testing-library/react-native';
import React from 'react';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

describe('Game Flow Integration Tests', () => {
  let gameContext: any;

  beforeEach(() => {
    gameContext = null;
  });

  const TestComponent = () => {
    const context = useGame();
    gameContext = context;
    return null;
  };

  const renderWithGameContext = (initialState?: any) => {
    return render(
      <GameProvider initialState={initialState}>
        <TestComponent />
      </GameProvider>
    );
  };

  describe('Game Initialization', () => {
    it('should initialize with default state', async () => {
      renderWithGameContext();
      
      await waitFor(() => {
        expect(gameContext).toBeDefined();
        expect(gameContext.gameState).toBeDefined();
        expect(gameContext.gameState.stats.money).toBe(200); // Updated default
        expect(gameContext.gameState.stats.health).toBe(100);
        expect(gameContext.gameState.stats.happiness).toBe(100);
        expect(gameContext.gameState.stats.energy).toBe(100);
      });
    });

    it('should load saved game state', async () => {
      const mockSavedState = {
        stats: { money: 1000, health: 80, happiness: 90, energy: 50 },
        version: 1,
        updatedAt: Date.now(),
      };

      // Mock AsyncStorage to return saved state
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockSavedState));

      renderWithGameContext();

      await waitFor(() => {
        expect(gameContext.gameState.stats.money).toBe(1000);
        expect(gameContext.gameState.stats.health).toBe(80);
      });
    });
  });

  describe('Game Progression', () => {
    it('should advance week correctly', async () => {
      renderWithGameContext();
      
      await waitFor(() => expect(gameContext).toBeDefined());
      
      const initialWeek = gameContext.gameState.week;
      
      await act(async () => {
        gameContext.nextWeek();
      });

      await waitFor(() => {
        expect(gameContext.gameState.week).toBe(initialWeek + 1);
      });
    });

    it('should update stats when performing actions', async () => {
      renderWithGameContext();
      
      await waitFor(() => expect(gameContext).toBeDefined());
      
      const initialMoney = gameContext.gameState.stats.money;
      
      await act(async () => {
        gameContext.updateMoney(100, 'test');
      });

      await waitFor(() => {
        expect(gameContext.gameState.stats.money).toBe(initialMoney + 100);
      });
    });
  });

  describe('Save/Load System', () => {
    it('should save game state', async () => {
      renderWithGameContext();
      
      await waitFor(() => expect(gameContext).toBeDefined());
      
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      
      await act(async () => {
        await gameContext.saveGame();
      });

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should handle corrupted save data gracefully', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getItem.mockResolvedValue('invalid json');

      renderWithGameContext();

      await waitFor(() => {
        // Should fall back to default state
        expect(gameContext.gameState.stats.money).toBe(200); // Updated default
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle AsyncStorage errors gracefully', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      renderWithGameContext();

      await waitFor(() => {
        // Should still initialize with default state
        expect(gameContext.gameState).toBeDefined();
      });
    });
  });
});

