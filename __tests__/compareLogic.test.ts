// __tests__/compareLogic.test.ts
//
// babel-preset-expo rewrites `process.env.EXPO_PUBLIC_*` reads at module level
// into imports from this virtual ESM module. The mock must be declared first.
jest.mock('expo/virtual/env', () => ({
  env: { EXPO_PUBLIC_API_URL: 'http://localhost:5000' },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { comparePlants, type CompareResult } from '../logic/compareLogic';

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

function makeFakeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

const VALID_RESULT: CompareResult = {
  summary: 'Pothos is easier; Fiddle Leaf Fig is more rewarding.',
  categories: [
    { label: 'Watering',  plantA: 'Every 1–2 weeks', plantB: 'Weekly'          },
    { label: 'Light',     plantA: 'Low to bright',   plantB: 'Bright indirect' },
    { label: 'Care Level',plantA: 'Easy',             plantB: 'Hard'            },
  ],
  verdict: 'Choose Pothos for beginners, Fiddle Leaf Fig for experienced growers.',
};

beforeEach(async () => {
  mockFetch.mockReset();
  await AsyncStorage.clear();
});

describe('comparePlants', () => {
  test('sends correct body with both plant names and gemini provider by default', async () => {
    mockFetch.mockResolvedValue(makeFakeResponse(VALID_RESULT));

    await comparePlants('Pothos', 'Monstera');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/plant-compare',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantA: 'Pothos', plantB: 'Monstera', aiProvider: 'gemini' }),
      }),
    );
  });

  test('sends groq as aiProvider when stored preference is groq', async () => {
    await AsyncStorage.setItem('ai_provider', 'groq');
    mockFetch.mockResolvedValue(makeFakeResponse(VALID_RESULT));

    await comparePlants('Pothos', 'Monstera');

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentBody.aiProvider).toBe('groq');
  });

  test('falls back to gemini for any non-groq stored provider', async () => {
    await AsyncStorage.setItem('ai_provider', 'deepseek');
    mockFetch.mockResolvedValue(makeFakeResponse(VALID_RESULT));

    await comparePlants('Pothos', 'Monstera');

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentBody.aiProvider).toBe('gemini');
  });

  test('returns parsed CompareResult on success', async () => {
    mockFetch.mockResolvedValue(makeFakeResponse(VALID_RESULT));

    const result = await comparePlants('Pothos', 'Monstera');

    expect(result).toEqual(VALID_RESULT);
  });

  test('throws on non-OK response with server error message', async () => {
    mockFetch.mockResolvedValue(
      makeFakeResponse({ error: 'plantA is required' }, 400),
    );

    await expect(comparePlants('', 'Monstera')).rejects.toThrow('plantA is required');
  });

  test('throws with fallback message when error body has no error field', async () => {
    mockFetch.mockResolvedValue({
      ok:   false,
      status: 500,
      json: jest.fn().mockRejectedValue(new Error('not JSON')),
    });

    await expect(comparePlants('Pothos', 'Monstera')).rejects.toThrow();
  });

  test('throws when fetch itself rejects', async () => {
    mockFetch.mockRejectedValue(new Error('Network request failed'));
    await expect(comparePlants('Pothos', 'Monstera')).rejects.toThrow('Network request failed');
  });
});
