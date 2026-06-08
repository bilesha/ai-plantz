import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import type { CollectionEntry, OwnershipStatus, PlantDetails } from '../types';

// Run once in Supabase SQL editor to create the follows table:
//
//   create table follows (
//     id           uuid primary key default gen_random_uuid(),
//     follower_id  uuid references auth.users(id) on delete cascade not null,
//     following_id uuid references auth.users(id) on delete cascade not null,
//     created_at   timestamptz default now(),
//     constraint follows_unique unique (follower_id, following_id)
//   );
//   alter table follows enable row level security;
//   create policy "own follows only" on follows for all using (auth.uid() = follower_id);
//   create policy "public read" on follows for select using (true);

// Run once in Supabase SQL editor before using this module:
//
//   create table plant_collection (
//     id          uuid primary key default gen_random_uuid(),
//     user_id     uuid references auth.users(id) on delete cascade not null,
//     plant_name  text not null,
//     summary     text not null,
//     details     jsonb,
//     added_at    timestamptz not null default now(),
//     status      text not null check (status in ('own','want','tried')) default 'own',
//     rating      integer check (rating between 1 and 5),
//     notes       text,
//     constraint plant_collection_user_plant_unique unique (user_id, plant_name)
//   );
//   alter table plant_collection enable row level security;
//   create policy "own rows only" on plant_collection for all using (auth.uid() = user_id);

const LOCAL_KEY = 'plantCollection';
const MIGRATION_FLAG = 'collection_migrated_v1';

// ─── DB row type ──────────────────────────────────────────────────────────────

type CollectionRow = {
  plant_name: string;
  summary:    string;
  details:    PlantDetails | null;
  added_at:   string;
  status:     OwnershipStatus;
  rating:     number | null;
  notes:      string | null;
  photo_url:  string | null;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

// ─── Row mapping ──────────────────────────────────────────────────────────────

function toRow(userId: string, entry: CollectionEntry): CollectionRow & { user_id: string } {
  return {
    user_id:    userId,
    plant_name: entry.name,
    summary:    entry.summary,
    details:    entry.details ?? null,
    added_at:   new Date(entry.addedAt).toISOString(),
    status:     entry.status,
    rating:     entry.rating ?? null,
    notes:      entry.notes ?? null,
    photo_url:  entry.photo_url ?? null,
  };
}

function fromRow(row: CollectionRow): CollectionEntry {
  return {
    name:      row.plant_name,
    summary:   row.summary,
    details:   row.details ?? undefined,
    addedAt:   new Date(row.added_at).getTime(),
    status:    row.status,
    rating:    row.rating ?? undefined,
    notes:     row.notes ?? undefined,
    photo_url: row.photo_url ?? undefined,
  };
}

// ─── Local AsyncStorage (unauthenticated fallback) ────────────────────────────

async function getLocalCollection(): Promise<CollectionEntry[]> {
  try {
    const stored = await AsyncStorage.getItem(LOCAL_KEY);
    if (!stored) return [];
    const entries = JSON.parse(stored) as CollectionEntry[];
    return entries.map(e => ({ ...e, status: e.status ?? ('own' as OwnershipStatus) }));
  } catch {
    return [];
  }
}

async function saveLocalCollection(entries: CollectionEntry[]): Promise<void> {
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(entries));
}

// ─── Public API (signatures unchanged — callers need no updates) ──────────────

export async function getCollection(): Promise<CollectionEntry[]> {
  const userId = await getUserId();
  if (!userId) return getLocalCollection();

  const { data, error } = await supabase
    .from('plant_collection')
    .select('*')
    .eq('user_id', userId)
    .order('added_at', { ascending: false });

  if (error) return getLocalCollection();
  return (data as CollectionRow[]).map(fromRow);
}

export async function getCollectionEntry(name: string): Promise<CollectionEntry | null> {
  const userId = await getUserId();
  if (!userId) {
    const local = await getLocalCollection();
    return local.find(p => p.name.toLowerCase() === name.toLowerCase()) ?? null;
  }

  const { data, error } = await supabase
    .from('plant_collection')
    .select('*')
    .eq('user_id', userId)
    .ilike('plant_name', name)
    .maybeSingle();

  if (error || !data) return null;
  return fromRow(data as CollectionRow);
}

export async function addToCollection(entry: CollectionEntry): Promise<{ success: boolean; error?: string }> {
  const userId = await getUserId();
  if (!userId) {
    const current = await getLocalCollection();
    const deduped = current.filter(p => p.name.toLowerCase() !== entry.name.toLowerCase());
    await saveLocalCollection([entry, ...deduped]);
    return { success: true };
  }

  console.log('[collection] entry:', JSON.stringify(entry));
  console.log('[collection] userId:', userId);
  const { error } = await supabase
    .from('plant_collection')
    .upsert(toRow(userId, entry), { onConflict: 'user_id,plant_name' });

  if (error) {
    console.error('[collection] add failed:', error.message, error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function removeFromCollection(name: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) {
    const current = await getLocalCollection();
    return saveLocalCollection(current.filter(p => p.name.toLowerCase() !== name.toLowerCase()));
  }

  supabase
    .from('plant_collection')
    .delete()
    .eq('user_id', userId)
    .ilike('plant_name', name)
    .then(({ error }) => {
      if (error) console.warn('[collection] remove failed:', error.message);
    });
}

export async function updateCollectionEntry(
  name: string,
  patch: Partial<Pick<CollectionEntry, 'status' | 'rating' | 'notes'>>,
): Promise<void> {
  const userId = await getUserId();
  if (!userId) {
    const current = await getLocalCollection();
    return saveLocalCollection(
      current.map(p => p.name.toLowerCase() === name.toLowerCase() ? { ...p, ...patch } : p),
    );
  }

  supabase
    .from('plant_collection')
    .update({
      ...(patch.status !== undefined && { status: patch.status }),
      rating: patch.rating ?? null,
      notes:  patch.notes  ?? null,
    })
    .eq('user_id', userId)
    .ilike('plant_name', name)
    .then(({ error }) => {
      if (error) console.warn('[collection] update failed:', error.message);
    });
}

export async function isInCollection(name: string): Promise<boolean> {
  return (await getCollectionEntry(name)) !== null;
}

// Run in Supabase SQL editor to allow unauthenticated reads of other users' collections:
//   create policy "public read" on plant_collection for select using (true);
// The existing "own rows only" policy continues to govern INSERT/UPDATE/DELETE.
export async function getPublicCollection(userId: string): Promise<CollectionEntry[]> {
  const { data, error } = await supabase
    .from('plant_collection')
    .select('*')
    .eq('user_id', userId)
    .order('added_at', { ascending: false });

  if (error || !data) return [];
  return (data as CollectionRow[]).map(fromRow);
}

// ─── Photo upload ─────────────────────────────────────────────────────────────

export async function updatePhotoUrl(plantName: string, photoUrl: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  supabase
    .from('plant_collection')
    .update({ photo_url: photoUrl })
    .eq('user_id', userId)
    .ilike('plant_name', plantName)
    .then(({ error }) => {
      if (error) console.warn('[collection] photo_url update failed:', error.message);
    });
}

export async function uploadPlantPhoto(plantName: string, uri: string): Promise<string> {
  console.log('[uploadPlantPhoto] entry — plantName:', plantName, 'uri:', uri);
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');

  try {
    const path = `${userId}/${plantName}.jpg`;

    let uploadData: ArrayBuffer;
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      uploadData = await blob.arrayBuffer();
    } else {
      try {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        console.log('[uploadPlantPhoto] base64 read, length:', base64.length);
        uploadData = decode(base64);
      } catch (e: any) {
        throw new Error(`File read failed: ${e.message}`);
      }
    }

    const uploadResponse = await supabase.storage
      .from('plant-photos')
      .upload(path, uploadData, { contentType: 'image/jpeg', upsert: true });
    console.log('[uploadPlantPhoto] storage upload response:', uploadResponse);

    if (uploadResponse.error) throw new Error(`Storage upload failed: ${uploadResponse.error.message}`);

    const { data } = supabase.storage.from('plant-photos').getPublicUrl(path);
    console.log('[uploadPlantPhoto] public url:', data.publicUrl);
    await updatePhotoUrl(plantName, data.publicUrl);
    return data.publicUrl;
  } catch (e) {
    console.log('[uploadPlantPhoto] error:', e);
    throw e;
  }
}

// ─── One-time migration ───────────────────────────────────────────────────────

// Call once after SIGNED_IN. Copies any existing local collection to Supabase
// if the user's cloud collection is empty, then clears the local key.
// The migration flag makes every subsequent call a fast no-op.
export async function migrateLocalCollectionToSupabase(): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const alreadyDone = await AsyncStorage.getItem(MIGRATION_FLAG);
  if (alreadyDone) return;

  const localEntries = await getLocalCollection();

  if (localEntries.length === 0) {
    await AsyncStorage.setItem(MIGRATION_FLAG, '1');
    return;
  }

  // Don't overwrite if the user already has cloud data (e.g. from another device)
  const { data: existingRows } = await supabase
    .from('plant_collection')
    .select('plant_name')
    .eq('user_id', userId)
    .limit(1);

  if (existingRows && existingRows.length > 0) {
    await AsyncStorage.setItem(MIGRATION_FLAG, '1');
    return;
  }

  const { error } = await supabase
    .from('plant_collection')
    .insert(localEntries.map(e => toRow(userId, e)));

  if (!error) {
    await AsyncStorage.setItem(MIGRATION_FLAG, '1');
    await AsyncStorage.removeItem(LOCAL_KEY);
  }
}
