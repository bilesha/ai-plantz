import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_ENTRIES = 30;

function storageKey(plantName: string): string {
  return `wateringLog_${plantName}`;
}

export async function logWatering(plantName: string): Promise<void> {
  const log = await getWateringLog(plantName);
  const updated = [Date.now(), ...log].slice(0, MAX_ENTRIES);
  await AsyncStorage.setItem(storageKey(plantName), JSON.stringify(updated));
}

export async function getWateringLog(plantName: string): Promise<number[]> {
  const stored = await AsyncStorage.getItem(storageKey(plantName));
  return stored ? JSON.parse(stored) : [];
}

export async function clearWateringLog(plantName: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(plantName));
}

export function formatRelativeDate(timestamp: number): string {
  const diffDays = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return '1 month ago';
  return `${Math.floor(diffDays / 30)} months ago`;
}
