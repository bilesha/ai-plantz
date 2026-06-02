import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CollectionEntry, OwnershipStatus } from '../types';

const COLLECTION_KEY = 'plantCollection';

export async function getCollection(): Promise<CollectionEntry[]> {
  try {
    const stored = await AsyncStorage.getItem(COLLECTION_KEY);
    if (!stored) return [];
    const entries = JSON.parse(stored) as CollectionEntry[];
    // migrate entries that predate the status field
    return entries.map(e => ({ status: 'own' as OwnershipStatus, ...e }));
  } catch {
    return [];
  }
}

export async function getCollectionEntry(name: string): Promise<CollectionEntry | null> {
  const current = await getCollection();
  return current.find(p => p.name.toLowerCase() === name.toLowerCase()) ?? null;
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

export async function updateCollectionEntry(
  name: string,
  patch: Partial<Pick<CollectionEntry, 'status' | 'rating' | 'notes'>>,
): Promise<void> {
  const current = await getCollection();
  const updated = current.map(p =>
    p.name.toLowerCase() === name.toLowerCase() ? { ...p, ...patch } : p,
  );
  await AsyncStorage.setItem(COLLECTION_KEY, JSON.stringify(updated));
}

export async function isInCollection(name: string): Promise<boolean> {
  const current = await getCollection();
  return current.some(p => p.name.toLowerCase() === name.toLowerCase());
}