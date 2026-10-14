import { describe, expect, it } from 'vitest';
import { isStoredDraft, restoreDraft } from './draftPersistence';
import type { StoredDraft } from './draftPersistence';

const TODAY = '2026-10-14';

const storedDraft: StoredDraft = {
  step: 'attendees',
  eventId: 'jazz-night',
  date: '2026-10-20',
  seatIds: ['C3', 'A1'],
  attendees: { A1: 'Asha', C3: 'Chen' },
};

describe('isStoredDraft', () => {
  it('accepts a structurally valid draft', () => {
    expect(isStoredDraft(storedDraft)).toBe(true);
  });

  it('rejects malformed data', () => {
    expect(isStoredDraft(null)).toBe(false);
    expect(isStoredDraft({ ...storedDraft, seatIds: 'A1' })).toBe(false);
    expect(isStoredDraft({ ...storedDraft, attendees: { A1: 42 } })).toBe(false);
  });
});

describe('restoreDraft', () => {
  it('restores a valid draft, with seats in layout order', () => {
    expect(restoreDraft(storedDraft, TODAY)).toEqual({ ...storedDraft, seatIds: ['A1', 'C3'] });
  });

  it('drops booked and unknown seats together with their attendees', () => {
    const restored = restoreDraft(
      { ...storedDraft, seatIds: ['A1', 'A4', 'Z9'], attendees: { A1: 'Asha', A4: 'Booked' } },
      TODAY,
    );

    expect(restored.seatIds).toEqual(['A1']);
    expect(restored.attendees).toEqual({ A1: 'Asha' });
  });

  it('sends the user back to the first step that is no longer valid', () => {
    expect(restoreDraft({ ...storedDraft, date: '2026-10-01' }, TODAY).step).toBe('event');
    expect(restoreDraft({ ...storedDraft, eventId: 'retired-event' }, TODAY)).toMatchObject({
      eventId: null,
      step: 'event',
    });
  });
});
