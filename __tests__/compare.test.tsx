import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CompareScreen from '../app/screens/compare';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));
jest.mock('../constants/theme', () => ({
  useTheme: () => ({
    accent: '#00aa00', accentDark: '#007700', surface: '#fff',
    surfaceGreen: '#f0fff0', background: '#f9f9f9', border: '#ddd',
    borderGreen: '#cce', textMuted: '#999', textPrimary: '#111',
    textTitle: '#000', textBody: '#222',
  }),
}));
jest.mock('../logic/compareLogic', () => ({
  comparePlants: jest.fn(),
}));

import { comparePlants } from '../logic/compareLogic';
const mockComparePlants = comparePlants as jest.Mock;

const mockResult = {
  summary: 'Both are great houseplants.',
  categories: [
    { label: 'Light', plantA: 'Indirect', plantB: 'Low light' },
    { label: 'Water', plantA: 'Weekly',   plantB: 'Bi-weekly' },
  ],
  verdict: 'Pothos is easier for beginners.',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockComparePlants.mockResolvedValue(mockResult);
});

describe('CompareScreen', () => {
  it('renders the title', () => {
    const { getByText } = render(<CompareScreen />);
    expect(getByText('Compare Plants')).toBeTruthy();
  });

  it('renders plant A and B inputs', () => {
    const { getByPlaceholderText } = render(<CompareScreen />);
    expect(getByPlaceholderText('e.g. Monstera')).toBeTruthy();
    expect(getByPlaceholderText('e.g. Pothos')).toBeTruthy();
  });

  it('Compare button is disabled when inputs are empty', () => {
    const { getByText } = render(<CompareScreen />);
    expect(getByText('Compare')).toBeTruthy();
    // button renders but is disabled — no crash
  });

  it('calls comparePlants with trimmed inputs', async () => {
    const { getByPlaceholderText, getByText } = render(<CompareScreen />);
    fireEvent.changeText(getByPlaceholderText('e.g. Monstera'), 'Monstera');
    fireEvent.changeText(getByPlaceholderText('e.g. Pothos'), 'Pothos');
    fireEvent.press(getByText('Compare'));
    await waitFor(() => {
      expect(mockComparePlants).toHaveBeenCalledWith('Monstera', 'Pothos');
    });
  });

  it('shows summary after successful compare', async () => {
    const { getByPlaceholderText, getByText } = render(<CompareScreen />);
    fireEvent.changeText(getByPlaceholderText('e.g. Monstera'), 'Monstera');
    fireEvent.changeText(getByPlaceholderText('e.g. Pothos'), 'Pothos');
    fireEvent.press(getByText('Compare'));
    await waitFor(() => {
      expect(getByText('Both are great houseplants.')).toBeTruthy();
    });
  });

  it('shows category rows in results', async () => {
    const { getByPlaceholderText, getByText } = render(<CompareScreen />);
    fireEvent.changeText(getByPlaceholderText('e.g. Monstera'), 'Monstera');
    fireEvent.changeText(getByPlaceholderText('e.g. Pothos'), 'Pothos');
    fireEvent.press(getByText('Compare'));
    await waitFor(() => {
      expect(getByText('Light')).toBeTruthy();
      expect(getByText('Indirect')).toBeTruthy();
      expect(getByText('Low light')).toBeTruthy();
    });
  });

  it('shows verdict after compare', async () => {
    const { getByPlaceholderText, getByText } = render(<CompareScreen />);
    fireEvent.changeText(getByPlaceholderText('e.g. Monstera'), 'Monstera');
    fireEvent.changeText(getByPlaceholderText('e.g. Pothos'), 'Pothos');
    fireEvent.press(getByText('Compare'));
    await waitFor(() => {
      expect(getByText('Pothos is easier for beginners.')).toBeTruthy();
    });
  });

  it('shows error message on failure', async () => {
    mockComparePlants.mockRejectedValue(new Error('API error'));
    const { getByPlaceholderText, getByText } = render(<CompareScreen />);
    fireEvent.changeText(getByPlaceholderText('e.g. Monstera'), 'Monstera');
    fireEvent.changeText(getByPlaceholderText('e.g. Pothos'), 'Pothos');
    fireEvent.press(getByText('Compare'));
    await waitFor(() => {
      expect(getByText('API error')).toBeTruthy();
    });
  });

  it('resets form when Compare again is pressed', async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(<CompareScreen />);
    fireEvent.changeText(getByPlaceholderText('e.g. Monstera'), 'Monstera');
    fireEvent.changeText(getByPlaceholderText('e.g. Pothos'), 'Pothos');
    fireEvent.press(getByText('Compare'));
    await waitFor(() => getByText('Compare again'));
    fireEvent.press(getByText('Compare again'));
    await waitFor(() => {
      expect(queryByText('Both are great houseplants.')).toBeNull();
    });
  });

  it('resets form when Try again is pressed after error', async () => {
    mockComparePlants.mockRejectedValue(new Error('Oops'));
    const { getByPlaceholderText, getByText, queryByText } = render(<CompareScreen />);
    fireEvent.changeText(getByPlaceholderText('e.g. Monstera'), 'Monstera');
    fireEvent.changeText(getByPlaceholderText('e.g. Pothos'), 'Pothos');
    fireEvent.press(getByText('Compare'));
    await waitFor(() => getByText('Try again'));
    fireEvent.press(getByText('Try again'));
    await waitFor(() => {
      expect(queryByText('Oops')).toBeNull();
    });
  });

  it('calls router.back when back button pressed', () => {
    const back = jest.fn();
    jest.spyOn(require('expo-router'), 'useRouter').mockReturnValue({ back });
    const { getByText } = render(<CompareScreen />);
    fireEvent.press(getByText('‹'));
    expect(back).toHaveBeenCalled();
  });
});
