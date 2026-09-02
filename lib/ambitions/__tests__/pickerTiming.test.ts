import { ambitionPickerReady, AMBITION_PICKER_AFTER_CHAPTER } from '../pickerTiming';
import { createTestGameState } from '../../../__tests__/helpers/createTestGameState';

describe('ambitionPickerReady', () => {
  it('is false on frame one of a fresh life', () => {
    expect(ambitionPickerReady(createTestGameState({ completedChapters: [] }))).toBe(false);
    expect(ambitionPickerReady(null)).toBe(false);
    expect(ambitionPickerReady({ completedChapters: undefined as any })).toBe(false);
  });

  it('is true once Chapter 1 is complete', () => {
    expect(AMBITION_PICKER_AFTER_CHAPTER).toBe('ch1_fresh_start');
    expect(ambitionPickerReady(createTestGameState({ completedChapters: ['ch1_fresh_start'] }))).toBe(true);
  });
});
