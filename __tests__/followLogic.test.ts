// __tests__/followLogic.test.ts
import { supabase } from '../lib/supabase';
import {
  followUser,
  unfollowUser,
  isFollowing,
  getFollowerCount,
  getFollowingCount,
} from '../logic/followLogic';

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
  },
}));

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

function makeChain(result: { data?: any; error?: any; count?: number | null } = {}) {
  const resolved = { data: null, error: null, count: null, ...result };
  const chain: any = {
    select:      jest.fn().mockReturnThis(),
    eq:          jest.fn().mockReturnThis(),
    insert:      jest.fn().mockReturnThis(),
    delete:      jest.fn().mockReturnThis(),
    update:      jest.fn().mockReturnThis(),
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

// ─── isFollowing ──────────────────────────────────────────────────────────────

describe('isFollowing', () => {
  test('returns false when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const result = await isFollowing('other-user');
    expect(result).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('returns false when maybeSingle returns null', async () => {
    mockQuery(); // maybeSingle defaults to { data: null, error: null }
    const result = await isFollowing('other-user');
    expect(result).toBe(false);
  });

  test('returns true when maybeSingle returns a row', async () => {
    const chain = mockQuery();
    chain.maybeSingle.mockResolvedValue({ data: { id: 'follow-1' }, error: null });
    const result = await isFollowing('other-user');
    expect(result).toBe(true);
  });
});

// ─── getFollowerCount ─────────────────────────────────────────────────────────

describe('getFollowerCount', () => {
  test('returns 0 when count is null', async () => {
    mockQuery({ count: null });
    expect(await getFollowerCount('user-abc')).toBe(0);
  });

  test('returns the count value when present', async () => {
    mockQuery({ count: 42 });
    expect(await getFollowerCount('user-abc')).toBe(42);
  });
});

// ─── getFollowingCount ────────────────────────────────────────────────────────

describe('getFollowingCount', () => {
  test('returns 0 when count is null', async () => {
    mockQuery({ count: null });
    expect(await getFollowingCount('user-abc')).toBe(0);
  });

  test('returns the count value when present', async () => {
    mockQuery({ count: 7 });
    expect(await getFollowingCount('user-abc')).toBe(7);
  });
});

// ─── followUser ───────────────────────────────────────────────────────────────

describe('followUser', () => {
  test('does nothing when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await followUser('target-user');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('calls insert with correct follower_id and following_id when authenticated', async () => {
    const chain = mockQuery({ data: null, error: null });
    await followUser('target-user');
    expect(mockFrom).toHaveBeenCalledWith('follows');
    expect(chain.insert).toHaveBeenCalledWith({
      follower_id:  'user-123',
      following_id: 'target-user',
    });
  });
});

// ─── unfollowUser ─────────────────────────────────────────────────────────────

describe('unfollowUser', () => {
  test('does nothing when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await unfollowUser('target-user');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('calls delete with correct eq filters when authenticated', async () => {
    const chain = mockQuery({ data: null, error: null });
    await unfollowUser('target-user');
    expect(mockFrom).toHaveBeenCalledWith('follows');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('follower_id', 'user-123');
    expect(chain.eq).toHaveBeenCalledWith('following_id', 'target-user');
  });
});
