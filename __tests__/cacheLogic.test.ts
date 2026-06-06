// __tests__/cacheLogic.test.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getPlantDetailsFromCache,
  savePlantDetailsToCache,
  getPlantImageFromCache,
  savePlantImageToCache,
} from '../logic/cacheLogic';
import { PlantDetails } from '../types';

// Jest replaces the real AsyncStorage module with this official in-memory mock
// from the package itself. It behaves exactly like AsyncStorage but stores
// values in a plain JS object instead of the device — no real I/O, runs fast.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// beforeEach wipes the mock storage before every single test runs.
// Without this, data written in test 1 would bleed into test 2 and make tests
// order-dependent — a classic source of flaky test suites.
beforeEach(async () => {
  await AsyncStorage.clear();
});

// Reusable fixture — matches the PlantDetails type exactly.
const MONSTERA: PlantDetails = { watering: 'Weekly', light: 'Bright indirect', fertilizer: 'Spring only' };

describe('getPlantDetailsFromCache', () => {
  test('returns null when nothing has been cached for that plant', async () => {
    const result = await getPlantDetailsFromCache('Monstera', 'gemini');
    expect(result).toBeNull();
  });

  test('returns the parsed object after a value has been saved', async () => {
    await AsyncStorage.setItem('cache_Monstera_gemini', JSON.stringify(MONSTERA));

    const result = await getPlantDetailsFromCache('Monstera', 'gemini');

    expect(result).toEqual(MONSTERA);
  });

  test('uses the key cache_<plantName>_<provider> — not just the plant name', async () => {
    // Writing to a bare key must not be returned by the cache reader.
    await AsyncStorage.setItem('Monstera', JSON.stringify(MONSTERA));

    const result = await getPlantDetailsFromCache('Monstera', 'gemini');

    expect(result).toBeNull();
  });

  test('is isolated per provider — groq cache does not satisfy a gemini read', async () => {
    await AsyncStorage.setItem('cache_Monstera_groq', JSON.stringify(MONSTERA));

    const result = await getPlantDetailsFromCache('Monstera', 'gemini');

    expect(result).toBeNull();
  });

  test('handles a plant name with spaces correctly', async () => {
    const data: PlantDetails = { watering: 'Monthly', light: 'Low', fertilizer: 'None' };
    await AsyncStorage.setItem('cache_Snake Plant_gemini', JSON.stringify(data));

    const result = await getPlantDetailsFromCache('Snake Plant', 'gemini');

    expect(result).toEqual(data);
  });
});

describe('savePlantDetailsToCache', () => {
  test('stores the data so a subsequent get returns it', async () => {
    await savePlantDetailsToCache('Cactus', 'gemini', MONSTERA);
    const result = await getPlantDetailsFromCache('Cactus', 'gemini');

    expect(result).toEqual(MONSTERA);
  });

  test('overwrites a previously cached value for the same plant and provider', async () => {
    const original: PlantDetails = { watering: 'Daily', light: 'Full sun', fertilizer: 'Monthly' };
    const updated: PlantDetails  = { watering: 'Weekly', light: 'Shade', fertilizer: 'Never' };

    await savePlantDetailsToCache('Fern', 'gemini', original);
    await savePlantDetailsToCache('Fern', 'gemini', updated);

    const result = await getPlantDetailsFromCache('Fern', 'gemini');
    expect(result).toEqual(updated);
  });

  test('caches each plant under its own independent key', async () => {
    const cactusData: PlantDetails = { watering: 'Monthly', light: 'Full sun', fertilizer: 'Rarely' };
    const fernData: PlantDetails   = { watering: 'Daily',   light: 'Shade',    fertilizer: 'Monthly' };

    await savePlantDetailsToCache('Cactus', 'gemini', cactusData);
    await savePlantDetailsToCache('Fern', 'gemini', fernData);

    const cactusTips = await getPlantDetailsFromCache('Cactus', 'gemini');
    const fernTips   = await getPlantDetailsFromCache('Fern', 'gemini');

    expect(cactusTips!.watering).toBe('Monthly');
    expect(fernTips!.watering).toBe('Daily');
  });

  test('different providers produce independent cache entries for the same plant', async () => {
    const geminiData: PlantDetails = { watering: 'Weekly', light: 'Indirect', fertilizer: 'Monthly' };
    const groqData: PlantDetails   = { watering: 'Daily',  light: 'Full sun', fertilizer: 'Never' };

    await savePlantDetailsToCache('Monstera', 'gemini', geminiData);
    await savePlantDetailsToCache('Monstera', 'groq', groqData);

    expect(await getPlantDetailsFromCache('Monstera', 'gemini')).toEqual(geminiData);
    expect(await getPlantDetailsFromCache('Monstera', 'groq')).toEqual(groqData);
  });

  test('all three fields survive the JSON round-trip intact', async () => {
    const data: PlantDetails = { watering: 'Low', light: 'Any', fertilizer: 'None' };

    await savePlantDetailsToCache('ZZ Plant', 'gemini', data);
    const result = await getPlantDetailsFromCache('ZZ Plant', 'gemini');

    expect(result!.watering).toBe('Low');
    expect(result!.light).toBe('Any');
    expect(result!.fertilizer).toBe('None');
  });
});

describe('getPlantImageFromCache', () => {
  test('returns undefined when the key has never been written (not-yet-fetched)', async () => {
    expect(await getPlantImageFromCache('Monstera')).toBeUndefined();
  });

  test('returns null when the key was saved as "no image" (sentinel value)', async () => {
    await AsyncStorage.setItem('image_Monstera', '__no_image__');
    expect(await getPlantImageFromCache('Monstera')).toBeNull();
  });

  test('returns the URL string when a real image URL is stored', async () => {
    await AsyncStorage.setItem('image_Monstera', 'https://upload.wikimedia.org/monstera.jpg');
    expect(await getPlantImageFromCache('Monstera')).toBe('https://upload.wikimedia.org/monstera.jpg');
  });

  test('uses the key image_<plantName> — not a bare plant name', async () => {
    await AsyncStorage.setItem('Monstera', 'https://example.com/img.jpg');
    expect(await getPlantImageFromCache('Monstera')).toBeUndefined();
  });
});

describe('savePlantImageToCache', () => {
  test('round-trip: saving a URL and reading it back returns the same URL', async () => {
    await savePlantImageToCache('Pothos', 'https://upload.wikimedia.org/pothos.jpg');
    expect(await getPlantImageFromCache('Pothos')).toBe('https://upload.wikimedia.org/pothos.jpg');
  });

  test('round-trip: saving null and reading it back returns null (not undefined)', async () => {
    await savePlantImageToCache('Rare Plant', null);
    expect(await getPlantImageFromCache('Rare Plant')).toBeNull();
  });

  test('overwrites a previous URL with a new one', async () => {
    await savePlantImageToCache('Fern', 'https://old.jpg');
    await savePlantImageToCache('Fern', 'https://new.jpg');
    expect(await getPlantImageFromCache('Fern')).toBe('https://new.jpg');
  });

  test('caches each plant under its own independent key', async () => {
    await savePlantImageToCache('Cactus', 'https://cactus.jpg');
    await savePlantImageToCache('Fern', null);

    expect(await getPlantImageFromCache('Cactus')).toBe('https://cactus.jpg');
    expect(await getPlantImageFromCache('Fern')).toBeNull();
  });
});
