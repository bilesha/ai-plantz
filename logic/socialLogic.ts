import { supabase } from '../lib/supabase';

async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export type CommentItem = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
};

export async function getLikes(
  plantOwnerUserId: string,
  plantName: string,
): Promise<{ count: number; hasLiked: boolean }> {
  const userId = await getCurrentUserId();

  const { count } = await supabase
    .from('plant_likes')
    .select('*', { count: 'exact', head: true })
    .eq('plant_owner_id', plantOwnerUserId)
    .eq('plant_name', plantName);

  if (!userId) return { count: count ?? 0, hasLiked: false };

  const { data } = await supabase
    .from('plant_likes')
    .select('id')
    .eq('plant_owner_id', plantOwnerUserId)
    .eq('plant_name', plantName)
    .eq('user_id', userId)
    .maybeSingle();

  return { count: count ?? 0, hasLiked: data !== null };
}

export async function toggleLike(
  plantOwnerUserId: string,
  plantName: string,
): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  const { data: existing } = await supabase
    .from('plant_likes')
    .select('id')
    .eq('plant_owner_id', plantOwnerUserId)
    .eq('plant_name', plantName)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supabase.from('plant_likes').delete().eq('id', existing.id);
    return false;
  }

  await supabase.from('plant_likes').insert({
    user_id:         userId,
    plant_owner_id:  plantOwnerUserId,
    plant_name:      plantName,
  });
  return true;
}

export async function getComments(
  plantOwnerUserId: string,
  plantName: string,
): Promise<CommentItem[]> {
  const { data: comments, error } = await supabase
    .from('plant_comments')
    .select('id, body, created_at, user_id')
    .eq('plant_owner_id', plantOwnerUserId)
    .eq('plant_name', plantName)
    .order('created_at', { ascending: true });

  if (error || !comments || comments.length === 0) return [];

  const userIds = [...new Set(comments.map((c: any) => c.user_id as string))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', userIds);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  return comments.map((c: any) => {
    const profile = profileMap.get(c.user_id);
    return {
      id:         c.id,
      body:       c.body,
      created_at: c.created_at,
      user_id:    c.user_id,
      username:   profile?.username ?? null,
      avatar_url: profile?.avatar_url ?? null,
    };
  });
}

export async function addComment(
  plantOwnerUserId: string,
  plantName: string,
  body: string,
): Promise<CommentItem | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('plant_comments')
    .insert({
      user_id:        userId,
      plant_owner_id: plantOwnerUserId,
      plant_name:     plantName,
      body:           body.trim(),
    })
    .select('id, body, created_at, user_id')
    .single();

  if (error || !data) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, avatar_url')
    .eq('id', userId)
    .maybeSingle();

  return {
    id:         (data as any).id,
    body:       (data as any).body,
    created_at: (data as any).created_at,
    user_id:    (data as any).user_id,
    username:   (profile as any)?.username ?? null,
    avatar_url: (profile as any)?.avatar_url ?? null,
  };
}

export async function deleteComment(commentId: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await supabase
    .from('plant_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId);
}
