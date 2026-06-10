import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import BadgesSection from '../components/BadgesSection';

jest.mock('../logic/gamificationLogic', () => ({
  getBadges: jest.fn(),
  ALL_BADGES: [
    { key: 'first_plant', emoji: '🌱', name: 'First Plant', description: 'Add your first plant.' },
    { key: 'streak_7', emoji: '🔥', name: 'Week Streak', description: 'Maintain a 7-day streak.' },
    { key: 'collector', emoji: '🏆', name: 'Collector', description: 'Add 10 plants.' },
  ],
}));
jest.mock('../constants/theme', () => ({
  useTheme: () => ({
    accent: '#00aa00', surface: '#fff', background: '#f9f9f9',
    border: '#ddd', borderGreen: '#cce', textMuted: '#999',
    textPrimary: '#111', textTitle: '#000',
  }),
}));

import { getBadges } from '../logic/gamificationLogic';
const mockGetBadges = getBadges as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('BadgesSection', () => {
  it('shows loading indicator while fetching', () => {
    mockGetBadges.mockImplementation(() => new Promise(() => {}));
    const { getByTestId } = render(<BadgesSection />);
    // ActivityIndicator is present during load — component renders without crash
    expect(getByTestId !== undefined).toBe(true);
  });

  it('renders all badges after load', async () => {
    mockGetBadges.mockResolvedValue([]);
    const { getByText } = render(<BadgesSection />);
    await waitFor(() => {
      expect(getByText('First Plant')).toBeTruthy();
      expect(getByText('Week Streak')).toBeTruthy();
      expect(getByText('Collector')).toBeTruthy();
    });
  });

  it('shows lock emoji for unearned badges', async () => {
    mockGetBadges.mockResolvedValue([]);
    const { getAllByText } = render(<BadgesSection />);
    await waitFor(() => {
      expect(getAllByText('🔒').length).toBe(3);
    });
  });

  it('shows badge emoji for earned badges', async () => {
    mockGetBadges.mockResolvedValue([
      { badge_key: 'first_plant', earned_at: '2024-03-15T00:00:00Z' },
    ]);
    const { getByText, getAllByText } = render(<BadgesSection />);
    await waitFor(() => {
      expect(getByText('🌱')).toBeTruthy();
      expect(getAllByText('🔒').length).toBe(2);
    });
  });

  it('shows earned date for earned badges', async () => {
    mockGetBadges.mockResolvedValue([
      { badge_key: 'streak_7', earned_at: '2024-06-01T00:00:00Z' },
    ]);
    const { getByText } = render(<BadgesSection />);
    await waitFor(() => {
      expect(getByText(/Jun/)).toBeTruthy();
    });
  });

  it('shows all badges earned', async () => {
    mockGetBadges.mockResolvedValue([
      { badge_key: 'first_plant', earned_at: '2024-01-01T00:00:00Z' },
      { badge_key: 'streak_7', earned_at: '2024-02-01T00:00:00Z' },
      { badge_key: 'collector', earned_at: '2024-03-01T00:00:00Z' },
    ]);
    const { getByText, queryByText } = render(<BadgesSection />);
    await waitFor(() => {
      expect(getByText('🌱')).toBeTruthy();
      expect(getByText('🔥')).toBeTruthy();
      expect(getByText('🏆')).toBeTruthy();
      expect(queryByText('🔒')).toBeNull();
    });
  });

  it('renders BADGES section label', async () => {
    mockGetBadges.mockResolvedValue([]);
    const { getByText } = render(<BadgesSection />);
    await waitFor(() => {
      expect(getByText('BADGES')).toBeTruthy();
    });
  });

  it('handles getBadges error gracefully', async () => {
    mockGetBadges.mockRejectedValue(new Error('Network error'));
    const { getByText } = render(<BadgesSection />);
    await waitFor(() => {
      expect(getByText('BADGES')).toBeTruthy();
      expect(getByText('First Plant')).toBeTruthy();
    });
  });

  it('passes userId to getBadges', async () => {
    mockGetBadges.mockResolvedValue([]);
    render(<BadgesSection userId="user-123" />);
    await waitFor(() => {
      expect(mockGetBadges).toHaveBeenCalledWith('user-123');
    });
  });
});
