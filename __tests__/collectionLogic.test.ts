// __tests__/collectionLogic.test.ts

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: { Base64: 'base64' },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import {
  getCollectionStats,
  getCollectionEntry,
  getPublicCollection,
} from '../logic/collectionLogic';

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

// Creates a chainable mock query builder that resolves to `result` when awaited.
// Covers both the thenable path (most queries) and the explicit `.maybeSingle()`
// / `.single()` path used by getCollectionEntry and addToCollection.
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
    upsert:      jest.fn().mockReturnThis(),
    update:      jest.fn().mockReturnThis(),
    single:      jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(result).then(resolve, reject);
  mockFrom.mockReturnValue(chain);
  return chain;
}

// A minimal DB row that covers all CollectionRow fields, used as a fixture.
const MONSTERA_ROW = {
  plant_name:             'Monstera',
  summary:                'Easy to care for.',
  details:                null,
  added_at:               '2026-06-01T00:00:00Z',
  status:                 'own',
  rating:                 4,
  notes:                  'My favourite',
  photo_url:              null,
  watering_interval_days: null,
  next_watering_date:     null,
};

const POTHOS_ROW = {
  plant_name:             'Pothos',
  summary:                'Very forgiving.',
  details:                null,
  added_at:               '2026-05-15T00:00:00Z',
  status:                 'want',
  rating:                 null,
  notes:                  null,
  photo_url:              null,
  watering_interval_days: null,
  next_watering_date:     null,
};

beforeEach(async () => {
  jest.resetAllMocks();
  await AsyncStorage.clear();
  // Default: authenticated as user-123. getCollectionStats and getPublicCollection
  // don't call getUserId(), but getCollectionEntry does, so we set the default here.
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'user-123' } } },
  });
});

// ─── getCollectionStats ───────────────────────────────────────────────────────

describe('getCollectionStats', () => {
  test('returns all-zero counts when supabase returns an error', async () => {
    mockQuery({ data: null, error: { message: 'DB error' } });
    const result = await getCollectionStats('user-123');
    expect(result).toEqual({ own: 0, want: 0, tried: 0 });
  });

  test('returns all-zero counts when data is null', async () => {
    mockQuery({ data: null, error: null });
    const result = await getCollectionStats('user-123');
    expect(result).toEqual({ own: 0, want: 0, tried: 0 });
  });

  test('counts own, want, and tried correctly', async () => {
    mockQuery({
      data: [
        { status: 'own' }, { status: 'own' },
        { status: 'want' },
        { status: 'tried' }, { status: 'tried' }, { status: 'tried' },
      ],
      error: null,
    });
    const result = await getCollectionStats('user-123');
    expect(result).toEqual({ own: 2, want: 1, tried: 3 });
  });

  test('ignores unrecognised status values without incrementing any counter', async () => {
    mockQuery({
      data: [{ status: 'own' }, { status: 'unknown' }, { status: 'archived' }],
      error: null,
    });
    const result = await getCollectionStats('user-123');
    expect(result).toEqual({ own: 1, want: 0, tried: 0 });
  });

  test('works with a single-status collection — all own, none of the others', async () => {
    mockQuery({
      data: [{ status: 'own' }, { status: 'own' }, { status: 'own' }],
      error: null,
    });
    const result = await getCollectionStats('user-123');
    expect(result).toEqual({ own: 3, want: 0, tried: 0 });
  });

  test('returns all-zero counts for an empty row array', async () => {
    mockQuery({ data: [], error: null });
    const result = await getCollectionStats('user-123');
    expect(result).toEqual({ own: 0, want: 0, tried: 0 });
  });
});

// ─── getCollectionEntry ───────────────────────────────────────────────────────

describe('getCollectionEntry', () => {
  test('returns null when supabase returns an error', async () => {
    mockQuery({ data: null, error: { message: 'DB error' } });
    const result = await getCollectionEntry('Monstera');
    expect(result).toBeNull();
  });

  test('returns null when maybeSingle finds no matching row', async () => {
    mockQuery({ data: null, error: null });
    const result = await getCollectionEntry('Monstera');
    expect(result).toBeNull();
  });

  test('returns a correctly shaped CollectionEntry on success', async () => {
    mockQuery({ data: MONSTERA_ROW, error: null });
    const result = await getCollectionEntry('Monstera');

    expect(result).not.toBeNull();
    expect(result!.name).toBe('Monstera');
    expect(result!.status).toBe('own');
    expect(result!.rating).toBe(4);
    expect(result!.notes).toBe('My favourite');
    // DB null columns become undefined in the mapped entry
    expect(result!.details).toBeUndefined();
    expect(result!.photo_url).toBeUndefined();
    // added_at ISO string is converted to a Unix timestamp
    expect(result!.addedAt).toBe(new Date('2026-06-01T00:00:00Z').getTime());
  });
});

// ─── getPublicCollection ──────────────────────────────────────────────────────

describe('getPublicCollection', () => {
  test('returns [] when supabase returns an error', async () => {
    mockQuery({ data: null, error: { message: 'DB error' } });
    const result = await getPublicCollection('user-123');
    expect(result).toEqual([]);
  });

  test('returns [] when data is null', async () => {
    mockQuery({ data: null, error: null });
    const result = await getPublicCollection('user-123');
    expect(result).toEqual([]);
  });

  test('maps multiple rows to CollectionEntry[] with correct field names and values', async () => {
    mockQuery({ data: [MONSTERA_ROW, POTHOS_ROW], error: null });
    const result = await getPublicCollection('user-123');

    expect(result).toHaveLength(2);
    // plant_name → name
    expect(result[0].name).toBe('Monstera');
    expect(result[1].name).toBe('Pothos');
    // status preserved
    expect(result[0].status).toBe('own');
    expect(result[1].status).toBe('want');
    // null rating becomes undefined
    expect(result[1].rating).toBeUndefined();
  });
});
