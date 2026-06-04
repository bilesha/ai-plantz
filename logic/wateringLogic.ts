import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

// Run once in Supabase SQL editor:
//
//   create table watering_log (
//     id         uuid primary key default gen_random_uuid(),
//     user_id    uuid references auth.users(id) on delete cascade not null,
//     plant_name text not null,
//     watered_at timestamptz not null default now()
//   );
//   alter table watering_log enable row level security;
//   create policy "own rows only" on watering_log for all using (auth.uid() = user_id);

const MAX_ENTRIES = 30;

function localKey(plantName: string) {
  return `wateringLog_${plantName}`;
}

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export async function logWatering(plantName: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) {
    const log = await getWateringLog(plantName);
    const updated = [Date.now(), ...log].slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(localKey(plantName), JSON.stringify(updated));
    return;
  }

  supabase
    .from('watering_log')
    .insert({ user_id: userId, plant_name: plantName, watered_at: new Date().toISOString() })
    .then(({ error }) => {
      if (error) console.warn('[watering] log failed:', error.message);
    });
}

export async function getWateringLog(plantName: string): Promise<number[]> {
  const userId = await getUserId();
  if (!userId) {
    const stored = await AsyncStorage.getItem(localKey(plantName));
    return stored ? JSON.parse(stored) : [];
  }

  const { data, error } = await supabase
    .from('watering_log')
    .select('watered_at')
    .eq('user_id', userId)
    .ilike('plant_name', plantName)
    .order('watered_at', { ascending: false })
    .limit(MAX_ENTRIES);

  if (error || !data) return [];
  return (data as { watered_at: string }[]).map(r => new Date(r.watered_at).getTime());
}

export async function clearWateringLog(plantName: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) {
    await AsyncStorage.removeItem(localKey(plantName));
    return;
  }

  supabase
    .from('watering_log')
    .delete()
    .eq('user_id', userId)
    .ilike('plant_name', plantName)
    .then(({ error }) => {
      if (error) console.warn('[watering] clear failed:', error.message);
    });
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
