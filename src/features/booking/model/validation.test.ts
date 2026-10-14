import { describe, expect, it } from 'vitest';
import { toLocalIsoDate } from './localDate';
import { validateAttendeeStep, validateEventStep, validateSeatStep } from './validation';

const TODAY = '2026-10-14';

describe('validateEventStep', () => {
  it('rejects a past date', () => {
    expect(validateEventStep({ eventId: 'jazz-night', date: '2026-10-13' }, TODAY)).toEqual([
      { field: 'date', message: 'Choose today or a future date.' },
    ]);
  });

  it('accepts today and future dates', () => {
    expect(validateEventStep({ eventId: 'jazz-night', date: TODAY }, TODAY)).toEqual([]);
    expect(validateEventStep({ eventId: 'jazz-night', date: '2027-01-01' }, TODAY)).toEqual([]);
  });

  it('requires an event and a real calendar date', () => {
    expect(validateEventStep({ eventId: null, date: '2026-02-31' }, TODAY)).toEqual([
      { field: 'event', message: 'Choose an event.' },
      { field: 'date', message: 'Enter a valid date.' },
    ]);
  });
});

describe('validateSeatStep', () => {
  it('rejects an empty selection', () => {
    expect(validateSeatStep([])).toEqual([{ field: 'seats', message: 'Choose at least 1 seat.' }]);
  });

  it('accepts 1 to 6 seats', () => {
    expect(validateSeatStep(['A1'])).toEqual([]);
    expect(validateSeatStep(['A1', 'A2', 'A3', 'A6', 'A7', 'A8'])).toEqual([]);
  });
});

describe('validateAttendeeStep', () => {
  it('rejects blank and whitespace-only names, per seat', () => {
    expect(validateAttendeeStep(['A1', 'A2', 'C3'], { A1: 'Asha', A2: '   ', C3: '' })).toEqual([
      { field: 'attendee-A2', message: 'Enter the attendee name for seat A2.' },
      { field: 'attendee-C3', message: 'Enter the attendee name for seat C3.' },
    ]);
  });
});

describe('toLocalIsoDate', () => {
  it('uses the local calendar day, not the UTC one', () => {
    // 00:30 local time: toISOString() would report the previous day in any UTC+ zone.
    expect(toLocalIsoDate(new Date(2026, 9, 14, 0, 30))).toBe('2026-10-14');
  });
});
