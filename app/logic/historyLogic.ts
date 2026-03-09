import { PlantEntry } from "../types";

export const toggleFavoriteLogic = (history: PlantEntry[], plantName: string): PlantEntry[] => {
  return history.map((item) => {
    if (item.name === plantName) {
      return { ...item, isFavorite: !item.isFavorite };
    }
    return item;
  });
};

export const sortHistoryByDate = (history: PlantEntry[]): PlantEntry[] => {
  return [...history].sort((a, b) => b.lastViewed - a.lastViewed);
};