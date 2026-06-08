// __tests__/socialLogic.test.ts
import { supabase } from '../lib/supabase';
import {
  getLikes,
  toggleLike,
  getComments,
  addComment,
  CommentItem,
} from '../logic/socialLogic';

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
  },
}));

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

// Returns a self-contained chainable query builder that resolves to `result`.
// Each test wires mockFrom separately (via mockReturnValue / mockReturnValueOnce)
// because socialLogic calls supabase.from() multiple times per function.
function makeChain(result: { data?: any; error?: any; count?: number | null } = {}) {
  const resolved = { data: null, error: null, count: null, ...result };
  const chain: any = {
    select:      jest.fn().mockReturnThis(),
    eq:          jest.fn().mockReturnThis(),
    in:          jest.fn().mockReturnThis(),
    order:       jest.fn().mockReturnThis(),
    limit:       jest.fn().mockReturnThis(),
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

beforeEach(() => {
  jest.resetAllMocks();
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'user-123' } } },
  });
});

// ─── getLikes ─────────────────────────────────────────────────────────────────

describe('getLikes', () => {
  // Unauthenticated: only the count query runs (no maybeSingle for hasLiked).
  test('returns { count: 0, hasLiked: false } when unauthenticated and count is null', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockFrom.mockReturnValue(makeChain({ count: null }));

    const result = await getLikes('owner-1', 'Monstera');
    expect(result).toEqual({ count: 0, hasLiked: false });
  });

  test('returns correct count with hasLiked: false when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockFrom.mockReturnValue(makeChain({ count: 5 }));

    const result = await getLikes('owner-1', 'Monstera');
    expect(result).toEqual({ count: 5, hasLiked: false });
  });

  // Authenticated: count query runs first, then maybeSingle check.
  test('returns hasLiked: true when authenticated and own like row exists', async () => {
    const countChain  = makeChain({ count: 3 });
    const likeChain   = makeChain();
    likeChain.maybeSingle.mockResolvedValue({ data: { id: 'like-1' }, error: null });
    mockFrom.mockReturnValueOnce(countChain).mockReturnValueOnce(likeChain);

    const result = await getLikes('owner-1', 'Monstera');
    expect(result).toEqual({ count: 3, hasLiked: true });
  });

  test('returns hasLiked: false when authenticated and no like row', async () => {
    const countChain = makeChain({ count: 2 });
    const likeChain  = makeChain(); // maybeSingle defaults to { data: null }
    mockFrom.mockReturnValueOnce(countChain).mockReturnValueOnce(likeChain);

    const result = await getLikes('owner-1', 'Monstera');
    expect(result).toEqual({ count: 2, hasLiked: false });
  });
});

// ─── toggleLike ───────────────────────────────────────────────────────────────

describe('toggleLike', () => {
  test('returns false when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const result = await toggleLike('owner-1', 'Monstera');
    expect(result).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('calls delete and returns false when like already exists', async () => {
    const existingChain = makeChain();
    existingChain.maybeSingle.mockResolvedValue({ data: { id: 'like-1' }, error: null });
    const deleteChain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValueOnce(existingChain).mockReturnValueOnce(deleteChain);

    const result = await toggleLike('owner-1', 'Monstera');
    expect(result).toBe(false);
    expect(deleteChain.delete).toHaveBeenCalled();
  });

  test('calls insert and returns true when like does not exist', async () => {
    const existingChain = makeChain(); // maybeSingle → { data: null } → no existing like
    const insertChain   = makeChain({ data: null, error: null });
    mockFrom.mockReturnValueOnce(existingChain).mockReturnValueOnce(insertChain);

    const result = await toggleLike('owner-1', 'Monstera');
    expect(result).toBe(true);
    expect(insertChain.insert).toHaveBeenCalledWith({
      user_id:        'user-123',
      plant_owner_id: 'owner-1',
      plant_name:     'Monstera',
    });
  });
});

// ─── getComments ──────────────────────────────────────────────────────────────

describe('getComments', () => {
  test('returns [] on Supabase error', async () => {
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: { message: 'DB error' } })
    );
    expect(await getComments('owner-1', 'Monstera')).toEqual([]);
  });

  test('returns [] when no comments', async () => {
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }));
    expect(await getComments('owner-1', 'Monstera')).toEqual([]);
  });

  test('maps comments with profile data correctly', async () => {
    const commentsChain = makeChain({
      data: [
        { id: 'c1', body: 'Great plant!', created_at: '2026-06-01T10:00:00Z', user_id: 'u1' },
      ],
      error: null,
    });
    const profilesChain = makeChain({
      data: [{ id: 'u1', username: 'alice', avatar_url: 'https://example.com/alice.jpg' }],
      error: null,
    });
    mockFrom.mockReturnValueOnce(commentsChain).mockReturnValueOnce(profilesChain);

    const result = await getComments('owner-1', 'Monstera');
    expect(result).toEqual<CommentItem[]>([{
      id:         'c1',
      body:       'Great plant!',
      created_at: '2026-06-01T10:00:00Z',
      user_id:    'u1',
      username:   'alice',
      avatar_url: 'https://example.com/alice.jpg',
    }]);
  });

  test('sets username/avatar_url to null when profile not found for a user_id', async () => {
    const commentsChain = makeChain({
      data: [{ id: 'c1', body: 'Hi!', created_at: '2026-06-01T10:00:00Z', user_id: 'u1' }],
      error: null,
    });
    const profilesChain = makeChain({ data: [], error: null }); // no matching profile
    mockFrom.mockReturnValueOnce(commentsChain).mockReturnValueOnce(profilesChain);

    const result = await getComments('owner-1', 'Monstera');
    expect(result).toEqual<CommentItem[]>([{
      id:         'c1',
      body:       'Hi!',
      created_at: '2026-06-01T10:00:00Z',
      user_id:    'u1',
      username:   null,
      avatar_url: null,
    }]);
  });
});

// ─── addComment ───────────────────────────────────────────────────────────────

describe('addComment', () => {
  test('returns null when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const result = await addComment('owner-1', 'Monstera', 'Hello!');
    expect(result).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('returns null on insert error', async () => {
    const commentChain = makeChain();
    commentChain.single.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });
    mockFrom.mockReturnValue(commentChain);

    const result = await addComment('owner-1', 'Monstera', 'Hello!');
    expect(result).toBeNull();
  });

  test('returns correctly shaped CommentItem with profile data on success', async () => {
    const commentChain = makeChain();
    commentChain.single.mockResolvedValue({
      data: { id: 'c1', body: 'Hello!', created_at: '2026-06-01T10:00:00Z', user_id: 'user-123' },
      error: null,
    });
    const profileChain = makeChain();
    profileChain.maybeSingle.mockResolvedValue({
      data: { username: 'alice', avatar_url: 'https://example.com/alice.jpg' },
      error: null,
    });
    mockFrom.mockReturnValueOnce(commentChain).mockReturnValueOnce(profileChain);

    const result = await addComment('owner-1', 'Monstera', 'Hello!');
    expect(result).toEqual<CommentItem>({
      id:         'c1',
      body:       'Hello!',
      created_at: '2026-06-01T10:00:00Z',
      user_id:    'user-123',
      username:   'alice',
      avatar_url: 'https://example.com/alice.jpg',
    });
  });
});
