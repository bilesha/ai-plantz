import { supabase } from '../lib/supabase';

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export type NotificationItem = {
  id: string;
  type: string;
  read: boolean;
  created_at: string;
  actor_id: string;
  username: string | null;
  avatar_url: string | null;
};

export async function getNotifications(): Promise<NotificationItem[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const { data: notifs, error } = await supabase
    .from('notifications')
    .select('id, type, read, created_at, actor_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !notifs || notifs.length === 0) return [];

  const actorIds = [...new Set(notifs.map((n: any) => n.actor_id as string))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', actorIds);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  return notifs.map((n: any) => {
    const profile = profileMap.get(n.actor_id);
    return {
      id:         n.id,
      type:       n.type,
      read:       n.read,
      created_at: n.created_at,
      actor_id:   n.actor_id,
      username:   profile?.username ?? null,
      avatar_url: profile?.avatar_url ?? null,
    };
  });
}

export async function markAllRead(): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
}

export async function getUnreadCount(): Promise<number> {
  const userId = await getUserId();
  if (!userId) return 0;
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  return count ?? 0;
}
