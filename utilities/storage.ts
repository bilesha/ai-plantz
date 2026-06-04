import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { PlantDetails, PlantEntry } from '../types';

// Run once in Supabase SQL editor:
//
//   create table plant_history (
//     id          uuid primary key default gen_random_uuid(),
//     user_id     uuid references auth.users(id) on delete cascade not null,
//     plant_name  text not null,
//     summary     text not null,
//     details     jsonb,
//     is_favorite boolean not null default false,
//     last_viewed timestamptz not null default now(),
//     constraint plant_history_user_plant_unique unique (user_id, plant_name)
//   );
//   alter table plant_history enable row level security;
//   create policy "own rows only" on plant_history for all using (auth.uid() = user_id);

const LOCAL_KEY = 'plantHistory';
const LOCAL_LIMIT = 10;

// ─── DB row type ──────────────────────────────────────────────────────────────

type HistoryRow = {
  plant_name:  string;
  summary:     string;
  details:     PlantDetails | null;
  is_favorite: boolean;
  last_viewed: string;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

// ─── Row mapping ──────────────────────────────────────────────────────────────

function toRow(userId: string, entry: PlantEntry): HistoryRow & { user_id: string } {
  return {
    user_id:     userId,
    plant_name:  entry.name,
    summary:     entry.summary,
    details:     entry.details ?? null,
    is_favorite: entry.isFavorite,
    last_viewed: new Date(entry.lastViewed).toISOString(),
  };
}

function fromRow(row: HistoryRow): PlantEntry {
  return {
    name:       row.plant_name,
    summary:    row.summary,
    details:    row.details ?? undefined,
    isFavorite: row.is_favorite,
    lastViewed: new Date(row.last_viewed).getTime(),
  };
}

// ─── Local AsyncStorage (unauthenticated fallback) ────────────────────────────

async function getLocalHistory(): Promise<PlantEntry[]> {
  const stored = await AsyncStorage.getItem(LOCAL_KEY);
  return stored ? JSON.parse(stored) : [];
}

async function saveLocalHistory(entries: PlantEntry[]): Promise<void> {
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(entries));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getHistory(): Promise<PlantEntry[]> {
  const userId = await getUserId();
  if (!userId) return getLocalHistory();

  const { data, error } = await supabase
    .from('plant_history')
    .select('*')
    .eq('user_id', userId)
    .order('last_viewed', { ascending: false })
    .limit(50);

  if (error) return getLocalHistory();
  return (data as HistoryRow[]).map(fromRow);
}

// Fire and forget — returns immediately so callers can update UI state optimistically.
export async function savePlant(entry: PlantEntry): Promise<void> {
  const userId = await getUserId();
  if (!userId) {
    const existing = await getLocalHistory();
    const updated = [entry, ...existing.filter(p => p.name !== entry.name)].slice(0, LOCAL_LIMIT);
    return saveLocalHistory(updated);
  }

  supabase
    .from('plant_history')
    .upsert(toRow(userId, entry), { onConflict: 'user_id,plant_name' })
    .then(({ error }) => {
      if (error) console.warn('[history] save failed:', error.message);
    });
}

export async function deleteHistoryItem(name: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) {
    const existing = await getLocalHistory();
    return saveLocalHistory(existing.filter(p => p.name !== name));
  }

  supabase
    .from('plant_history')
    .delete()
    .eq('user_id', userId)
    .ilike('plant_name', name)
    .then(({ error }) => {
      if (error) console.warn('[history] delete failed:', error.message);
    });
}

export async function clearHistory(): Promise<void> {
  const userId = await getUserId();
  if (!userId) {
    await AsyncStorage.removeItem(LOCAL_KEY);
    return;
  }

  supabase
    .from('plant_history')
    .delete()
    .eq('user_id', userId)
    .then(({ error }) => {
      if (error) console.warn('[history] clear failed:', error.message);
    });
}

export async function setFavorite(name: string, isFavorite: boolean): Promise<void> {
  const userId = await getUserId();
  if (!userId) {
    const existing = await getLocalHistory();
    return saveLocalHistory(existing.map(p => p.name === name ? { ...p, isFavorite } : p));
  }

  supabase
    .from('plant_history')
    .update({ is_favorite: isFavorite })
    .eq('user_id', userId)
    .ilike('plant_name', name)
    .then(({ error }) => {
      if (error) console.warn('[history] setFavorite failed:', error.message);
    });
}
