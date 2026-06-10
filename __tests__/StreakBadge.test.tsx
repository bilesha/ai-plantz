import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import StreakBadge from '../components/StreakBadge';

jest.mock('../logic/gamificationLogic', () => ({
  getStreakData: jest.fn(),
}));
jest.mock('../constants/theme', () => ({
  useTheme: () => ({
    accent: '#00aa00', surface: '#fff', background: '#fff',
    border: '#ddd', textMuted: '#999', textPrimary: '#111',
    textTitle: '#000', textSecondary: '#555',
  }),
}));

import { getStreakData } from '../logic/gamificationLogic';
const mockGetStreakData = getStreakData as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('StreakBadge', () => {
  it('renders nothing when streak is 0 and longest is 0', async () => {
    mockGetStreakData.mockResolvedValue({ current_streak: 0, longest_streak: 0, last_activity_date: null });
    const { toJSON } = render(<StreakBadge />);
    await waitFor(() => {
      expect(toJSON()).toBeNull();
    });
  });

  it('renders chip when current streak > 0', async () => {
    mockGetStreakData.mockResolvedValue({ current_streak: 5, longest_streak: 10, last_activity_date: '2024-01-01' });
    const { getByText } = render(<StreakBadge />);
    await waitFor(() => {
      expect(getByText('🔥 5')).toBeTruthy();
    });
  });

  it('renders chip when longest streak > 0 but current is 0', async () => {
    mockGetStreakData.mockResolvedValue({ current_streak: 0, longest_streak: 7, last_activity_date: null });
    const { getByText } = render(<StreakBadge />);
    await waitFor(() => {
      expect(getByText('🔥 0')).toBeTruthy();
    });
  });

  it('opens modal on chip press', async () => {
    mockGetStreakData.mockResolvedValue({ current_streak: 5, longest_streak: 10, last_activity_date: '2024-01-01' });
    const { getByText } = render(<StreakBadge />);
    await waitFor(() => getByText('🔥 5'));
    fireEvent.press(getByText('🔥 5'));
    await waitFor(() => {
      expect(getByText('Activity Streak')).toBeTruthy();
      expect(getByText('5')).toBeTruthy();
      expect(getByText('10')).toBeTruthy();
    });
  });

  it('closes modal when Got it is pressed', async () => {
    mockGetStreakData.mockResolvedValue({ current_streak: 5, longest_streak: 10, last_activity_date: '2024-01-01' });
    const { getByText, queryByText } = render(<StreakBadge />);
    await waitFor(() => getByText('🔥 5'));
    fireEvent.press(getByText('🔥 5'));
    await waitFor(() => getByText('Got it'));
    fireEvent.press(getByText('Got it'));
    await waitFor(() => {
      expect(queryByText('Activity Streak')).toBeNull();
    });
  });

  it('shows correct motivational message for streak < 3', async () => {
    mockGetStreakData.mockResolvedValue({ current_streak: 1, longest_streak: 1, last_activity_date: '2024-01-01' });
    const { getByText } = render(<StreakBadge />);
    await waitFor(() => getByText('🔥 1'));
    fireEvent.press(getByText('🔥 1'));
    await waitFor(() => {
      expect(getByText('Great start — keep it going!')).toBeTruthy();
    });
  });

  it('shows correct motivational message for streak >= 30', async () => {
    mockGetStreakData.mockResolvedValue({ current_streak: 30, longest_streak: 30, last_activity_date: '2024-01-01' });
    const { getByText } = render(<StreakBadge />);
    await waitFor(() => getByText('🔥 30'));
    fireEvent.press(getByText('🔥 30'));
    await waitFor(() => {
      expect(getByText('Legendary plant parent! 🏆')).toBeTruthy();
    });
  });

  it('handles getStreakData error gracefully', async () => {
    mockGetStreakData.mockRejectedValue(new Error('Network error'));
    const { toJSON } = render(<StreakBadge />);
    await waitFor(() => {
      expect(toJSON()).toBeNull();
    });
  });
});
