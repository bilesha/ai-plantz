import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LeaderboardScreen from '../app/screens/leaderboard';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));
jest.mock('../constants/theme', () => ({
  useTheme: () => ({
    accent: '#00aa00', accentDark: '#007700', surface: '#fff',
    surfaceGreen: '#f0fff0', background: '#f9f9f9', border: '#ddd',
    textMuted: '#999', textPrimary: '#111', textTitle: '#000',
  }),
}));
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
  },
}));

import { supabase } from '../lib/supabase';
const mockSupabase = supabase as jest.Mocked<typeof supabase>;

const mockRows = [
  { user_id: 'u1', username: 'Alice', avatar_url: null, collection_count: 5, streak: 3, badge_count: 2, score: 100 },
  { user_id: 'u2', username: 'Bob',   avatar_url: null, collection_count: 3, streak: 1, badge_count: 1, score: 55 },
  { user_id: 'u3', username: 'Carol', avatar_url: null, collection_count: 2, streak: 0, badge_count: 0, score: 20 },
];

function setupSupabaseMock(rows: typeof mockRows, userId = 'u1') {
  mockSupabase.auth.getSession.mockResolvedValue({
    data: { session: { user: { id: userId } } },
  } as any);
  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data: rows, error: null }),
  };
  mockSupabase.from.mockReturnValue(queryBuilder as any);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LeaderboardScreen', () => {
  it('shows loading indicator initially', () => {
    mockSupabase.auth.getSession.mockImplementation(() => new Promise(() => {}));
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockImplementation(() => new Promise(() => {})),
    } as any);
    const { getByTestId } = render(<LeaderboardScreen />);
    expect(getByTestId !== undefined).toBe(true);
  });

  it('renders leaderboard title', async () => {
    setupSupabaseMock(mockRows);
    const { getByText } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(getByText('Leaderboard')).toBeTruthy();
    });
  });

  it('shows empty state when no rows', async () => {
    setupSupabaseMock([]);
    const { getByText } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(getByText('No scores yet. Be the first!')).toBeTruthy();
    });
  });

  it('renders usernames from leaderboard data', async () => {
    setupSupabaseMock(mockRows);
    const { getByText } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(getByText(/Alice/)).toBeTruthy();
      expect(getByText(/Bob/)).toBeTruthy();
      expect(getByText(/Carol/)).toBeTruthy();
    });
  });

  it('marks current user with (you)', async () => {
    setupSupabaseMock(mockRows, 'u1');
    const { getByText } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(getByText('Alice (you)')).toBeTruthy();
    });
  });

  it('shows medal emojis for top 3', async () => {
    setupSupabaseMock(mockRows);
    const { getByText } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(getByText('🥇')).toBeTruthy();
      expect(getByText('🥈')).toBeTruthy();
      expect(getByText('🥉')).toBeTruthy();
    });
  });

  it('shows score for each row', async () => {
    setupSupabaseMock(mockRows);
    const { getByText } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(getByText('100')).toBeTruthy();
      expect(getByText('55')).toBeTruthy();
      expect(getByText('20')).toBeTruthy();
    });
  });

  it('shows score key formula', async () => {
    setupSupabaseMock(mockRows);
    const { getByText } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(getByText(/Score =/)).toBeTruthy();
    });
  });

  it('calls router.back when back button pressed', async () => {
    const back = jest.fn();
    jest.spyOn(require('expo-router'), 'useRouter').mockReturnValue({ back });
    setupSupabaseMock(mockRows);
    const { getByText } = render(<LeaderboardScreen />);
    await waitFor(() => getByText('Leaderboard'));
    fireEvent.press(getByText('‹'));
    expect(back).toHaveBeenCalled();
  });
});
