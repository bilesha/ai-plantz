import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CollectionEntry } from '../types';

const COLLECTION_KEY = 'plantCollection';

export async function getCollection(): Promise<CollectionEntry[]> {
  try {
    const stored = await AsyncStorage.getItem(COLLECTION_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function addToCollection(entry: CollectionEntry): Promise<void> {
  const current = await getCollection();
  const deduped = current.filter(p => p.name.toLowerCase() !== entry.name.toLowerCase());
  await AsyncStorage.setItem(COLLECTION_KEY, JSON.stringify([entry, ...deduped]));
}

export async function removeFromCollection(name: string): Promise<void> {
  const current = await getCollection();
  const updated = current.filter(p => p.name.toLowerCase() !== name.toLowerCase());
  await AsyncStorage.setItem(COLLECTION_KEY, JSON.stringify(updated));
}

export async function isInCollection(name: string): Promise<boolean> {
  const current = await getCollection();
  return current.some(p => p.name.toLowerCase() === name.toLowerCase());
}
