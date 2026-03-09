// __tests__/history.test.ts
import { sortHistoryByDate } from '../historyLogic'; // Point to the file location

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