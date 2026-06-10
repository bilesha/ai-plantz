// __tests__/chatLogic.test.ts

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
  },
}));

import { supabase } from '../lib/supabase';
import {
  getPlantChat,
  saveChatMessage,
  clearPlantChat,
  type ChatMessage,
} from '../logic/chatLogic';

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

function mockQuery(result: { data: any; error: any }) {
  const chain: any = {
    select:      jest.fn().mockReturnThis(),
    eq:          jest.fn().mockReturnThis(),
    ilike:       jest.fn().mockReturnThis(),
    order:       jest.fn().mockReturnThis(),
    insert:      jest.fn().mockReturnThis(),
    delete:      jest.fn().mockReturnThis(),
    single:      jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(result).then(resolve, reject);
  mockFrom.mockReturnValue(chain);
  return chain;
}

const MSG_FIXTURE: ChatMessage = {
  id:         'msg-1',
  user_id:    'user-123',
  plant_name: 'Monstera',
  role:       'user',
  content:    'How often should I water this?',
  created_at: '2026-06-10T10:00:00Z',
};

const REPLY_FIXTURE: ChatMessage = {
  id:         'msg-2',
  user_id:    'user-123',
  plant_name: 'Monstera',
  role:       'assistant',
  content:    'Water every 1–2 weeks.',
  created_at: '2026-06-10T10:00:05Z',
};

beforeEach(() => {
  jest.resetAllMocks();
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'user-123' } } },
  });
});

// ─── getPlantChat ─────────────────────────────────────────────────────────────

describe('getPlantChat', () => {
  test('returns messages ordered by created_at for authenticated user', async () => {
    mockQuery({ data: [MSG_FIXTURE, REPLY_FIXTURE], error: null });

    const result = await getPlantChat('Monstera');

    expect(result).toEqual([MSG_FIXTURE, REPLY_FIXTURE]);
    // Confirm the query filters by both user_id and plant_name
    const chain = mockFrom.mock.results[0].value;
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(chain.ilike).toHaveBeenCalledWith('plant_name', 'Monstera');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: true });
  });

  test('returns empty array when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const result = await getPlantChat('Monstera');
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('returns empty array on Supabase error', async () => {
    mockQuery({ data: null, error: { message: 'DB error' } });
    const result = await getPlantChat('Monstera');
    expect(result).toEqual([]);
  });

  test('returns empty array when data is null', async () => {
    mockQuery({ data: null, error: null });
    const result = await getPlantChat('Monstera');
    expect(result).toEqual([]);
  });
});

// ─── saveChatMessage ──────────────────────────────────────────────────────────

describe('saveChatMessage', () => {
  test('inserts message with correct role and content, returns saved row', async () => {
    const chain = mockQuery({ data: null, error: null });
    chain.single.mockResolvedValue({ data: MSG_FIXTURE, error: null });

    const result = await saveChatMessage('Monstera', 'user', 'How often should I water this?');

    expect(result).toEqual(MSG_FIXTURE);
    expect(chain.insert).toHaveBeenCalledWith({
      user_id:    'user-123',
      plant_name: 'Monstera',
      role:       'user',
      content:    'How often should I water this?',
    });
  });

  test('inserts assistant message correctly', async () => {
    const chain = mockQuery({ data: null, error: null });
    chain.single.mockResolvedValue({ data: REPLY_FIXTURE, error: null });

    const result = await saveChatMessage('Monstera', 'assistant', 'Water every 1–2 weeks.');

    expect(result).toEqual(REPLY_FIXTURE);
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'assistant', content: 'Water every 1–2 weeks.' }),
    );
  });

  test('returns null when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const result = await saveChatMessage('Monstera', 'user', 'Hello');
    expect(result).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('returns null on Supabase insert error', async () => {
    const chain = mockQuery({ data: null, error: null });
    chain.single.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });

    const result = await saveChatMessage('Monstera', 'user', 'Hello');
    expect(result).toBeNull();
  });

  test('returns null when single returns null data without error', async () => {
    const chain = mockQuery({ data: null, error: null });
    chain.single.mockResolvedValue({ data: null, error: null });

    const result = await saveChatMessage('Monstera', 'user', 'Hello');
    expect(result).toBeNull();
  });
});

// ─── clearPlantChat ───────────────────────────────────────────────────────────

describe('clearPlantChat', () => {
  test('calls delete with correct user_id and plant_name filters', async () => {
    const chain = mockQuery({ data: null, error: null });

    await clearPlantChat('Monstera');

    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(chain.ilike).toHaveBeenCalledWith('plant_name', 'Monstera');
  });

  test('no-ops when unauthenticated — does not call from()', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await clearPlantChat('Monstera');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
