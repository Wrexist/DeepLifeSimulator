import {
  getCurrentSeason,
  getCurrentHoliday,
  isSeasonalEventActive,
  getActiveSeasonalEvents,
  getSeasonalEventById,
  SEASONAL_EVENTS,
} from '@/lib/events/seasonal';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

describe('seasonal events', () => {
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const createMockGameState = (month: number, week: number) => createTestGameState({
    weeksLived: Math.max(0, week - 1),
    date: {
      year: 2024,
      month: monthNames[Math.max(0, Math.min(11, month - 1))],
      week,
      age: 25,
    },
  });

  describe('getCurrentSeason', () => {
    it('should return correct season for each month', () => {
      expect(getCurrentSeason(createMockGameState(3, 1))).toBe('spring');
      expect(getCurrentSeason(createMockGameState(6, 1))).toBe('summer');
      expect(getCurrentSeason(createMockGameState(9, 1))).toBe('fall');
      expect(getCurrentSeason(createMockGameState(12, 1))).toBe('winter');
    });
  });

  describe('getCurrentHoliday', () => {
    it('should return correct holiday for specific dates', () => {
      expect(getCurrentHoliday(createMockGameState(1, 1))).toBe('newYear');
      expect(getCurrentHoliday(createMockGameState(2, 2))).toBe('valentines');
      expect(getCurrentHoliday(createMockGameState(10, 4))).toBe('halloween');
      expect(getCurrentHoliday(createMockGameState(12, 3))).toBe('christmas');
    });

    it('should return null for non-holiday dates', () => {
      expect(getCurrentHoliday(createMockGameState(3, 2))).toBeNull();
      expect(getCurrentHoliday(createMockGameState(7, 2))).toBeNull();
    });
  });

  describe('isSeasonalEventActive', () => {
    it('should correctly identify active events', () => {
      const event = SEASONAL_EVENTS.find(e => e.id === 'new-year');
      if (event) {
        const gameState = createMockGameState(1, 1);
        expect(isSeasonalEventActive(event, gameState)).toBe(true);
      }
    });

    it('should correctly identify inactive events', () => {
      const event = SEASONAL_EVENTS.find(e => e.id === 'christmas');
      if (event) {
        const gameState = createMockGameState(3, 1);
        expect(isSeasonalEventActive(event, gameState)).toBe(false);
      }
    });
  });

  describe('getActiveSeasonalEvents', () => {
    it('should return active events for current date', () => {
      const gameState = createMockGameState(12, 3);
      const activeEvents = getActiveSeasonalEvents(gameState);
      expect(activeEvents.length).toBeGreaterThan(0);
      expect(activeEvents.some(e => e.id === 'christmas')).toBe(true);
    });
  });

  describe('getSeasonalEventById', () => {
    it('should return event by ID', () => {
      const event = getSeasonalEventById('new-year');
      expect(event).toBeDefined();
      expect(event?.id).toBe('new-year');
    });

    it('should return undefined for invalid ID', () => {
      const event = getSeasonalEventById('invalid-id');
      expect(event).toBeUndefined();
    });
  });
});
