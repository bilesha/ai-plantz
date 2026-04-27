// __tests__/history.test.ts
import { sortHistoryByDate, toggleFavoriteLogic } from '../logic/historyLogic';

describe('Toggle Favourite', () => {
  const baseHistory = [
    { name: 'Monstera', isFavorite: false, lastViewed: 100 },
    { name: 'Cactus',   isFavorite: false, lastViewed: 200 },
  ] as any;

  test('flips isFavorite from false to true for the named plant', () => {
    const result = toggleFavoriteLogic(baseHistory, 'Monstera');
    expect(result.find((p: any) => p.name === 'Monstera')!.isFavorite).toBe(true);
  });

  test('flips isFavorite from true back to false (toggle, not set)', () => {
    const alreadyFavourited = [
      { name: 'Monstera', isFavorite: true, lastViewed: 100 },
    ] as any;
    const result = toggleFavoriteLogic(alreadyFavourited, 'Monstera');
    expect(result[0].isFavorite).toBe(false);
  });

  test('leaves all other entries unchanged', () => {
    const result = toggleFavoriteLogic(baseHistory, 'Monstera');
    expect(result.find((p: any) => p.name === 'Cactus')!.isFavorite).toBe(false);
  });

  test('returns the array unchanged when the plant name is not found', () => {
    const result = toggleFavoriteLogic(baseHistory, 'Orchid');
    expect(result).toEqual(baseHistory);
  });
});

describe('History Sorting', () => {
  test('should sort history by lastViewed descending', () => {
    const mockData = [
      { name: 'Old', isFavorite: false, lastViewed: 100 },
      { name: 'New', isFavorite: false, lastViewed: 200 }
    ] as any;
    
    const sorted = sortHistoryByDate(mockData);
    
    // Verify the order
    expect(sorted[0].name).toBe('New'); // Newest (200) first
    expect(sorted[1].name).toBe('Old');
  });
});