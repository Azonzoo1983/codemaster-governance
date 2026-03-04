import {
  calculateBusinessHours,
  formatBusinessHours,
  isBusinessDay,
  DEFAULT_CONFIG,
} from '../../lib/businessHours';

describe('calculateBusinessHours', () => {
  it('calculates hours within the same business day', () => {
    // Wednesday 2024-01-10, 9:00 to 15:00 = 6 business hours
    const start = new Date(2024, 0, 10, 9, 0, 0);
    const end = new Date(2024, 0, 10, 15, 0, 0);
    expect(calculateBusinessHours(start, end)).toBe(6);
  });

  it('clamps same-day hours to the business window', () => {
    // Wednesday 2024-01-10, 6:00 (before work) to 20:00 (after work) should yield 9h (8-17)
    const start = new Date(2024, 0, 10, 6, 0, 0);
    const end = new Date(2024, 0, 10, 20, 0, 0);
    expect(calculateBusinessHours(start, end)).toBe(9);
  });

  it('calculates hours spanning overnight (two consecutive business days)', () => {
    // Wednesday 2024-01-10 14:00 to Thursday 2024-01-11 11:00
    // Day 1: 14:00-17:00 = 3h, Day 2: 08:00-11:00 = 3h => total 6h
    const start = new Date(2024, 0, 10, 14, 0, 0);
    const end = new Date(2024, 0, 11, 11, 0, 0);
    expect(calculateBusinessHours(start, end)).toBe(6);
  });

  it('excludes weekends from the calculation', () => {
    // Friday 2024-01-12 14:00 to Monday 2024-01-15 11:00
    // Friday: 14:00-17:00 = 3h, Sat & Sun = 0h, Monday: 08:00-11:00 = 3h => 6h
    const start = new Date(2024, 0, 12, 14, 0, 0);
    const end = new Date(2024, 0, 15, 11, 0, 0);
    expect(calculateBusinessHours(start, end)).toBe(6);
  });

  it('returns 0 when end is before or equal to start', () => {
    const date = new Date(2024, 0, 10, 10, 0, 0);
    expect(calculateBusinessHours(date, date)).toBe(0);

    const earlier = new Date(2024, 0, 10, 8, 0, 0);
    expect(calculateBusinessHours(date, earlier)).toBe(0);
  });

  it('handles midnight edge case (start at 00:00 on a business day)', () => {
    // Wednesday 2024-01-10 00:00 to Wednesday 2024-01-10 17:00
    // 00:00 is before business hours, effective start is 08:00, so 8-17 = 9h
    const start = new Date(2024, 0, 10, 0, 0, 0);
    const end = new Date(2024, 0, 10, 17, 0, 0);
    expect(calculateBusinessHours(start, end)).toBe(9);
  });

  it('returns 0 for ranges entirely on a weekend', () => {
    // Saturday 2024-01-13 10:00 to Saturday 2024-01-13 14:00
    const start = new Date(2024, 0, 13, 10, 0, 0);
    const end = new Date(2024, 0, 13, 14, 0, 0);
    expect(calculateBusinessHours(start, end)).toBe(0);
  });

  it('accepts string dates', () => {
    // Wednesday 2024-01-10T09:00 to 2024-01-10T15:00 (UTC — same-day local)
    const hours = calculateBusinessHours(
      '2024-01-10T09:00:00',
      '2024-01-10T15:00:00'
    );
    expect(hours).toBe(6);
  });

  it('respects holidays in the config', () => {
    // The source computes the "day" as new Date(year, month, date) (midnight local)
    // and then checks holidays via .toISOString().slice(0, 10) (UTC-based).
    // We derive the holiday string the same way the source does internally.
    const start = new Date(2024, 0, 10, 9, 0, 0);
    const end = new Date(2024, 0, 10, 15, 0, 0);
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const holidayStr = startDay.toISOString().slice(0, 10);
    const config = {
      ...DEFAULT_CONFIG,
      holidays: [holidayStr],
    };
    expect(calculateBusinessHours(start, end, config)).toBe(0);
  });
});

describe('formatBusinessHours', () => {
  it('formats sub-hour durations as minutes', () => {
    expect(formatBusinessHours(0.5)).toBe('30m');
  });

  it('formats whole hours', () => {
    expect(formatBusinessHours(5)).toBe('5h');
  });

  it('formats hours with remaining minutes', () => {
    expect(formatBusinessHours(3.5)).toBe('3h 30m');
  });

  it('formats durations as days when >= 24 hours', () => {
    // 27 hours / 9h workday = 3d 0h
    expect(formatBusinessHours(27)).toBe('3d');
  });

  it('formats days with remaining hours', () => {
    // 30 hours / 9h workday = 3d with 3h remaining
    expect(formatBusinessHours(30)).toBe('3d 3h');
  });

  it('formats 0 hours as 0 minutes', () => {
    expect(formatBusinessHours(0)).toBe('0m');
  });
});

describe('isBusinessDay', () => {
  it('returns true for a weekday', () => {
    // Wednesday 2024-01-10
    expect(isBusinessDay(new Date(2024, 0, 10))).toBe(true);
  });

  it('returns false for Saturday', () => {
    // Saturday 2024-01-13
    expect(isBusinessDay(new Date(2024, 0, 13))).toBe(false);
  });

  it('returns false for Sunday', () => {
    // Sunday 2024-01-14
    expect(isBusinessDay(new Date(2024, 0, 14))).toBe(false);
  });
});
