// __tests__/healthLogLogic.test.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import {
  getRecentHealthLogCounts,
  getAllHealthLogs,
  addHealthEntry,
} from '../logic/healthLogLogic';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Provide a minimal mock of the supabase client. Each method on the query
// builder returns `this` so arbitrary call chains work without extra setup.
// The chain is made awaitable via a custom `then` method, which Jest's Promise
// handling will invoke when the test code does `await supabase.from(...)...`.
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
  },
}));

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

// Configures supabase.from() to return a chainable builder that resolves to
// `result` when awaited. `.single()` is handled separately because addHealthEntry
// awaits the result of .single() rather than the whole chain.
function mockQuery(result: { data: any; error: any }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    in:     jest.fn().mockReturnThis(),
    gte:    jest.fn().mockReturnThis(),
    order:  jest.fn().mockReturnThis(),
    limit:  jest.fn().mockReturnThis(),
    ilike:  jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
  };
  // Making the chain a thenable lets `await chain` resolve to `result` without
  // needing to know which method is the last in the specific call chain.
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(result).then(resolve, reject);
  mockFrom.mockReturnValue(chain);
  return chain;
}

beforeEach(async () => {
  // resetAllMocks wipes implementations (including mockReturnValue) so each
  // test starts clean. The authenticated default is re-applied right after.
  jest.resetAllMocks();
  await AsyncStorage.clear();
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'user-123' } } },
  });
});

// ─── getRecentHealthLogCounts ─────────────────────────────────────────────────

describe('getRecentHealthLogCounts', () => {
  test('returns {} immediately and does not call supabase when plantNames is empty', async () => {
    const result = await getRecentHealthLogCounts([]);
    expect(result).toEqual({});
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('returns {} and does not call supabase when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const result = await getRecentHealthLogCounts(['Monstera']);
    expect(result).toEqual({});
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('returns {} when supabase returns an error', async () => {
    mockQuery({ data: null, error: { message: 'DB error' } });
    const result = await getRecentHealthLogCounts(['Monstera']);
    expect(result).toEqual({});
  });

  test('counts entries correctly grouped by plant_name', async () => {
    mockQuery({
      data: [
        { plant_name: 'Monstera' },
        { plant_name: 'Monstera' },
        { plant_name: 'Pothos' },
      ],
      error: null,
    });
    const result = await getRecentHealthLogCounts(['Monstera', 'Pothos']);
    expect(result).toEqual({ Monstera: 2, Pothos: 1 });
  });

  test('a plant absent from the returned rows is not present in the result', async () => {
    // Supabase handles date and .in() filtering server-side; the function only
    // counts whatever rows come back. A plant with nothing returned has no key.
    mockQuery({ data: [{ plant_name: 'Monstera' }], error: null });
    const result = await getRecentHealthLogCounts(['Monstera', 'Pothos']);
    expect(result.Monstera).toBe(1);
    expect(result.Pothos).toBeUndefined();
  });

  test('counts multiple plants independently', async () => {
    mockQuery({
      data: [
        { plant_name: 'Fern' },
        { plant_name: 'Cactus' },
        { plant_name: 'Fern' },
        { plant_name: 'Cactus' },
        { plant_name: 'Cactus' },
      ],
      error: null,
    });
    const result = await getRecentHealthLogCounts(['Fern', 'Cactus']);
    expect(result).toEqual({ Fern: 2, Cactus: 3 });
  });
});

// ─── getAllHealthLogs ─────────────────────────────────────────────────────────

describe('getAllHealthLogs', () => {
  test('returns {} immediately and does not call supabase when plantNames is empty', async () => {
    const result = await getAllHealthLogs([]);
    expect(result).toEqual({});
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('returns {} and does not call supabase when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const result = await getAllHealthLogs(['Monstera']);
    expect(result).toEqual({});
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('returns {} when supabase returns an error', async () => {
    mockQuery({ data: null, error: { message: 'DB error' } });
    const result = await getAllHealthLogs(['Monstera']);
    expect(result).toEqual({});
  });

  test('groups entries by plant_name and preserves id, note, logged_at', async () => {
    mockQuery({
      data: [
        { plant_name: 'Monstera', id: 'h1', note: 'Looking healthy', logged_at: '2026-06-09T10:00:00Z' },
        { plant_name: 'Pothos',   id: 'h2', note: 'Yellowing',       logged_at: '2026-06-08T10:00:00Z' },
      ],
      error: null,
    });
    const result = await getAllHealthLogs(['Monstera', 'Pothos']);
    expect(result.Monstera).toEqual([
      { id: 'h1', note: 'Looking healthy', logged_at: '2026-06-09T10:00:00Z' },
    ]);
    expect(result.Pothos).toEqual([
      { id: 'h2', note: 'Yellowing', logged_at: '2026-06-08T10:00:00Z' },
    ]);
  });

  test('a plant with multiple entries has all of them in its array', async () => {
    mockQuery({
      data: [
        { plant_name: 'Monstera', id: 'h1', note: 'Note A', logged_at: '2026-06-09T10:00:00Z' },
        { plant_name: 'Monstera', id: 'h2', note: 'Note B', logged_at: '2026-06-08T10:00:00Z' },
        { plant_name: 'Monstera', id: 'h3', note: 'Note C', logged_at: '2026-06-07T10:00:00Z' },
      ],
      error: null,
    });
    const result = await getAllHealthLogs(['Monstera']);
    expect(result.Monstera).toHaveLength(3);
    expect(result.Monstera[0].id).toBe('h1');
    expect(result.Monstera[2].id).toBe('h3');
  });

  test('plants with no matching rows are absent from the result', async () => {
    mockQuery({ data: [], error: null });
    const result = await getAllHealthLogs(['Monstera', 'Pothos']);
    expect(result).toEqual({});
    expect(result.Monstera).toBeUndefined();
  });
});

// ─── addHealthEntry ───────────────────────────────────────────────────────────

describe('addHealthEntry', () => {
  test('returns null and does not call supabase when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const result = await addHealthEntry('Monstera', 'New leaf spotted');
    expect(result).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('returns null when supabase insert returns an error', async () => {
    mockQuery({ data: null, error: { message: 'Insert failed' } });
    const result = await addHealthEntry('Monstera', 'New leaf spotted');
    expect(result).toBeNull();
  });

  test('returns a correctly shaped HealthLogEntry on success', async () => {
    mockQuery({
      data: { id: 'new-id', note: 'Thriving', logged_at: '2026-06-09T12:00:00Z' },
      error: null,
    });
    const result = await addHealthEntry('Monstera', 'Thriving');
    expect(result).toEqual({
      id:        'new-id',
      note:      'Thriving',
      logged_at: '2026-06-09T12:00:00Z',
    });
  });
});
