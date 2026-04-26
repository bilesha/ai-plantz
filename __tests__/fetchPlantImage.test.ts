import { fetchPlantImage } from '../utilities/fetchPlantImage';

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

function makeFakeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('fetchPlantImage — successful responses', () => {
  test('returns thumbnail.source when Wikipedia returns an image', async () => {
    mockFetch.mockResolvedValue(
      makeFakeResponse({ thumbnail: { source: 'https://upload.wikimedia.org/monstera.jpg' } })
    );

    expect(await fetchPlantImage('Monstera')).toBe('https://upload.wikimedia.org/monstera.jpg');
  });

  test('returns null when the response has no thumbnail field', async () => {
    mockFetch.mockResolvedValue(makeFakeResponse({ title: 'Monstera', extract: 'A tropical plant.' }));

    expect(await fetchPlantImage('Monstera')).toBeNull();
  });

  test('returns null when thumbnail exists but has no source field', async () => {
    mockFetch.mockResolvedValue(makeFakeResponse({ thumbnail: { width: 320, height: 240 } }));

    expect(await fetchPlantImage('Monstera')).toBeNull();
  });
});

describe('fetchPlantImage — failure cases', () => {
  test('returns null when the HTTP response is not ok (404)', async () => {
    mockFetch.mockResolvedValue(makeFakeResponse({ title: 'Not found' }, 404));

    expect(await fetchPlantImage('Monstera')).toBeNull();
  });

  test('returns null when fetch throws a network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network request failed'));

    expect(await fetchPlantImage('Monstera')).toBeNull();
  });

  test('returns null on a 500 server error', async () => {
    mockFetch.mockResolvedValue(makeFakeResponse({}, 500));

    expect(await fetchPlantImage('Monstera')).toBeNull();
  });
});

describe('fetchPlantImage — request construction', () => {
  test('URL-encodes spaces in the plant name', async () => {
    mockFetch.mockResolvedValue(makeFakeResponse({ thumbnail: { source: 'http://img.jpg' } }));

    await fetchPlantImage('Fiddle Leaf Fig');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('Fiddle%20Leaf%20Fig')
    );
  });

  test('calls the Wikipedia REST summary endpoint', async () => {
    mockFetch.mockResolvedValue(makeFakeResponse({ thumbnail: { source: 'http://img.jpg' } }));

    await fetchPlantImage('Pothos');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('en.wikipedia.org/api/rest_v1/page/summary')
    );
  });
});
