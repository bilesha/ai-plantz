import {
  parseFrequencyToDays,
  projectWateringEvents,
  projectFertilizerEvents,
  getUnscheduledRecipes,
  groupEventsByDay,
  toDateKey,
  type CalendarEvent,
} from '../logic/calendarLogic';
import type { CollectionEntry } from '../types';
import type { FertilizerRecipe } from '../logic/fertilizerLogic';

// Fixed reference dates (local time, no DST edge cases in July)
const TODAY = new Date(2026, 6, 3); // Fri 3 Jul 2026
const WEEK_END = new Date(2026, 6, 9);
const MONTH_START = new Date(2026, 6, 1);
const MONTH_END = new Date(2026, 6, 31);

function makePlant(overrides: Partial<CollectionEntry> = {}): CollectionEntry {
  return {
    name: 'Monstera',
    summary: 'A plant',
    addedAt: Date.now(),
    status: 'own',
    ...overrides,
  };
}

function makeRecipe(overrides: Partial<FertilizerRecipe> = {}): FertilizerRecipe {
  return {
    id: 'r1',
    name: 'Summer feed',
    instructions: null,
    applies_to: null,
    application_method: null,
    frequency: 'weekly',
    notes: null,
    created_at: new Date(2026, 6, 1).toISOString(),
    products: [],
    ...overrides,
  };
}

// ─── parseFrequencyToDays ─────────────────────────────────────────────────────

describe('parseFrequencyToDays', () => {
  test.each([
    ['daily', 1],
    ['Every day', 1],
    ['weekly', 7],
    ['Weekly', 7],
    ['once a week', 7],
    ['every week', 7],
    ['twice a week', 3],
    ['fortnightly', 14],
    ['biweekly', 14],
    ['bi-weekly', 14],
    ['every other week', 14],
    ['monthly', 30],
    ['once a month', 30],
    ['every 2 weeks', 14],
    ['every 10 days', 10],
    ['every 3 months', 90],
    ['Every 2 weeks during summer', 14],
    ['10 days', 10],
    ['2 weeks', 14],
  ])('parses "%s" as %i days', (input, expected) => {
    expect(parseFrequencyToDays(input)).toBe(expected);
  });

  test.each([
    [null],
    [''],
    ['   '],
    ['when I remember'],
    ['sometimes'],
    ['every 0 days'],
  ])('returns null for %p', (input) => {
    expect(parseFrequencyToDays(input as string | null)).toBeNull();
  });
});

// ─── projectWateringEvents ────────────────────────────────────────────────────

describe('projectWateringEvents', () => {
  test('skips plants without a next watering date', () => {
    const events = projectWateringEvents([makePlant()], MONTH_START, MONTH_END, TODAY);
    expect(events).toEqual([]);
  });

  test('repeats future date by interval within the range', () => {
    const plant = makePlant({
      next_watering_date: new Date(2026, 6, 5).toISOString(),
      watering_interval_days: 7,
    });
    const events = projectWateringEvents([plant], MONTH_START, MONTH_END, TODAY);
    expect(events.map(e => e.date)).toEqual(['2026-07-05', '2026-07-12', '2026-07-19', '2026-07-26']);
    expect(events.every(e => !e.overdue)).toBe(true);
    expect(events[0].subtitle).toBe('Every 7 days');
  });

  test('emits a single event when no interval is set', () => {
    const plant = makePlant({ next_watering_date: new Date(2026, 6, 10).toISOString() });
    const events = projectWateringEvents([plant], MONTH_START, MONTH_END, TODAY);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ date: '2026-07-10', type: 'watering', title: 'Monstera', overdue: false, subtitle: null });
  });

  test('pins an overdue event to today when the date has passed', () => {
    const plant = makePlant({
      next_watering_date: new Date(2026, 5, 20).toISOString(), // 20 Jun, well past
      watering_interval_days: 7,
    });
    const events = projectWateringEvents([plant], MONTH_START, MONTH_END, TODAY);
    const overdue = events.filter(e => e.overdue);
    expect(overdue).toHaveLength(1);
    expect(overdue[0].date).toBe(toDateKey(TODAY));
    // future occurrences continue from the original schedule: 20 Jun + 7k → 4 Jul, 11 Jul...
    expect(events.filter(e => !e.overdue).map(e => e.date)).toEqual(
      ['2026-07-04', '2026-07-11', '2026-07-18', '2026-07-25'],
    );
  });

  test('does not duplicate when a projected occurrence lands on today with an overdue marker', () => {
    const plant = makePlant({
      next_watering_date: new Date(2026, 5, 26).toISOString(), // 26 Jun + 7 = 3 Jul (today)
      watering_interval_days: 7,
    });
    const events = projectWateringEvents([plant], MONTH_START, MONTH_END, TODAY);
    const todayEvents = events.filter(e => e.date === toDateKey(TODAY));
    expect(todayEvents).toHaveLength(1);
    expect(todayEvents[0].overdue).toBe(true);
  });

  test('excludes events outside the range', () => {
    const plant = makePlant({
      next_watering_date: new Date(2026, 7, 15).toISOString(), // 15 Aug
      watering_interval_days: 7,
    });
    const events = projectWateringEvents([plant], MONTH_START, MONTH_END, TODAY);
    expect(events).toEqual([]);
  });

  test('ignores unparseable dates', () => {
    const plant = makePlant({ next_watering_date: 'not-a-date' });
    const events = projectWateringEvents([plant], MONTH_START, MONTH_END, TODAY);
    expect(events).toEqual([]);
  });
});

// ─── projectFertilizerEvents ──────────────────────────────────────────────────

describe('projectFertilizerEvents', () => {
  test('projects weekly recipe from its creation date, skipping the past', () => {
    const recipe = makeRecipe(); // created 1 Jul, weekly
    const events = projectFertilizerEvents([recipe], MONTH_START, MONTH_END, TODAY);
    // 1 Jul is before today (3 Jul) → first occurrence 8 Jul
    expect(events.map(e => e.date)).toEqual(['2026-07-08', '2026-07-15', '2026-07-22', '2026-07-29']);
    expect(events.every(e => e.type === 'fertilizer' && !e.overdue)).toBe(true);
  });

  test('skips recipes without a parseable frequency', () => {
    const recipes = [
      makeRecipe({ frequency: null }),
      makeRecipe({ id: 'r2', frequency: 'whenever it looks sad' }),
    ];
    expect(projectFertilizerEvents(recipes, MONTH_START, MONTH_END, TODAY)).toEqual([]);
  });

  test('uses applies_to as subtitle, falling back to frequency text', () => {
    const withTarget = makeRecipe({ applies_to: 'Leafy tropicals' });
    const withoutTarget = makeRecipe({ id: 'r2', name: 'Cactus mix', applies_to: null });
    const events = projectFertilizerEvents([withTarget, withoutTarget], MONTH_START, MONTH_END, TODAY);
    expect(events.find(e => e.title === 'Summer feed')?.subtitle).toBe('Leafy tropicals');
    expect(events.find(e => e.title === 'Cactus mix')?.subtitle).toBe('weekly');
  });

  test('includes an occurrence landing exactly on today', () => {
    const recipe = makeRecipe({ created_at: new Date(2026, 5, 26).toISOString() }); // 26 Jun + 7 = 3 Jul
    const events = projectFertilizerEvents([recipe], WEEK_END > MONTH_END ? MONTH_START : MONTH_START, MONTH_END, TODAY);
    expect(events[0].date).toBe('2026-07-03');
  });
});

// ─── getUnscheduledRecipes ────────────────────────────────────────────────────

describe('getUnscheduledRecipes', () => {
  test('returns recipes with missing or unrecognizable frequency', () => {
    const recipes = [
      makeRecipe(),                                            // weekly → scheduled
      makeRecipe({ id: 'r2', frequency: null }),               // unscheduled
      makeRecipe({ id: 'r3', frequency: 'when soil is dry' }), // unscheduled
    ];
    expect(getUnscheduledRecipes(recipes).map(r => r.id)).toEqual(['r2', 'r3']);
  });
});

// ─── groupEventsByDay ─────────────────────────────────────────────────────────

describe('groupEventsByDay', () => {
  const make = (over: Partial<CalendarEvent>): CalendarEvent => ({
    date: '2026-07-03', type: 'watering', title: 'A', subtitle: null, overdue: false, ...over,
  });

  test('groups by date key', () => {
    const grouped = groupEventsByDay([
      make({ date: '2026-07-03' }),
      make({ date: '2026-07-04' }),
      make({ date: '2026-07-03', title: 'B' }),
    ]);
    expect(Object.keys(grouped).sort()).toEqual(['2026-07-03', '2026-07-04']);
    expect(grouped['2026-07-03']).toHaveLength(2);
  });

  test('sorts overdue first, then watering before fertilizer, then alphabetical', () => {
    const grouped = groupEventsByDay([
      make({ type: 'fertilizer', title: 'Zebra feed' }),
      make({ title: 'Cactus' }),
      make({ type: 'fertilizer', title: 'Algae mix' }),
      make({ title: 'Aloe', overdue: true }),
    ]);
    expect(grouped['2026-07-03'].map(e => e.title)).toEqual(['Aloe', 'Cactus', 'Algae mix', 'Zebra feed']);
  });
});
