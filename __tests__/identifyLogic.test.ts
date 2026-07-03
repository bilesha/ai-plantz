// __tests__/identifyLogic.test.ts
//
// babel-preset-expo rewrites `process.env.EXPO_PUBLIC_*` reads at module level
// into imports from this virtual ESM module. The mock must be declared first.
jest.mock('expo/virtual/env', () => ({
  env: { EXPO_PUBLIC_API_URL: 'http://localhost:5000' },
}));

import { identifyPlant, type IdentifyResult } from '../logic/identifyLogic';

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

function makeFakeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

const VALID_RESULT: IdentifyResult = {
  isPlant:        true,
  plantName:      'Snake Plant',
  scientificName: 'Dracaena trifasciata',
  confidence:     'high',
  description:    'Identified by its stiff, upright, sword-shaped leaves with yellow margins.',
};

beforeEach(() => {
  mockFetch.mockReset();
});

describe('identifyPlant', () => {
  test('calls /api/plant-identify with imageBase64 and mimeType', async () => {
    mockFetch.mockResolvedValue(makeFakeResponse(VALID_RESULT));

    await identifyPlant({ imageBase64: 'abc123==', mimeType: 'image/jpeg' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/plant-identify',
      expect.objectContaining({
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ imageBase64: 'abc123==', mimeType: 'image/jpeg' }),
      }),
    );
  });

  test('returns parsed IdentifyResult on success', async () => {
    mockFetch.mockResolvedValue(makeFakeResponse(VALID_RESULT));

    const result = await identifyPlant({ imageBase64: 'abc123==', mimeType: 'image/jpeg' });

    expect(result).toEqual(VALID_RESULT);
  });

  test('returns isPlant: false result when the image is not a plant', async () => {
    const notAPlant: IdentifyResult = {
      isPlant:        false,
      plantName:      '',
      scientificName: '',
      confidence:     'low',
      description:    'The image appears to show a coffee mug, not a plant.',
    };
    mockFetch.mockResolvedValue(makeFakeResponse(notAPlant));

    const result = await identifyPlant({ imageBase64: 'abc123==', mimeType: 'image/jpeg' });
    expect(result.isPlant).toBe(false);
    expect(result.plantName).toBe('');
  });

  test('throws with server error message on non-OK response', async () => {
    mockFetch.mockResolvedValue(
      makeFakeResponse({ error: 'imageBase64 is required' }, 400),
    );

    await expect(
      identifyPlant({ imageBase64: '', mimeType: 'image/jpeg' }),
    ).rejects.toThrow('imageBase64 is required');
  });

  test('throws on 500 error', async () => {
    mockFetch.mockResolvedValue(
      makeFakeResponse({ error: 'Failed to identify plant from image.' }, 500),
    );

    await expect(
      identifyPlant({ imageBase64: 'abc123==', mimeType: 'image/jpeg' }),
    ).rejects.toThrow('Failed to identify plant from image.');
  });

  test('throws when fetch itself rejects', async () => {
    mockFetch.mockRejectedValue(new Error('Network request failed'));

    await expect(
      identifyPlant({ imageBase64: 'abc123==', mimeType: 'image/jpeg' }),
    ).rejects.toThrow('Network request failed');
  });

  test('only calls fetch once — no silent retry on failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network request failed'));

    await expect(
      identifyPlant({ imageBase64: 'abc123==', mimeType: 'image/jpeg' }),
    ).rejects.toThrow();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
