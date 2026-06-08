import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export async function uploadAvatar(uri: string): Promise<string> {
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');

  const path = `${userId}/avatar.jpg`;

  let uploadData: ArrayBuffer;
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    uploadData = await blob.arrayBuffer();
  } else {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      uploadData = decode(base64);
    } catch (e: any) {
      throw new Error(`File read failed: ${e.message}`);
    }
  }

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, uploadData, { contentType: 'image/jpeg', upsert: true });

  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: data.publicUrl })
    .eq('id', userId);

  if (updateError) throw new Error(`Profile update failed: ${updateError.message}`);

  return data.publicUrl;
}

export async function updateBio(bio: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('profiles')
    .update({ bio })
    .eq('id', userId);

  if (error) throw new Error(`Bio update failed: ${error.message}`);
}

export type ProfileStats = {
  followerCount: number;
  followingCount: number;
  plantCount: number;
  likesReceived: number;
};

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const [
    { count: followerCount },
    { count: followingCount },
    { count: plantCount },
    { count: likesReceived },
  ] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    supabase.from('plant_collection').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('plant_likes').select('*', { count: 'exact', head: true }).eq('plant_owner_id', userId),
  ]);

  return {
    followerCount: followerCount ?? 0,
    followingCount: followingCount ?? 0,
    plantCount: plantCount ?? 0,
    likesReceived: likesReceived ?? 0,
  };
}
