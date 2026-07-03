import type { CollectionEntry } from '../types';
import type { FertilizerRecipe } from './fertilizerLogic';

export type CalendarEventType = 'watering' | 'fertilizer';

export type CalendarEvent = {
  date: string;              // 'YYYY-MM-DD' in local time
  type: CalendarEventType;
  title: string;             // plant name or recipe name
  subtitle: string | null;   // e.g. "Every 7 days" or the recipe's applies_to
  overdue: boolean;
};

// ─── Date helpers (all local-time, midnight-normalized) ───────────────────────

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// Whole days from `a` to `b` (positive when b is later). Rounded so DST shifts
// (23h/25h days) don't truncate to the wrong day count.
function dayDiff(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// ─── Frequency parsing ─────────────────────────────────────────────────────────

// Recipe `frequency` is free text typed by the user. Recognize the common
// phrasings and turn them into an interval in days; return null when the text
// doesn't describe a recognizable schedule.
export function parseFrequencyToDays(frequency: string | null): number | null {
  if (!frequency) return null;
  const f = frequency.trim().toLowerCase();
  if (!f) return null;

  if (/\b(daily|every day)\b/.test(f)) return 1;
  if (/\btwice a week\b/.test(f)) return 3;
  if (/\b(fortnightly|bi-?weekly|every other week|every second week)\b/.test(f)) return 14;
  if (/\b(weekly|once a week|every week)\b/.test(f)) return 7;
  if (/\b(monthly|once a month|every month)\b/.test(f)) return 30;

  const every = f.match(/every\s+(\d+)\s*(day|week|month)s?\b/);
  const bare = every ?? f.match(/^(\d+)\s*(day|week|month)s?$/);
  if (bare) {
    const n = parseInt(bare[1], 10);
    if (n > 0) return n * (bare[2] === 'day' ? 1 : bare[2] === 'week' ? 7 : 30);
  }

  return null;
}

// ─── Event projection ──────────────────────────────────────────────────────────

// Watering events come from plant_collection: `next_watering_date` is the
// anchor and `watering_interval_days` repeats it. Occurrences that are already
// in the past collapse into one "overdue" event pinned to today.
export function projectWateringEvents(
  collection: CollectionEntry[],
  rangeStart: Date,
  rangeEnd: Date,
  today: Date,
): CalendarEvent[] {
  const start = atMidnight(rangeStart);
  const end = atMidnight(rangeEnd);
  const t0 = atMidnight(today);
  const events: CalendarEvent[] = [];

  for (const plant of collection) {
    if (!plant.next_watering_date) continue;
    const parsed = new Date(plant.next_watering_date);
    if (isNaN(parsed.getTime())) continue;
    const base = atMidnight(parsed);

    const interval =
      plant.watering_interval_days && plant.watering_interval_days > 0
        ? plant.watering_interval_days
        : null;
    const subtitle = interval ? `Every ${interval} day${interval === 1 ? '' : 's'}` : null;

    const isOverdue = base < t0;
    if (isOverdue && t0 >= start && t0 <= end) {
      events.push({ date: toDateKey(t0), type: 'watering', title: plant.name, subtitle, overdue: true });
    }

    if (interval) {
      // First occurrence on/after today (the overdue marker covers everything earlier).
      let d = base;
      if (d < t0) {
        const steps = Math.ceil(dayDiff(d, t0) / interval);
        d = addDays(base, steps * interval);
      }
      for (; d <= end; d = addDays(d, interval)) {
        if (d < start) continue;
        if (isOverdue && d.getTime() === t0.getTime()) continue; // overdue marker already pinned there
        events.push({ date: toDateKey(d), type: 'watering', title: plant.name, subtitle, overdue: false });
      }
    } else if (!isOverdue && base >= start && base <= end) {
      events.push({ date: toDateKey(base), type: 'watering', title: plant.name, subtitle, overdue: false });
    }
  }

  return events;
}

// Fertilizer events come from recipes: the parsed `frequency` repeats from the
// recipe's creation date. Frequencies are guidance rather than a strict due
// date, so past occurrences are simply dropped — never marked overdue.
export function projectFertilizerEvents(
  recipes: FertilizerRecipe[],
  rangeStart: Date,
  rangeEnd: Date,
  today: Date,
): CalendarEvent[] {
  const start = atMidnight(rangeStart);
  const end = atMidnight(rangeEnd);
  const t0 = atMidnight(today);
  const first = t0 > start ? t0 : start;
  const events: CalendarEvent[] = [];

  for (const recipe of recipes) {
    const interval = parseFrequencyToDays(recipe.frequency);
    if (!interval) continue;
    const parsed = new Date(recipe.created_at);
    if (isNaN(parsed.getTime())) continue;
    const anchor = atMidnight(parsed);

    let d = anchor;
    if (d < first) {
      const steps = Math.ceil(dayDiff(d, first) / interval);
      d = addDays(anchor, steps * interval);
    }
    for (; d <= end; d = addDays(d, interval)) {
      events.push({
        date: toDateKey(d),
        type: 'fertilizer',
        title: recipe.name,
        subtitle: recipe.applies_to ?? recipe.frequency,
        overdue: false,
      });
    }
  }

  return events;
}

// Recipes that can't be placed on the calendar (no frequency, or free text the
// parser doesn't recognize). The screen lists these so they aren't silently lost.
export function getUnscheduledRecipes(recipes: FertilizerRecipe[]): FertilizerRecipe[] {
  return recipes.filter(r => parseFrequencyToDays(r.frequency) === null);
}

// ─── Grouping ──────────────────────────────────────────────────────────────────

// Groups events by date key; within a day: overdue first, then watering before
// fertilizer, then alphabetical.
export function groupEventsByDay(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  const byDay: Record<string, CalendarEvent[]> = {};
  for (const event of events) {
    (byDay[event.date] ??= []).push(event);
  }
  for (const key of Object.keys(byDay)) {
    byDay[key].sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      if (a.type !== b.type) return a.type === 'watering' ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
  }
  return byDay;
}
