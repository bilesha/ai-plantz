import { supabase } from '../lib/supabase';

async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export async function followUser(followingId: string): Promise<void> {
  const followerId = await getCurrentUserId();
  if (!followerId) return;
  await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId });
}

export async function unfollowUser(followingId: string): Promise<void> {
  const followerId = await getCurrentUserId();
  if (!followerId) return;
  await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
}

export async function isFollowing(followingId: string): Promise<boolean> {
  const followerId = await getCurrentUserId();
  if (!followerId) return false;
  const { data } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();
  return data !== null;
}

export async function getFollowerCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', userId);
  return count ?? 0;
}

export async function getFollowingCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', userId);
  return count ?? 0;
}
