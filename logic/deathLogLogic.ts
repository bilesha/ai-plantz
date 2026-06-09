import { supabase } from '../lib/supabase';

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export type PlantDeathEntry = {
  id: string;
  plant_name: string;
  cause: string | null;
  notes: string | null;
  died_at: string;
  owned_since: string | null;
};

export async function getDeathLog(): Promise<PlantDeathEntry[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('plant_death_log')
    .select('id, plant_name, cause, notes, died_at, owned_since')
    .eq('user_id', userId)
    .order('died_at', { ascending: false });

  if (error || !data) return [];
  return (data as any[]).map(row => ({
    id:          row.id,
    plant_name:  row.plant_name,
    cause:       row.cause ?? null,
    notes:       row.notes ?? null,
    died_at:     row.died_at,
    owned_since: row.owned_since ?? null,
  }));
}

export async function addDeathEntry(
  plantName: string,
  cause?: string,
  notes?: string,
  ownedSince?: number,
): Promise<PlantDeathEntry | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('plant_death_log')
    .insert({
      user_id:     userId,
      plant_name:  plantName,
      cause:       cause?.trim() || null,
      notes:       notes?.trim() || null,
      owned_since: ownedSince ? new Date(ownedSince).toISOString() : null,
    })
    .select('id, plant_name, cause, notes, died_at, owned_since')
    .single();

  if (error || !data) return null;
  return {
    id:          (data as any).id,
    plant_name:  (data as any).plant_name,
    cause:       (data as any).cause ?? null,
    notes:       (data as any).notes ?? null,
    died_at:     (data as any).died_at,
    owned_since: (data as any).owned_since ?? null,
  };
}

export async function deleteDeathEntry(id: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  supabase
    .from('plant_death_log')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .then(({ error }) => {
      if (error) console.warn('[deathLog] delete failed:', error.message);
    });
}
