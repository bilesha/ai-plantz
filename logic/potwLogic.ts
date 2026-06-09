import { supabase } from '../lib/supabase';

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysFromMonday);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export type PotWNomination = {
  id: string;
  user_id: string;
  plant_name: string;
  reason: string | null;
  week_start: string;
  vote_count: number;
  hasVoted: boolean;
  username: string | null;
};

export async function getCurrentNominations(): Promise<PotWNomination[]> {
  const weekStart = getWeekStart();
  const userId = await getUserId();

  const { data: nominations, error } = await supabase
    .from('potw_nominations')
    .select('id, user_id, plant_name, reason, week_start')
    .eq('week_start', weekStart);

  if (error || !nominations || nominations.length === 0) return [];

  const nominationIds = nominations.map((n: any) => n.id as string);
  const userIds = [...new Set(nominations.map((n: any) => n.user_id as string))];

  const [votesResult, profilesResult] = await Promise.all([
    supabase
      .from('potw_votes')
      .select('nomination_id, user_id')
      .in('nomination_id', nominationIds),
    supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds),
  ]);

  const votesData = (votesResult.data ?? []) as { nomination_id: string; user_id: string }[];
  const profileMap = new Map(
    ((profilesResult.data ?? []) as any[]).map(p => [p.id, p.username as string | null])
  );

  const voteCountMap = new Map<string, number>();
  const userVotedIds = new Set<string>();
  for (const vote of votesData) {
    voteCountMap.set(vote.nomination_id, (voteCountMap.get(vote.nomination_id) ?? 0) + 1);
    if (userId && vote.user_id === userId) {
      userVotedIds.add(vote.nomination_id);
    }
  }

  const result: PotWNomination[] = nominations.map((n: any) => ({
    id:         n.id,
    user_id:    n.user_id,
    plant_name: n.plant_name,
    reason:     n.reason ?? null,
    week_start: n.week_start,
    vote_count: voteCountMap.get(n.id) ?? 0,
    hasVoted:   userVotedIds.has(n.id),
    username:   profileMap.get(n.user_id) ?? null,
  }));

  return result.sort((a, b) => b.vote_count - a.vote_count);
}

export async function nominatePlant(
  plantName: string,
  reason?: string,
): Promise<PotWNomination | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const weekStart = getWeekStart();

  const { data, error } = await supabase
    .from('potw_nominations')
    .insert({
      user_id:    userId,
      plant_name: plantName,
      reason:     reason?.trim() || null,
      week_start: weekStart,
    })
    .select('id, user_id, plant_name, reason, week_start')
    .single();

  if (error || !data) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle();

  return {
    id:         (data as any).id,
    user_id:    (data as any).user_id,
    plant_name: (data as any).plant_name,
    reason:     (data as any).reason ?? null,
    week_start: (data as any).week_start,
    vote_count: 0,
    hasVoted:   false,
    username:   (profile as any)?.username ?? null,
  };
}

export async function voteForNomination(nominationId: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const weekStart = getWeekStart();

  supabase
    .from('potw_votes')
    .insert({ user_id: userId, nomination_id: nominationId, week_start: weekStart })
    .then(({ error }) => {
      if (error) console.warn('[potw] vote failed:', error.message);
    });
}

export async function getUserNominationThisWeek(): Promise<PotWNomination | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const weekStart = getWeekStart();

  const { data, error } = await supabase
    .from('potw_nominations')
    .select('id, user_id, plant_name, reason, week_start')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (error || !data) return null;

  const [profileResult, countResult] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', userId).maybeSingle(),
    supabase.from('potw_votes').select('*', { count: 'exact', head: true }).eq('nomination_id', (data as any).id),
  ]);

  return {
    id:         (data as any).id,
    user_id:    (data as any).user_id,
    plant_name: (data as any).plant_name,
    reason:     (data as any).reason ?? null,
    week_start: (data as any).week_start,
    vote_count: countResult.count ?? 0,
    hasVoted:   false,
    username:   (profileResult.data as any)?.username ?? null,
  };
}
