import { supabase } from '../lib/supabase';

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

// ─── Badge definitions (single source of truth for UI + logic) ───────────────

export type BadgeDef = {
  key: string;
  emoji: string;
  name: string;
  description: string;
};

export const ALL_BADGES: BadgeDef[] = [
  { key: 'first_plant',        emoji: '🌱', name: 'First Plant',       description: 'Added your first plant to collection' },
  { key: 'plant_collector_5',  emoji: '🪴', name: 'Collector',         description: '5 plants in your collection' },
  { key: 'plant_collector_20', emoji: '🌿', name: 'Green Thumb',       description: '20 plants in your collection' },
  { key: 'health_logger',      emoji: '📋', name: 'Health Logger',     description: 'Logged your first plant health entry' },
  { key: 'photographer',       emoji: '📷', name: 'Photographer',      description: 'Uploaded your first plant photo' },
  { key: 'streak_7',           emoji: '🔥', name: 'Week Warrior',      description: '7-day activity streak' },
  { key: 'streak_30',          emoji: '🏆', name: 'Monthly Master',    description: '30-day activity streak' },
  { key: 'diagnosed',          emoji: '🔬', name: 'Plant Doctor',      description: 'Diagnosed a plant with a photo' },
  { key: 'social_butterfly',   emoji: '🤝', name: 'Social Butterfly',  description: 'Created your first marketplace listing' },
];

// ─── Supabase row types ───────────────────────────────────────────────────────

export type StreakData = {
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
};

export type EarnedBadge = {
  badge_key: string;
  earned_at: string;
};

// ─── Streaks ──────────────────────────────────────────────────────────────────

export async function recordActivity(): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const { data: existing } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!existing) {
    await supabase.from('user_streaks').insert({
      user_id: userId,
      current_streak: 1,
      longest_streak: 1,
      last_activity_date: today,
    });
    return;
  }

  const row = existing as StreakData & { user_id: string };

  if (row.last_activity_date === today) return; // already counted today

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const newStreak = row.last_activity_date === yesterdayStr
    ? row.current_streak + 1
    : 1;

  const longestStreak = Math.max(newStreak, row.longest_streak);

  await supabase
    .from('user_streaks')
    .update({ current_streak: newStreak, longest_streak: longestStreak, last_activity_date: today })
    .eq('user_id', userId);
}

export async function getStreakData(): Promise<StreakData> {
  const userId = await getUserId();
  if (!userId) return { current_streak: 0, longest_streak: 0, last_activity_date: null };

  const { data } = await supabase
    .from('user_streaks')
    .select('current_streak, longest_streak, last_activity_date')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return { current_streak: 0, longest_streak: 0, last_activity_date: null };
  return data as StreakData;
}

// ─── Badges ───────────────────────────────────────────────────────────────────

export async function checkAndAwardBadges(context: {
  collectionCount?: number;
  hasHealthLog?: boolean;
  hasPhoto?: boolean;
  hasListing?: boolean;
  hasDiagnosis?: boolean;
}): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const { data: streakRow } = await supabase
    .from('user_streaks')
    .select('current_streak')
    .eq('user_id', userId)
    .maybeSingle();

  const streak = (streakRow as { current_streak: number } | null)?.current_streak ?? 0;

  const conditions: { key: string; met: boolean }[] = [
    { key: 'first_plant',        met: (context.collectionCount ?? 0) >= 1  },
    { key: 'plant_collector_5',  met: (context.collectionCount ?? 0) >= 5  },
    { key: 'plant_collector_20', met: (context.collectionCount ?? 0) >= 20 },
    { key: 'health_logger',      met: context.hasHealthLog === true         },
    { key: 'photographer',       met: context.hasPhoto === true             },
    { key: 'streak_7',           met: streak >= 7                          },
    { key: 'streak_30',          met: streak >= 30                         },
    { key: 'diagnosed',          met: context.hasDiagnosis === true         },
    { key: 'social_butterfly',   met: context.hasListing === true           },
  ];

  const toAward = conditions.filter(c => c.met);
  if (toAward.length === 0) return;

  await supabase
    .from('user_badges')
    .upsert(
      toAward.map(c => ({ user_id: userId, badge_key: c.key })),
      { onConflict: 'user_id,badge_key', ignoreDuplicates: true },
    );
}

export async function getBadges(userId?: string): Promise<EarnedBadge[]> {
  const uid = userId ?? (await getUserId());
  if (!uid) return [];

  const { data, error } = await supabase
    .from('user_badges')
    .select('badge_key, earned_at')
    .eq('user_id', uid)
    .order('earned_at', { ascending: true });

  if (error || !data) return [];
  return data as EarnedBadge[];
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function updateLeaderboard(): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const [collectionRes, streakRes, badgeRes, profileRes] = await Promise.all([
    supabase.from('plant_collection').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('user_streaks').select('current_streak').eq('user_id', userId).maybeSingle(),
    supabase.from('user_badges').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('profiles').select('username, avatar_url').eq('id', userId).maybeSingle(),
  ]);

  const collectionCount = collectionRes.count ?? 0;
  const streak = (streakRes.data as { current_streak: number } | null)?.current_streak ?? 0;
  const badgeCount = badgeRes.count ?? 0;
  const username = (profileRes.data as { username: string | null; avatar_url: string | null } | null)?.username ?? 'Plant Lover';
  const avatarUrl = (profileRes.data as { username: string | null; avatar_url: string | null } | null)?.avatar_url ?? null;

  const score = collectionCount * 10 + streak * 5 + badgeCount * 20;

  await supabase.from('leaderboard').upsert(
    {
      user_id:          userId,
      username,
      avatar_url:       avatarUrl,
      collection_count: collectionCount,
      streak,
      badge_count:      badgeCount,
      score,
      updated_at:       new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
}
