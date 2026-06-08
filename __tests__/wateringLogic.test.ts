// __tests__/wateringLogic.test.ts

// babel-preset-expo rewrites `process.env.EXPO_PUBLIC_*` into an import from
// this virtual ESM module. Mocking it prevents the real ESM file from loading
// in Jest's CommonJS environment. The factory returns process.env directly so
// that setting/deleting process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY before each
// jest.isolateModules call is reflected when wateringLogic reads the key on load.
jest.mock('expo/virtual/env', () => ({ env: process.env }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import {
  formatRelativeDate,
  getWateringLog,
  getWateringInterval,
  logWatering,
  WateringEntry,
} from '../logic/wateringLogic';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
  },
}));

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

function mockQuery(result: { data: any; error: any }) {
  const chain: any = {
    select:      jest.fn().mockReturnThis(),
    eq:          jest.fn().mockReturnThis(),
    in:          jest.fn().mockReturnThis(),
    gte:         jest.fn().mockReturnThis(),
    order:       jest.fn().mockReturnThis(),
    limit:       jest.fn().mockReturnThis(),
    ilike:       jest.fn().mockReturnThis(),
    insert:      jest.fn().mockReturnThis(),
    update:      jest.fn().mockReturnThis(),
    delete:      jest.fn().mockReturnThis(),
    single:      jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(result).then(resolve, reject);
  mockFrom.mockReturnValue(chain);
  return chain;
}

let mockFetch: jest.Mock;

beforeEach(async () => {
  jest.resetAllMocks();
  await AsyncStorage.clear();
  process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY = 'test-key';
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'user-123' } } },
  });
});

// ─── formatRelativeDate ───────────────────────────────────────────────────────

describe('formatRelativeDate', () => {
  const FIXED_NOW = new Date('2026-06-08T12:00:00.000Z').getTime();

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const daysAgo = (n: number) => FIXED_NOW - n * 24 * 60 * 60 * 1000;

  test('0 days ago → Today', () => {
    expect(formatRelativeDate(daysAgo(0))).toBe('Today');
  });

  test('1 day ago → Yesterday', () => {
    expect(formatRelativeDate(daysAgo(1))).toBe('Yesterday');
  });

  test('3 days ago → 3 days ago', () => {
    expect(formatRelativeDate(daysAgo(3))).toBe('3 days ago');
  });

  test('6 days ago → 6 days ago', () => {
    expect(formatRelativeDate(daysAgo(6))).toBe('6 days ago');
  });

  test('7 days ago → 1 week ago', () => {
    expect(formatRelativeDate(daysAgo(7))).toBe('1 week ago');
  });

  test('10 days ago → 1 week ago', () => {
    expect(formatRelativeDate(daysAgo(10))).toBe('1 week ago');
  });

  test('14 days ago → 2 weeks ago', () => {
    expect(formatRelativeDate(daysAgo(14))).toBe('2 weeks ago');
  });

  test('30 days ago → 1 month ago', () => {
    expect(formatRelativeDate(daysAgo(30))).toBe('1 month ago');
  });

  test('60 days ago → 2 months ago', () => {
    expect(formatRelativeDate(daysAgo(60))).toBe('2 months ago');
  });
});

// ─── getWateringLog ───────────────────────────────────────────────────────────

describe('getWateringLog', () => {
  test('returns local log when unauthenticated and entry exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const stored: WateringEntry[] = [
      { id: 'local-1', watered_at: '2026-06-01T10:00:00.000Z', amount_ml: 200, notes: 'Test' },
    ];
    // jest.resetAllMocks() wipes the AsyncStorage mock implementations, so wire up
    // getItem directly rather than relying on the mock store.
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(stored));

    const result = await getWateringLog('Monstera');
    expect(result).toEqual(stored);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('returns [] from local log when unauthenticated and nothing stored', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const result = await getWateringLog('Monstera');
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('returns mapped entries from Supabase when authenticated', async () => {
    mockQuery({
      data: [
        { id: 'db-1', watered_at: '2026-06-01T10:00:00.000Z', amount_ml: 200, notes: 'Good' },
        { id: 'db-2', watered_at: '2026-05-01T10:00:00.000Z', amount_ml: null, notes: null },
      ],
      error: null,
    });

    const result = await getWateringLog('Monstera');
    expect(result).toEqual([
      { id: 'db-1', watered_at: '2026-06-01T10:00:00.000Z', amount_ml: 200, notes: 'Good' },
      { id: 'db-2', watered_at: '2026-05-01T10:00:00.000Z', amount_ml: undefined, notes: undefined },
    ]);
  });

  test('falls back to local log on Supabase error', async () => {
    mockQuery({ data: null, error: { message: 'DB error' } });
    const stored: WateringEntry[] = [
      { id: 'local-1', watered_at: '2026-06-01T10:00:00.000Z' },
    ];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(stored));

    const result = await getWateringLog('Monstera');
    expect(result).toEqual(stored);
  });

  test('maps amount_ml and notes correctly (null → undefined)', async () => {
    mockQuery({
      data: [
        { id: 'db-1', watered_at: '2026-06-01T10:00:00.000Z', amount_ml: 300, notes: 'Rich watering' },
        { id: 'db-2', watered_at: '2026-05-01T10:00:00.000Z', amount_ml: null, notes: null },
      ],
      error: null,
    });

    const result = await getWateringLog('Monstera');
    expect(result[0].amount_ml).toBe(300);
    expect(result[0].notes).toBe('Rich watering');
    expect(result[1].amount_ml).toBeUndefined();
    expect(result[1].notes).toBeUndefined();
  });
});

// ─── logWatering ─────────────────────────────────────────────────────────────

describe('logWatering', () => {
  test('unauthenticated: creates a local entry, saves it, returns the entry', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    // getItem returns null → empty existing log; setItem will receive the new entry.
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const result = await logWatering('Monstera', 150, 'Morning', '2026-06-08T08:00:00.000Z');

    expect(result).not.toBeNull();
    expect(result!.watered_at).toBe('2026-06-08T08:00:00.000Z');
    expect(result!.amount_ml).toBe(150);
    expect(result!.notes).toBe('Morning');

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'wateringLog_Monstera',
      expect.stringContaining('2026-06-08T08:00:00.000Z'),
    );
  });

  test('authenticated: returns null on Supabase error', async () => {
    mockQuery({ data: null, error: { message: 'Insert failed' } });

    const result = await logWatering('Monstera');
    expect(result).toBeNull();
  });

  test('authenticated: returns correctly shaped WateringEntry on success', async () => {
    mockQuery({
      data: { id: 'db-1', watered_at: '2026-06-08T08:00:00.000Z', amount_ml: 150, notes: 'Test' },
      error: null,
    });

    const result = await logWatering('Monstera', 150, 'Test', '2026-06-08T08:00:00.000Z');

    expect(result).toEqual({
      id: 'db-1',
      watered_at: '2026-06-08T08:00:00.000Z',
      amount_ml: 150,
      notes: 'Test',
    });
  });

  test('optional fields (amountMl, notes) are undefined when not provided', async () => {
    mockQuery({
      data: { id: 'db-2', watered_at: '2026-06-08T08:00:00.000Z', amount_ml: null, notes: null },
      error: null,
    });

    const result = await logWatering('Monstera', undefined, undefined, '2026-06-08T08:00:00.000Z');

    expect(result!.amount_ml).toBeUndefined();
    expect(result!.notes).toBeUndefined();
  });
});

// ─── getWateringInterval ──────────────────────────────────────────────────────

describe('getWateringInterval', () => {
  test('returns nulls when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const result = await getWateringInterval('Monstera');
    expect(result).toEqual({ intervalDays: null, nextWateringDate: null });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('returns nulls on Supabase error', async () => {
    const chain = mockQuery({ data: null, error: null });
    chain.maybeSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    const result = await getWateringInterval('Monstera');
    expect(result).toEqual({ intervalDays: null, nextWateringDate: null });
  });

  test('returns correctly mapped interval and date on success', async () => {
    const chain = mockQuery({ data: null, error: null });
    chain.maybeSingle.mockResolvedValue({
      data: { watering_interval_days: 7, next_watering_date: '2026-06-15T00:00:00.000Z' },
      error: null,
    });

    const result = await getWateringInterval('Monstera');
    expect(result).toEqual({
      intervalDays: 7,
      nextWateringDate: '2026-06-15T00:00:00.000Z',
    });
  });

  test('returns nulls when DB columns are null', async () => {
    const chain = mockQuery({ data: null, error: null });
    chain.maybeSingle.mockResolvedValue({
      data: { watering_interval_days: null, next_watering_date: null },
      error: null,
    });

    const result = await getWateringInterval('Monstera');
    expect(result).toEqual({ intervalDays: null, nextWateringDate: null });
  });
});

// ─── suggestWateringInterval ──────────────────────────────────────────────────

describe('suggestWateringInterval', () => {
  // ANTHROPIC_API_KEY is captured at module load time, so each test re-requires
  // wateringLogic in an isolated registry after setting the env var.
  function loadSuggest(apiKey?: string): (plantName: string) => Promise<number> {
    if (apiKey !== undefined) {
      process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY = apiKey;
    } else {
      delete process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
    }
    let fn: (plantName: string) => Promise<number>;
    jest.isolateModules(() => {
      fn = require('../logic/wateringLogic').suggestWateringInterval;
    });
    return fn!;
  }

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  test('returns 7 when ANTHROPIC_API_KEY is not set', async () => {
    const suggest = loadSuggest(undefined);
    expect(await suggest('Monstera')).toBe(7);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('returns 7 when fetch throws', async () => {
    const suggest = loadSuggest('test-key');
    mockFetch.mockRejectedValue(new Error('Network error'));
    expect(await suggest('Monstera')).toBe(7);
  });

  test('returns 7 when response is not ok', async () => {
    const suggest = loadSuggest('test-key');
    mockFetch.mockResolvedValue({ ok: false });
    expect(await suggest('Monstera')).toBe(7);
  });

  test('returns 7 when response text is not a valid integer', async () => {
    const suggest = loadSuggest('test-key');
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ content: [{ text: 'not a number' }] }),
    });
    expect(await suggest('Monstera')).toBe(7);
  });

  test('returns parsed integer on success', async () => {
    const suggest = loadSuggest('test-key');
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ content: [{ text: '10' }] }),
    });
    expect(await suggest('Monstera')).toBe(10);
  });
});
