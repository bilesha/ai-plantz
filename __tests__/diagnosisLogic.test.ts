// __tests__/diagnosisLogic.test.ts
//
// babel-preset-expo rewrites `process.env.EXPO_PUBLIC_*` reads at module level
// into imports from this virtual ESM module. The mock must be declared first.
jest.mock('expo/virtual/env', () => ({
  env: { EXPO_PUBLIC_API_URL: 'http://localhost:5000' },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

import { diagnosePlant, type DiagnosisResult } from '../logic/diagnosisLogic';

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

function makeFakeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

const VALID_RESULT: DiagnosisResult = {
  healthy:         false,
  issues:          ['Yellowing leaves', 'Brown tips'],
  diagnosis:       'The plant shows signs of overwatering.',
  recommendations: ['Let soil dry out', 'Improve drainage'],
};

beforeEach(() => {
  mockFetch.mockReset();
});

describe('diagnosePlant', () => {
  test('calls /api/plant-diagnosis with imageBase64, mimeType, and plantName', async () => {
    mockFetch.mockResolvedValue(makeFakeResponse(VALID_RESULT));

    await diagnosePlant({
      imageBase64: 'abc123==',
      mimeType:    'image/jpeg',
      plantName:   'Monstera',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/plant-diagnosis',
      expect.objectContaining({
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ imageBase64: 'abc123==', mimeType: 'image/jpeg', plantName: 'Monstera' }),
      }),
    );
  });

  test('includes undefined plantName in request body when not provided', async () => {
    mockFetch.mockResolvedValue(makeFakeResponse(VALID_RESULT));

    await diagnosePlant({ imageBase64: 'abc123==', mimeType: 'image/jpeg' });

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentBody.imageBase64).toBe('abc123==');
    expect(sentBody.mimeType).toBe('image/jpeg');
    // plantName is undefined → not present or undefined in JSON
    expect(Object.keys(sentBody)).not.toContain('plantName');
  });

  test('returns parsed DiagnosisResult on success', async () => {
    mockFetch.mockResolvedValue(makeFakeResponse(VALID_RESULT));

    const result = await diagnosePlant({
      imageBase64: 'abc123==',
      mimeType:    'image/jpeg',
      plantName:   'Monstera',
    });

    expect(result).toEqual(VALID_RESULT);
  });

  test('returns healthy: true result when plant looks healthy', async () => {
    const healthyResult: DiagnosisResult = {
      healthy:         true,
      issues:          [],
      diagnosis:       'The plant looks healthy and vibrant.',
      recommendations: [],
    };
    mockFetch.mockResolvedValue(makeFakeResponse(healthyResult));

    const result = await diagnosePlant({ imageBase64: 'abc123==', mimeType: 'image/jpeg' });
    expect(result.healthy).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  test('throws with server error message on non-OK response', async () => {
    mockFetch.mockResolvedValue(
      makeFakeResponse({ error: 'imageBase64 is required' }, 400),
    );

    await expect(
      diagnosePlant({ imageBase64: '', mimeType: 'image/jpeg' }),
    ).rejects.toThrow('imageBase64 is required');
  });

  test('throws on 500 error', async () => {
    mockFetch.mockResolvedValue(
      makeFakeResponse({ error: 'Failed to diagnose plant from image.' }, 500),
    );

    await expect(
      diagnosePlant({ imageBase64: 'abc123==', mimeType: 'image/jpeg' }),
    ).rejects.toThrow('Failed to diagnose plant from image.');
  });

  test('throws when fetch itself rejects', async () => {
    mockFetch.mockRejectedValue(new Error('Network request failed'));

    await expect(
      diagnosePlant({ imageBase64: 'abc123==', mimeType: 'image/jpeg' }),
    ).rejects.toThrow('Network request failed');
  });

  test('only calls fetch once — no silent retry on failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network request failed'));

    await expect(
      diagnosePlant({ imageBase64: 'abc123==', mimeType: 'image/jpeg' }),
    ).rejects.toThrow();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
