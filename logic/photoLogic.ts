import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';

export type PlantPhoto = {
  id: string;
  user_id: string;
  plant_name: string;
  photo_url: string;
  caption: string | null;
  taken_at: string;
  is_primary: boolean;
};

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export async function getPlantPhotos(plantName: string, userId?: string): Promise<PlantPhoto[]> {
  const uid = userId ?? (await getUserId());
  if (!uid) return [];

  const { data, error } = await supabase
    .from('plant_photos')
    .select('*')
    .eq('user_id', uid)
    .ilike('plant_name', plantName)
    .order('is_primary', { ascending: false })
    .order('taken_at', { ascending: false });

  if (error || !data) return [];
  return data as PlantPhoto[];
}

export async function uploadPlantPhoto(plantName: string, uri: string, caption?: string): Promise<PlantPhoto | null> {
  const userId = await getUserId();
  if (!userId) return null;

  try {
    const timestamp = Date.now();
    const path = `${userId}/${plantName}/${timestamp}.jpg`;

    let uploadData: ArrayBuffer;
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      uploadData = await blob.arrayBuffer();
    } else {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      uploadData = decode(base64);
    }

    const { error: storageError } = await supabase.storage
      .from('plant-photos')
      .upload(path, uploadData, { contentType: 'image/jpeg', upsert: false });

    if (storageError) throw new Error(storageError.message);

    const { data: { publicUrl } } = supabase.storage.from('plant-photos').getPublicUrl(path);

    const { count } = await supabase
      .from('plant_photos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .ilike('plant_name', plantName);

    const isFirst = (count ?? 0) === 0;

    const { data, error } = await supabase
      .from('plant_photos')
      .insert({
        user_id: userId,
        plant_name: plantName,
        photo_url: publicUrl,
        caption: caption ?? null,
        is_primary: isFirst,
      })
      .select()
      .single();

    if (error || !data) return null;

    if (isFirst) {
      supabase
        .from('plant_collection')
        .update({ photo_url: publicUrl })
        .eq('user_id', userId)
        .ilike('plant_name', plantName)
        .then(() => {});
    }

    return data as PlantPhoto;
  } catch (e) {
    console.error('[photoLogic] upload error:', e);
    return null;
  }
}

export async function deletePhoto(id: string, photoUrl: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const { data: photo } = await supabase
    .from('plant_photos')
    .select('*')
    .eq('id', id)
    .single();

  if (!photo) return;
  const p = photo as PlantPhoto;

  await supabase.from('plant_photos').delete().eq('id', id);

  try {
    const url = new URL(photoUrl);
    const marker = '/plant-photos/';
    const idx = url.pathname.indexOf(marker);
    if (idx !== -1) {
      await supabase.storage.from('plant-photos').remove([url.pathname.slice(idx + marker.length)]);
    }
  } catch {}

  if (!p.is_primary) return;

  const { data: remaining } = await supabase
    .from('plant_photos')
    .select('*')
    .eq('user_id', userId)
    .ilike('plant_name', p.plant_name)
    .order('taken_at', { ascending: false })
    .limit(1);

  if (remaining && remaining.length > 0) {
    await supabase.from('plant_photos').update({ is_primary: true }).eq('id', remaining[0].id);
    supabase
      .from('plant_collection')
      .update({ photo_url: remaining[0].photo_url })
      .eq('user_id', userId)
      .ilike('plant_name', p.plant_name)
      .then(() => {});
  } else {
    supabase
      .from('plant_collection')
      .update({ photo_url: null })
      .eq('user_id', userId)
      .ilike('plant_name', p.plant_name)
      .then(() => {});
  }
}

export async function setPrimaryPhoto(id: string, plantName: string, photoUrl: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  await supabase
    .from('plant_photos')
    .update({ is_primary: false })
    .eq('user_id', userId)
    .ilike('plant_name', plantName);

  await supabase.from('plant_photos').update({ is_primary: true }).eq('id', id);

  supabase
    .from('plant_collection')
    .update({ photo_url: photoUrl })
    .eq('user_id', userId)
    .ilike('plant_name', plantName)
    .then(() => {});
}
