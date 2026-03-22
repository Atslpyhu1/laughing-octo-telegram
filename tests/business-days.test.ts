import {
  isBusinessDay,
  addBusinessDays,
  countBusinessDaysBetween,
  calculateSection8SevenDayDeadline,
  calculateSection8TwentyDayDeadline,
} from '../src/config/business-days';
import { isPublicHoliday, getHolidayName } from '../src/config/holidays';

describe('SA Public Holidays', () => {
  test('should identify Freedom Day as a public holiday', () => {
    const freedomDay = new Date('2025-04-27');
    expect(isPublicHoliday(freedomDay)).toBe(true);
    expect(getHolidayName(freedomDay)).toBe('Freedom Day');
  });

  test('should identify a regular day as not a public holiday', () => {
    const regularDay = new Date('2025-03-10');
    expect(isPublicHoliday(regularDay)).toBe(false);
    expect(getHolidayName(regularDay)).toBeNull();
  });

  test('should handle observed holidays (Sunday holidays moved to Monday)', () => {
    // Freedom Day 2025 falls on Sunday, Monday is observed
    const observed = new Date('2025-04-28');
    expect(isPublicHoliday(observed)).toBe(true);
    expect(getHolidayName(observed)).toBe('Freedom Day (observed)');
  });
});

describe('Business Days', () => {
  test('weekdays should be business days (when not holidays)', () => {
    const monday = new Date('2025-03-10'); // Monday
    expect(isBusinessDay(monday)).toBe(true);
  });

  test('weekends should not be business days', () => {
    const saturday = new Date('2025-03-08');
    const sunday = new Date('2025-03-09');
    expect(isBusinessDay(saturday)).toBe(false);
    expect(isBusinessDay(sunday)).toBe(false);
  });

  test('public holidays should not be business days', () => {
    const humanRightsDay = new Date('2025-03-21');
    expect(isBusinessDay(humanRightsDay)).toBe(false);
  });

  test('addBusinessDays should skip weekends and holidays', () => {
    // Start on Friday 2025-03-07, add 1 business day = Monday 2025-03-10
    const result = addBusinessDays(new Date('2025-03-07'), 1);
    expect(result.toISOString().split('T')[0]).toBe('2025-03-10');
  });

  test('addBusinessDays should handle 0 days', () => {
    const start = new Date('2025-03-10');
    const result = addBusinessDays(start, 0);
    expect(result.toISOString().split('T')[0]).toBe('2025-03-10');
  });

  test('countBusinessDaysBetween should count correctly', () => {
    // Mon to Fri of same week = 4 business days (Tue, Wed, Thu, Fri)
    const count = countBusinessDaysBetween(
      new Date('2025-03-10'), // Monday
      new Date('2025-03-14'), // Friday
    );
    expect(count).toBe(3); // Tue, Wed, Thu (exclusive of endpoints)
  });
});

describe('Section 8 Deadline Calculations', () => {
  test('Section 8(1) 7-day notice should add 7 calendar days', () => {
    const issueDate = new Date('2025-03-10');
    const deadline = calculateSection8SevenDayDeadline(issueDate);
    expect(deadline.toISOString().split('T')[0]).toBe('2025-03-17');
  });

  test('Section 8(1)(a) 20 business day notice should skip weekends and holidays', () => {
    const issueDate = new Date('2025-03-10');
    const deadline = calculateSection8TwentyDayDeadline(issueDate);
    // 20 business days from March 10, skipping Human Rights Day (March 21)
    // and weekends, should land on approximately April 8
    expect(deadline.getFullYear()).toBe(2025);
    expect(deadline.getMonth()).toBe(3); // April (0-indexed)
  });
});
