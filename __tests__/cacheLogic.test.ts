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
    // The storage is empty (cleared above). getItem returns null for a missing
    // key, and the function should pass that null straight through to the caller
    // so the caller knows there is no cache hit.
    const result = await getPlantDetailsFromCache('Monstera');
    expect(result).toBeNull();
  });

  test('returns the parsed object after a value has been saved', async () => {
    // First seed the cache manually via AsyncStorage so this test is isolated
    // from savePlantDetailsToCache (we are testing the reader, not the writer).
    // JSON.stringify mirrors what the real code stores.
    await AsyncStorage.setItem('cache_Monstera', JSON.stringify(MONSTERA));

    const result = await getPlantDetailsFromCache('Monstera');

    // The function must deserialise the stored string back into an object.
    // toEqual does a deep value comparison.
    expect(result).toEqual(MONSTERA);
  });

  test('uses the key cache_<plantName> — not just the plant name', async () => {
    // This guards against a regression where the prefix is dropped.
    // We write to the bare key 'Monstera' and confirm the function does NOT
    // return it — because it should be looking for 'cache_Monstera'.
    await AsyncStorage.setItem('Monstera', JSON.stringify(MONSTERA));

    const result = await getPlantDetailsFromCache('Monstera');

    expect(result).toBeNull();
  });

  test('handles a plant name with spaces correctly', async () => {
    // Plant names from the UI can contain spaces ("Snake Plant").
    // The key becomes 'cache_Snake Plant' — confirm the round-trip works.
    const data: PlantDetails = { watering: 'Monthly', light: 'Low', fertilizer: 'None' };
    await AsyncStorage.setItem('cache_Snake Plant', JSON.stringify(data));

    const result = await getPlantDetailsFromCache('Snake Plant');

    expect(result).toEqual(data);
  });
});

describe('savePlantDetailsToCache', () => {
  test('stores the data so a subsequent get returns it', async () => {
    // The most important integration check: save then read, confirm the data
    // survives the round-trip through JSON serialisation and deserialisation.
    await savePlantDetailsToCache('Cactus', MONSTERA);
    const result = await getPlantDetailsFromCache('Cactus');

    expect(result).toEqual(MONSTERA);
  });

  test('overwrites a previously cached value for the same plant', async () => {
    // The cache should be a simple last-write-wins store. If the AI returns
    // updated data for a plant we already cached, the new data replaces the old.
    const original: PlantDetails = { watering: 'Daily', light: 'Full sun', fertilizer: 'Monthly' };
    const updated: PlantDetails  = { watering: 'Weekly', light: 'Shade', fertilizer: 'Never' };

    await savePlantDetailsToCache('Fern', original);
    await savePlantDetailsToCache('Fern', updated);

    const result = await getPlantDetailsFromCache('Fern');
    expect(result).toEqual(updated);
  });

  test('caches each plant under its own independent key', async () => {
    // Saving data for "Cactus" must not affect the cache for "Fern".
    // This would break if the key ignored the plant name (e.g. always 'cache_').
    const cactusData: PlantDetails = { watering: 'Monthly', light: 'Full sun', fertilizer: 'Rarely' };
    const fernData: PlantDetails   = { watering: 'Daily',   light: 'Shade',    fertilizer: 'Monthly' };

    await savePlantDetailsToCache('Cactus', cactusData);
    await savePlantDetailsToCache('Fern', fernData);

    const cactusTips = await getPlantDetailsFromCache('Cactus');
    const fernTips   = await getPlantDetailsFromCache('Fern');

    // ! asserts the result is non-null — we just saved these so we know they exist
    expect(cactusTips!.watering).toBe('Monthly');
    expect(fernTips!.watering).toBe('Daily');
  });

  test('all three fields survive the JSON round-trip intact', async () => {
    // Confirms that every field of PlantDetails survives JSON.stringify → JSON.parse
    // without being dropped, renamed, or coerced to a different type.
    const data: PlantDetails = { watering: 'Low', light: 'Any', fertilizer: 'None' };

    await savePlantDetailsToCache('ZZ Plant', data);
    const result = await getPlantDetailsFromCache('ZZ Plant');

    expect(result!.watering).toBe('Low');
    expect(result!.light).toBe('Any');
    expect(result!.fertilizer).toBe('None');
  });
});

describe('getPlantImageFromCache', () => {
  test('returns undefined when the key has never been written (not-yet-fetched)', async () => {
    // undefined means "go fetch from Wikipedia"; null means "fetched, no image found".
    // These two states must be distinguishable so we never skip a fetch that hasn't happened yet.
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
    // After a successful Wikipedia fetch that returned no image, we cache null so we
    // do not re-fetch on every visit. Reading back must return null, not undefined.
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
