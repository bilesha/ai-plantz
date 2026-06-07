import { supabase } from '../lib/supabase';

async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export type FeedItem = {
  id: string;
  type: 'collection_add' | 'rating' | 'follow' | 'note' | 'like' | 'comment';
  actor_id: string;
  username: string | null;
  avatar_url: string | null;
  plant_name: string | null;
  plant_owner_id: string | null;
  rating: number | null;
  extra: string | null;       // comment body (comment type) or followed username (follow type)
  target_user_id: string | null;  // followed user's ID (follow type only)
  created_at: string;
};

export async function getFeed(limitCount = 30): Promise<FeedItem[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase.rpc('get_following_activity', {
    requesting_user_id: userId,
    limit_count: limitCount,
  });

  if (error || !data) return [];
  return data as FeedItem[];
}

const PLANT_ACTIVITY_TYPES: FeedItem['type'][] = [
  'collection_add', 'rating', 'note', 'like', 'comment',
];

export function formatActivityText(item: FeedItem): string {
  const who   = item.username ?? 'Someone';
  const plant = item.plant_name ?? 'a plant';

  switch (item.type) {
    case 'collection_add':
      return `${who} added ${plant} to their collection`;
    case 'rating':
      return `${who} rated ${plant} ${'★'.repeat(item.rating ?? 0)}`;
    case 'follow':
      return `${who} followed ${item.extra ?? 'someone'}`;
    case 'note':
      return `${who} left a note on ${plant}`;
    case 'like':
      return `${who} liked ${plant}`;
    case 'comment':
      return `${who} commented on ${plant}: “${item.extra ?? ''}”`;
    default:
      return `${who} updated ${plant}`;
  }
}

export { PLANT_ACTIVITY_TYPES };
