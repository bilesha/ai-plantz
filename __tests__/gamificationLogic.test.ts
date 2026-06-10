// __tests__/gamificationLogic.test.ts

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
  },
}));

import { supabase } from '../lib/supabase';
import {
  recordActivity,
  checkAndAwardBadges,
  getStreakData,
  getBadges,
  updateLeaderboard,
} from '../logic/gamificationLogic';

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

// Chainable query builder that resolves to `result` when awaited.
// `upsert` is included because gamificationLogic uses it for badges and leaderboard.
function makeChain(result: { data?: any; error?: any; count?: number | null } = {}) {
  const resolved = { data: null, error: null, count: null, ...result };
  const chain: any = {
    select:      jest.fn().mockReturnThis(),
    eq:          jest.fn().mockReturnThis(),
    ilike:       jest.fn().mockReturnThis(),
    order:       jest.fn().mockReturnThis(),
    limit:       jest.fn().mockReturnThis(),
    insert:      jest.fn().mockReturnThis(),
    update:      jest.fn().mockReturnThis(),
    upsert:      jest.fn().mockReturnThis(),
    delete:      jest.fn().mockReturnThis(),
    single:      jest.fn().mockResolvedValue(resolved),
    maybeSingle: jest.fn().mockResolvedValue(resolved),
  };
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(resolved).then(resolve, reject);
  return chain;
}

// Fixed date: 2026-06-10 (Tuesday). Yesterday = 2026-06-09.
const FIXED_NOW = new Date('2026-06-10T12:00:00.000Z');
const TODAY     = '2026-06-10';
const YESTERDAY = '2026-06-09';

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.resetAllMocks();
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'user-123' } } },
  });
});

// ─── recordActivity ───────────────────────────────────────────────────────────

describe('recordActivity', () => {
  test('first ever activity: inserts row with streak 1 and longest_streak 1', async () => {
    const selectChain = makeChain(); // maybeSingle → { data: null } → no existing row
    const insertChain = makeChain();
    mockFrom
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(insertChain);

    await recordActivity();

    expect(insertChain.insert).toHaveBeenCalledWith({
      user_id:            'user-123',
      current_streak:     1,
      longest_streak:     1,
      last_activity_date: TODAY,
    });
    expect(insertChain.update).not.toHaveBeenCalled();
  });

  test('activity yesterday: increments streak and updates longest_streak if exceeded', async () => {
    const selectChain = makeChain();
    selectChain.maybeSingle.mockResolvedValue({
      data: { user_id: 'user-123', current_streak: 3, longest_streak: 3, last_activity_date: YESTERDAY },
      error: null,
    });
    const updateChain = makeChain();
    mockFrom
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain);

    await recordActivity();

    expect(updateChain.update).toHaveBeenCalledWith({
      current_streak:     4,
      longest_streak:     4,  // 4 > previous longest 3
      last_activity_date: TODAY,
    });
  });

  test('activity yesterday: does not exceed longest_streak when it was already higher', async () => {
    const selectChain = makeChain();
    selectChain.maybeSingle.mockResolvedValue({
      data: { user_id: 'user-123', current_streak: 3, longest_streak: 10, last_activity_date: YESTERDAY },
      error: null,
    });
    const updateChain = makeChain();
    mockFrom
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain);

    await recordActivity();

    expect(updateChain.update).toHaveBeenCalledWith({
      current_streak:     4,
      longest_streak:     10,  // unchanged — 4 < 10
      last_activity_date: TODAY,
    });
  });

  test('activity today: no-op — does not call update', async () => {
    const selectChain = makeChain();
    selectChain.maybeSingle.mockResolvedValue({
      data: { user_id: 'user-123', current_streak: 2, longest_streak: 5, last_activity_date: TODAY },
      error: null,
    });
    mockFrom.mockReturnValueOnce(selectChain);

    await recordActivity();

    // Only one from() call (the select). No update/insert.
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  test('gap of 2+ days: resets streak to 1', async () => {
    const selectChain = makeChain();
    selectChain.maybeSingle.mockResolvedValue({
      data: { user_id: 'user-123', current_streak: 8, longest_streak: 12, last_activity_date: '2026-06-01' },
      error: null,
    });
    const updateChain = makeChain();
    mockFrom
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain);

    await recordActivity();

    expect(updateChain.update).toHaveBeenCalledWith({
      current_streak:     1,
      longest_streak:     12,  // 1 < 12, so longest unchanged
      last_activity_date: TODAY,
    });
  });

  test('returns early without calling from() when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await recordActivity();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ─── checkAndAwardBadges ──────────────────────────────────────────────────────

describe('checkAndAwardBadges', () => {
  test('awards first_plant when collectionCount >= 1', async () => {
    const streakChain = makeChain();
    streakChain.maybeSingle.mockResolvedValue({ data: { current_streak: 0 }, error: null });
    const badgeChain = makeChain();
    mockFrom
      .mockReturnValueOnce(streakChain)
      .mockReturnValueOnce(badgeChain);

    await checkAndAwardBadges({ collectionCount: 1 });

    expect(badgeChain.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ user_id: 'user-123', badge_key: 'first_plant' }),
      ]),
      expect.objectContaining({ ignoreDuplicates: true }),
    );
  });

  test('awards plant_collector_5 when collectionCount >= 5', async () => {
    const streakChain = makeChain();
    streakChain.maybeSingle.mockResolvedValue({ data: { current_streak: 0 }, error: null });
    const badgeChain = makeChain();
    mockFrom
      .mockReturnValueOnce(streakChain)
      .mockReturnValueOnce(badgeChain);

    await checkAndAwardBadges({ collectionCount: 5 });

    const upsertArg = badgeChain.upsert.mock.calls[0][0] as Array<{ badge_key: string }>;
    const keys = upsertArg.map(b => b.badge_key);
    expect(keys).toContain('first_plant');
    expect(keys).toContain('plant_collector_5');
    expect(keys).not.toContain('plant_collector_20');
  });

  test('awards streak_7 when current streak >= 7', async () => {
    const streakChain = makeChain();
    streakChain.maybeSingle.mockResolvedValue({ data: { current_streak: 7 }, error: null });
    const badgeChain = makeChain();
    mockFrom
      .mockReturnValueOnce(streakChain)
      .mockReturnValueOnce(badgeChain);

    await checkAndAwardBadges({});

    const keys = (badgeChain.upsert.mock.calls[0][0] as Array<{ badge_key: string }>).map(b => b.badge_key);
    expect(keys).toContain('streak_7');
    expect(keys).not.toContain('streak_30');
  });

  test('calls upsert with correct badge keys for all met conditions (ignoreDuplicates handles re-award prevention)', async () => {
    const streakChain = makeChain();
    streakChain.maybeSingle.mockResolvedValue({ data: { current_streak: 0 }, error: null });
    const badgeChain = makeChain();
    mockFrom
      .mockReturnValueOnce(streakChain)
      .mockReturnValueOnce(badgeChain);

    await checkAndAwardBadges({
      collectionCount: 1,
      hasPhoto:        true,
      hasDiagnosis:    true,
      hasListing:      true,
    });

    const keys = (badgeChain.upsert.mock.calls[0][0] as Array<{ badge_key: string }>).map(b => b.badge_key);
    expect(keys).toContain('first_plant');
    expect(keys).toContain('photographer');
    expect(keys).toContain('diagnosed');
    expect(keys).toContain('social_butterfly');
    expect(badgeChain.upsert).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ onConflict: 'user_id,badge_key', ignoreDuplicates: true }),
    );
  });

  test('does not call upsert when no conditions are met', async () => {
    const streakChain = makeChain();
    streakChain.maybeSingle.mockResolvedValue({ data: { current_streak: 0 }, error: null });
    mockFrom.mockReturnValueOnce(streakChain);

    await checkAndAwardBadges({});

    // Only 1 from() call (the streak query). No badge upsert.
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  test('returns early without any DB calls when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await checkAndAwardBadges({ collectionCount: 5 });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ─── getStreakData ────────────────────────────────────────────────────────────

describe('getStreakData', () => {
  test('returns current and longest streak for authenticated user', async () => {
    const chain = makeChain();
    chain.maybeSingle.mockResolvedValue({
      data: { current_streak: 5, longest_streak: 12, last_activity_date: YESTERDAY },
      error: null,
    });
    mockFrom.mockReturnValue(chain);

    const result = await getStreakData();
    expect(result).toEqual({
      current_streak:     5,
      longest_streak:     12,
      last_activity_date: YESTERDAY,
    });
  });

  test('returns zeros when no streak row exists', async () => {
    const chain = makeChain();
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await getStreakData();
    expect(result).toEqual({ current_streak: 0, longest_streak: 0, last_activity_date: null });
  });

  test('returns zeros when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const result = await getStreakData();
    expect(result).toEqual({ current_streak: 0, longest_streak: 0, last_activity_date: null });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ─── getBadges ────────────────────────────────────────────────────────────────

describe('getBadges', () => {
  test('returns array of earned badges for the current user', async () => {
    mockFrom.mockReturnValue(makeChain({
      data: [
        { badge_key: 'first_plant',   earned_at: '2026-05-01T10:00:00Z' },
        { badge_key: 'photographer',  earned_at: '2026-06-01T10:00:00Z' },
      ],
      error: null,
    }));

    const result = await getBadges();
    expect(result).toEqual([
      { badge_key: 'first_plant',  earned_at: '2026-05-01T10:00:00Z' },
      { badge_key: 'photographer', earned_at: '2026-06-01T10:00:00Z' },
    ]);
  });

  test('returns empty array when no badges earned', async () => {
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }));
    const result = await getBadges();
    expect(result).toEqual([]);
  });

  test('accepts an explicit userId and skips auth session', async () => {
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }));
    await getBadges('other-user-456');
    // Confirm the eq() filter was called with the provided userId, not the session user
    const chain = mockFrom.mock.results[0].value;
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'other-user-456');
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  test('returns empty array on Supabase error', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'DB error' } }));
    const result = await getBadges();
    expect(result).toEqual([]);
  });

  test('returns empty array when unauthenticated and no userId provided', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const result = await getBadges();
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ─── updateLeaderboard ────────────────────────────────────────────────────────

describe('updateLeaderboard', () => {
  test('fetches counts and profile, computes score, upserts into leaderboard', async () => {
    // Promise.all fires 4 parallel from() calls, then 1 for the upsert.
    const collectionChain = makeChain({ count: 3,  data: null, error: null });
    const streakChain     = makeChain({ data: null, error: null });
    streakChain.maybeSingle.mockResolvedValue({ data: { current_streak: 5 }, error: null });
    const badgeChain      = makeChain({ count: 2,  data: null, error: null });
    const profileChain    = makeChain({ data: null, error: null });
    profileChain.maybeSingle.mockResolvedValue({
      data: { username: 'alice', avatar_url: 'https://example.com/alice.jpg' },
      error: null,
    });
    const leaderboardChain = makeChain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(collectionChain)
      .mockReturnValueOnce(streakChain)
      .mockReturnValueOnce(badgeChain)
      .mockReturnValueOnce(profileChain)
      .mockReturnValueOnce(leaderboardChain);

    await updateLeaderboard();

    // score = 3*10 + 5*5 + 2*20 = 30 + 25 + 40 = 95
    expect(leaderboardChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id:          'user-123',
        username:         'alice',
        avatar_url:       'https://example.com/alice.jpg',
        collection_count: 3,
        streak:           5,
        badge_count:      2,
        score:            95,
      }),
      expect.objectContaining({ onConflict: 'user_id' }),
    );
  });

  test('falls back to zero counts when counts are null', async () => {
    const collectionChain  = makeChain({ count: null, data: null, error: null });
    const streakChain      = makeChain({ data: null, error: null }); // maybeSingle returns null
    const badgeChain       = makeChain({ count: null, data: null, error: null });
    const profileChain     = makeChain({ data: null, error: null }); // maybeSingle returns null
    const leaderboardChain = makeChain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(collectionChain)
      .mockReturnValueOnce(streakChain)
      .mockReturnValueOnce(badgeChain)
      .mockReturnValueOnce(profileChain)
      .mockReturnValueOnce(leaderboardChain);

    await updateLeaderboard();

    // score = 0*10 + 0*5 + 0*20 = 0
    expect(leaderboardChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ score: 0, collection_count: 0, streak: 0, badge_count: 0 }),
      expect.any(Object),
    );
  });

  test('returns early without DB calls when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await updateLeaderboard();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
