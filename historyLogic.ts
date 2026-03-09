// app/historyLogic.ts
import { PlantEntry } from "./app/types"; // Adjust this path if this file is in the 'app' folder

export const toggleFavoriteLogic = (history: PlantEntry[], plantName: string): PlantEntry[] => {
  return history.map((item) => {
    if (item.name === plantName) {
      return { ...item, isFavorite: !item.isFavorite };
    }
    return item;
  });
};

// Use lastViewed instead of timestamp
export const sortHistoryByDate = (history: PlantEntry[]): PlantEntry[] => {
  return [...history].sort((a, b) => b.lastViewed - a.lastViewed);
};