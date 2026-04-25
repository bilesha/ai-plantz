// __tests__/cacheLogic.test.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPlantDetailsFromCache, savePlantDetailsToCache } from '../app/logic/cacheLogic';

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
    const data = { watering: 'Weekly', light: 'Bright indirect' };
    await AsyncStorage.setItem('cache_Monstera', JSON.stringify(data));

    const result = await getPlantDetailsFromCache('Monstera');

    // The function must deserialise the stored string back into an object.
    // toEqual does a deep value comparison, so {watering:'Weekly'} === {watering:'Weekly'}.
    expect(result).toEqual(data);
  });

  test('uses the key cache_<plantName> — not just the plant name', async () => {
    // This guards against a regression where the prefix is dropped.
    // We write to the bare key 'Monstera' and confirm the function does NOT
    // return it — because it should be looking for 'cache_Monstera'.
    await AsyncStorage.setItem('Monstera', JSON.stringify({ watering: 'Never' }));

    const result = await getPlantDetailsFromCache('Monstera');

    expect(result).toBeNull();
  });

  test('handles a plant name with spaces correctly', async () => {
    // Plant names from the UI can contain spaces ("Snake Plant").
    // The key becomes 'cache_Snake Plant' — confirm the round-trip works.
    const data = { watering: 'Monthly' };
    await AsyncStorage.setItem('cache_Snake Plant', JSON.stringify(data));

    const result = await getPlantDetailsFromCache('Snake Plant');

    expect(result).toEqual(data);
  });
});

describe('savePlantDetailsToCache', () => {
  test('stores the data so a subsequent get returns it', async () => {
    // The most important integration check: save then read, confirm the data
    // survives the round-trip through JSON serialisation and deserialisation.
    const data = { watering: 'Weekly', light: 'Low', fertilizer: 'Spring only' };

    await savePlantDetailsToCache('Cactus', data);
    const result = await getPlantDetailsFromCache('Cactus');

    expect(result).toEqual(data);
  });

  test('overwrites a previously cached value for the same plant', async () => {
    // The cache should be a simple last-write-wins store. If the AI returns
    // updated data for a plant we already cached, the new data replaces the old.
    const original = { watering: 'Daily' };
    const updated  = { watering: 'Weekly' };

    await savePlantDetailsToCache('Fern', original);
    await savePlantDetailsToCache('Fern', updated);

    const result = await getPlantDetailsFromCache('Fern');
    expect(result).toEqual(updated);
  });

  test('caches each plant under its own independent key', async () => {
    // Saving data for "Cactus" must not affect the cache for "Fern".
    // This would break if the key ignored the plant name (e.g. always 'cache_').
    await savePlantDetailsToCache('Cactus', { watering: 'Monthly' });
    await savePlantDetailsToCache('Fern',   { watering: 'Daily' });

    const cactusTips = await getPlantDetailsFromCache('Cactus');
    const fernTips   = await getPlantDetailsFromCache('Fern');

    expect(cactusTips.watering).toBe('Monthly');
    expect(fernTips.watering).toBe('Daily');
  });

  test('serialises nested objects without data loss', async () => {
    // The real API response is a nested object with a details sub-object.
    // Confirm that deep nesting survives JSON.stringify → JSON.parse.
    const data = {
      summary: 'Easy to care for',
      details: { watering: 'Low', light: 'Any', fertilizer: 'None' },
    };

    await savePlantDetailsToCache('ZZ Plant', data);
    const result = await getPlantDetailsFromCache('ZZ Plant');

    expect(result.details.light).toBe('Any');
  });
});
