// __tests__/fetchPlantTips.test.ts

// babel-preset-expo rewrites `process.env.EXPO_PUBLIC_API_URL` into an import
// from this virtual ESM module, which Jest can't parse. Mocking it here (with a
// factory) prevents the real file from ever loading. jest.mock() calls are
// hoisted above all imports by Babel, so this intercepts the require before
// fetchPlantTips.ts is evaluated.
jest.mock('expo/virtual/env', () => ({
  env: { EXPO_PUBLIC_API_URL: 'http://localhost:5000' },
}));

import { getPlantTips } from '../utilities/fetchPlantTips';

// Replace the global fetch with a Jest mock function before any test runs.
// fetch is a browser/Node global — we can't import it, but we can overwrite it
// on the global object. Every test then controls exactly what fetch "returns"
// without making any real network requests.
global.fetch = jest.fn();

// Cast once so TypeScript lets us call .mockResolvedValue / .mockRejectedValue
// on the mock without complaining that those methods don't exist on typeof fetch.
const mockFetch = global.fetch as jest.Mock;

// Helper that builds a fake Response object shaped like the real fetch API.
// fetch() doesn't return data directly — it returns a Response whose .json()
// method is itself async. Both ok and status need to match for realistic tests.
function makeFakeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

// Wipe the mock's call history and return value before each test so tests
// can't accidentally share state (same reason we clear AsyncStorage in cacheLogic).
beforeEach(() => {
  mockFetch.mockReset();
});

const PLANT_NAME = 'Monstera';
const VALID_RESPONSE = {
  summary: 'Easy to care for.',
  details: { watering: 'Weekly', light: 'Bright indirect', fertilizer: 'Spring' },
};

describe('getPlantTips — happy path', () => {
  test('calls fetch with the correct URL, method, headers, and body', async () => {
    // Checks the outgoing request is shaped correctly.
    // If the backend contract changes (endpoint renamed, body field renamed)
    // this test will catch it immediately.
    mockFetch.mockResolvedValue(makeFakeResponse(VALID_RESPONSE));

    await getPlantTips(PLANT_NAME);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/plant-tips'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantName: PLANT_NAME }),
      })
    );
  });

  test('returns the parsed JSON body on a 200 response', async () => {
    // The function's main job: translate a successful response into the data
    // object the rest of the app uses. Confirms response.json() is awaited and
    // the result is returned unchanged.
    mockFetch.mockResolvedValue(makeFakeResponse(VALID_RESPONSE));

    const result = await getPlantTips(PLANT_NAME);

    expect(result).toEqual(VALID_RESPONSE);
  });

  test('sends the plant name exactly as passed — spaces preserved', async () => {
    // Plant names like "Snake Plant" must reach the backend verbatim.
    // URL-encoding or trimming would silently send the wrong query to Gemini.
    mockFetch.mockResolvedValue(makeFakeResponse(VALID_RESPONSE));

    await getPlantTips('Snake Plant');

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentBody.plantName).toBe('Snake Plant');
  });
});

describe('getPlantTips — server errors', () => {
  test('throws when the server responds with 500', async () => {
    // response.ok is false for 5xx status codes. The function should throw
    // rather than silently returning undefined or a malformed object, so the
    // caller can display an error message instead of a blank screen.
    mockFetch.mockResolvedValue(makeFakeResponse({ error: 'Internal server error' }, 500));

    await expect(getPlantTips(PLANT_NAME)).rejects.toThrow('Server error: 500');
  });

  test('throws when the server responds with 404', async () => {
    // Same boundary check for a different non-ok status code.
    // Confirms the guard is `!response.ok` (covers all 4xx/5xx) rather than
    // a specific status check like `response.status === 500`.
    mockFetch.mockResolvedValue(makeFakeResponse({ error: 'Not found' }, 404));

    await expect(getPlantTips(PLANT_NAME)).rejects.toThrow('Server error: 404');
  });

  test('includes the status code in the thrown error message', async () => {
    // The error message format ("Server error: 503") is relied on by callers
    // to show meaningful feedback. Pin it so a refactor doesn't silently change it.
    mockFetch.mockResolvedValue(makeFakeResponse({}, 503));

    await expect(getPlantTips(PLANT_NAME)).rejects.toThrow('503');
  });
});

describe('getPlantTips — network errors', () => {
  test('re-throws when fetch itself rejects (no network)', async () => {
    // fetch() rejects (not just returns a bad status) when there is no network
    // at all — offline device, DNS failure, connection refused, etc.
    // The function catches, logs, then re-throws so callers still get an error.
    const networkError = new Error('Network request failed');
    mockFetch.mockRejectedValue(networkError);

    await expect(getPlantTips(PLANT_NAME)).rejects.toThrow('Network request failed');
  });

  test('only calls fetch once — no silent retry on failure', async () => {
    // Retries can mask problems and cause duplicate Gemini charges.
    // Confirm the function fails fast rather than retrying behind the scenes.
    mockFetch.mockRejectedValue(new Error('Network request failed'));

    await expect(getPlantTips(PLANT_NAME)).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
