import { isPublicHoliday } from './holidays';

/**
 * Check if a given date is a South African business day.
 * A business day is Monday-Friday, excluding SA public holidays.
 */
export function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false; // Weekend
  return !isPublicHoliday(date);
}

/**
 * Add a number of business days to a date.
 * @param startDate - The starting date
 * @param days - Number of business days to add (positive integer)
 * @returns The resulting date after adding business days
 */
export function addBusinessDays(startDate: Date, days: number): Date {
  if (days < 0) throw new Error('days must be a non-negative integer');

  const result = new Date(startDate);
  let added = 0;

  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) {
      added++;
    }
  }

  return result;
}

/**
 * Count business days between two dates (exclusive of both endpoints).
 */
export function countBusinessDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  current.setDate(current.getDate() + 1);

  while (current < end) {
    if (isBusinessDay(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Calculate the deadline date for a Section 8(1) 7-day breach notice.
 * The 7 days are calendar days per the Rental Housing Act.
 */
export function calculateSection8SevenDayDeadline(issueDate: Date): Date {
  const deadline = new Date(issueDate);
  deadline.setDate(deadline.getDate() + 7);
  return deadline;
}

/**
 * Calculate the deadline date for a Section 8(1)(a) 20 business day notice.
 * Per the Consumer Protection Act, 20 business days excludes weekends and public holidays.
 */
export function calculateSection8TwentyDayDeadline(issueDate: Date): Date {
  return addBusinessDays(issueDate, 20);
}
