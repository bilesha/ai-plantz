// __tests__/profileLogic.test.ts
jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: { Base64: 'base64' },
}));

jest.mock('base64-arraybuffer', () => ({
  decode: jest.fn(() => new ArrayBuffer(0)),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
    storage: {
      from: jest.fn(),
    },
  },
}));

import { supabase } from '../lib/supabase';
import { updateBio, getProfileStats } from '../logic/profileLogic';

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

function makeChain(result: { data?: any; error?: any; count?: number | null } = {}) {
  const resolved = { data: null, error: null, count: null, ...result };
  const chain: any = {
    select:      jest.fn().mockReturnThis(),
    eq:          jest.fn().mockReturnThis(),
    in:          jest.fn().mockReturnThis(),
    update:      jest.fn().mockReturnThis(),
    insert:      jest.fn().mockReturnThis(),
    single:      jest.fn().mockResolvedValue(resolved),
    maybeSingle: jest.fn().mockResolvedValue(resolved),
  };
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(resolved).then(resolve, reject);
  return chain;
}

function mockQuery(result: Parameters<typeof makeChain>[0] = {}) {
  const chain = makeChain(result);
  mockFrom.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  jest.resetAllMocks();
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'user-123' } } },
  });
});

// ─── updateBio ────────────────────────────────────────────────────────────────

describe('updateBio', () => {
  test("throws 'Not authenticated' when unauthenticated", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await expect(updateBio('my bio')).rejects.toThrow('Not authenticated');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('throws with Supabase error message when update fails', async () => {
    mockQuery({ error: { message: 'DB error' }, data: null });
    await expect(updateBio('my bio')).rejects.toThrow('Bio update failed: DB error');
  });

  test('resolves without error on success', async () => {
    mockQuery({ error: null, data: null });
    await expect(updateBio('my bio')).resolves.toBeUndefined();
  });
});

// ─── getProfileStats ──────────────────────────────────────────────────────────

describe('getProfileStats', () => {
  test('returns all zeros when all counts are null', async () => {
    mockFrom.mockReturnValue(makeChain({ count: null }));

    const result = await getProfileStats('user-abc');
    expect(result).toEqual({
      followerCount:  0,
      followingCount: 0,
      plantCount:     0,
      likesReceived:  0,
    });
  });

  test('returns correctly mapped counts from all four parallel queries', async () => {
    // Promise.all fires them in order: followerCount, followingCount, plantCount, likesReceived
    mockFrom
      .mockReturnValueOnce(makeChain({ count: 10 }))  // follows → followerCount
      .mockReturnValueOnce(makeChain({ count: 5 }))   // follows → followingCount
      .mockReturnValueOnce(makeChain({ count: 3 }))   // plant_collection → plantCount
      .mockReturnValueOnce(makeChain({ count: 20 })); // plant_likes → likesReceived

    const result = await getProfileStats('user-abc');
    expect(result).toEqual({
      followerCount:  10,
      followingCount: 5,
      plantCount:     3,
      likesReceived:  20,
    });
  });

  test('handles mixed nulls (some counts present, some null)', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain({ count: 8 }))    // followerCount
      .mockReturnValueOnce(makeChain({ count: null })) // followingCount → 0
      .mockReturnValueOnce(makeChain({ count: 4 }))    // plantCount
      .mockReturnValueOnce(makeChain({ count: null })); // likesReceived → 0

    const result = await getProfileStats('user-abc');
    expect(result).toEqual({
      followerCount:  8,
      followingCount: 0,
      plantCount:     4,
      likesReceived:  0,
    });
  });
});
