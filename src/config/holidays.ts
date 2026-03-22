/**
 * South African Public Holidays 2024-2026
 * Per the Public Holidays Act 36 of 1994 and subsequent amendments.
 * When a public holiday falls on a Sunday, the following Monday is observed.
 */

export interface PublicHoliday {
  date: string; // YYYY-MM-DD
  name: string;
}

export const SA_PUBLIC_HOLIDAYS: PublicHoliday[] = [
  // 2024
  { date: '2024-01-01', name: "New Year's Day" },
  { date: '2024-03-21', name: 'Human Rights Day' },
  { date: '2024-03-29', name: 'Good Friday' },
  { date: '2024-04-01', name: 'Family Day' },
  { date: '2024-04-27', name: 'Freedom Day' },
  { date: '2024-05-01', name: "Workers' Day" },
  { date: '2024-05-29', name: 'General Election Day' }, // Once-off 2024
  { date: '2024-06-16', name: 'Youth Day' },
  { date: '2024-06-17', name: 'Youth Day (observed)' },
  { date: '2024-08-09', name: "National Women's Day" },
  { date: '2024-09-24', name: 'Heritage Day' },
  { date: '2024-12-16', name: 'Day of Reconciliation' },
  { date: '2024-12-25', name: 'Christmas Day' },
  { date: '2024-12-26', name: 'Day of Goodwill' },

  // 2025
  { date: '2025-01-01', name: "New Year's Day" },
  { date: '2025-03-21', name: 'Human Rights Day' },
  { date: '2025-04-18', name: 'Good Friday' },
  { date: '2025-04-21', name: 'Family Day' },
  { date: '2025-04-27', name: 'Freedom Day' },
  { date: '2025-04-28', name: 'Freedom Day (observed)' },
  { date: '2025-05-01', name: "Workers' Day" },
  { date: '2025-06-16', name: 'Youth Day' },
  { date: '2025-08-09', name: "National Women's Day" },
  { date: '2025-09-24', name: 'Heritage Day' },
  { date: '2025-12-16', name: 'Day of Reconciliation' },
  { date: '2025-12-25', name: 'Christmas Day' },
  { date: '2025-12-26', name: 'Day of Goodwill' },

  // 2026
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-03-21', name: 'Human Rights Day' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-06', name: 'Family Day' },
  { date: '2026-04-27', name: 'Freedom Day' },
  { date: '2026-05-01', name: "Workers' Day" },
  { date: '2026-06-16', name: 'Youth Day' },
  { date: '2026-08-09', name: "National Women's Day" },
  { date: '2026-08-10', name: "National Women's Day (observed)" },
  { date: '2026-09-24', name: 'Heritage Day' },
  { date: '2026-12-16', name: 'Day of Reconciliation' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-26', name: 'Day of Goodwill' },
];

const holidaySet = new Set(SA_PUBLIC_HOLIDAYS.map((h) => h.date));

export function isPublicHoliday(date: Date): boolean {
  const dateStr = date.toISOString().split('T')[0];
  return holidaySet.has(dateStr);
}

export function getHolidayName(date: Date): string | null {
  const dateStr = date.toISOString().split('T')[0];
  const holiday = SA_PUBLIC_HOLIDAYS.find((h) => h.date === dateStr);
  return holiday?.name ?? null;
}
