import { supabase } from '../lib/supabase';
import type { HealthLogComment, HealthLogEntry } from '../types';

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export async function getHealthLog(plantName: string): Promise<HealthLogEntry[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('plant_health_log')
    .select('id, note, logged_at')
    .eq('user_id', userId)
    .ilike('plant_name', plantName)
    .order('logged_at', { ascending: false })
    .limit(20);

  if (error) return [];
  return (data ?? []).map((row: any) => ({
    id:        row.id,
    note:      row.note,
    logged_at: row.logged_at,
  }));
}

export async function addHealthEntry(
  plantName: string,
  note: string,
): Promise<HealthLogEntry | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('plant_health_log')
    .insert({ user_id: userId, plant_name: plantName, note })
    .select('id, note, logged_at')
    .single();

  if (error || !data) return null;
  return {
    id:        (data as any).id,
    note:      (data as any).note,
    logged_at: (data as any).logged_at,
  };
}

export async function getRecentHealthLogCounts(plantNames: string[]): Promise<Record<string, number>> {
  if (plantNames.length === 0) return {};
  const userId = await getUserId();
  if (!userId) return {};

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data, error } = await supabase
    .from('plant_health_log')
    .select('plant_name')
    .eq('user_id', userId)
    .in('plant_name', plantNames)
    .gte('logged_at', sevenDaysAgo.toISOString());

  if (error || !data) return {};

  const counts: Record<string, number> = {};
  for (const row of data as { plant_name: string }[]) {
    counts[row.plant_name] = (counts[row.plant_name] ?? 0) + 1;
  }
  return counts;
}

export async function getAllHealthLogs(plantNames: string[]): Promise<Record<string, HealthLogEntry[]>> {
  if (plantNames.length === 0) return {};
  const userId = await getUserId();
  if (!userId) return {};

  const { data, error } = await supabase
    .from('plant_health_log')
    .select('id, note, logged_at, plant_name')
    .eq('user_id', userId)
    .in('plant_name', plantNames)
    .order('logged_at', { ascending: false });

  if (error || !data) return {};

  const result: Record<string, HealthLogEntry[]> = {};
  for (const row of data as any[]) {
    if (!result[row.plant_name]) result[row.plant_name] = [];
    result[row.plant_name].push({ id: row.id, note: row.note, logged_at: row.logged_at });
  }
  return result;
}

export async function deleteHealthEntry(id: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  supabase
    .from('plant_health_log')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .then(({ error }) => {
      if (error) console.warn('[healthLog] delete failed:', error.message);
    });
}

export async function getHealthLogComments(healthLogId: string): Promise<HealthLogComment[]> {
  const { data: comments, error } = await supabase
    .from('health_log_comments')
    .select('id, user_id, health_log_id, body, created_at')
    .eq('health_log_id', healthLogId)
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
      id:            c.id,
      user_id:       c.user_id,
      health_log_id: c.health_log_id,
      body:          c.body,
      created_at:    c.created_at,
      username:      profile?.username ?? null,
      avatar_url:    profile?.avatar_url ?? null,
    };
  });
}

export async function addHealthLogComment(
  healthLogId: string,
  body: string,
): Promise<HealthLogComment | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('health_log_comments')
    .insert({ user_id: userId, health_log_id: healthLogId, body })
    .select('id, user_id, health_log_id, body, created_at')
    .single();

  if (error || !data) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, avatar_url')
    .eq('id', userId)
    .maybeSingle();

  return {
    id:            (data as any).id,
    user_id:       (data as any).user_id,
    health_log_id: (data as any).health_log_id,
    body:          (data as any).body,
    created_at:    (data as any).created_at,
    username:      (profile as any)?.username ?? null,
    avatar_url:    (profile as any)?.avatar_url ?? null,
  };
}

export async function deleteHealthLogComment(id: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  supabase
    .from('health_log_comments')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .then(({ error }) => {
      if (error) console.warn('[healthLog] comment delete failed:', error.message);
    });
}
