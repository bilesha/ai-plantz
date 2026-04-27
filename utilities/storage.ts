import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlantEntry } from "../types";
const STORAGE_KEY = "plantHistory";

export const savePlant = async (newEntry: PlantEntry) => {
  const existing = await AsyncStorage.getItem(STORAGE_KEY);
  const parsed: PlantEntry[] = existing ? JSON.parse(existing) : [];
  
  // Filter out the old version of this plant if it exists, then add the new one to the top
  const updated = [newEntry, ...parsed.filter(p => p.name !== newEntry.name)];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};

export const getHistory = async (): Promise<PlantEntry[]> => {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};