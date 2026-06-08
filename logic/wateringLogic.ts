import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

// Run once in Supabase SQL editor before using the new fields:
//   ALTER TABLE watering_log ADD COLUMN IF NOT EXISTS amount_ml integer;
//   ALTER TABLE watering_log ADD COLUMN IF NOT EXISTS notes text;
//   ALTER TABLE plant_collection ADD COLUMN IF NOT EXISTS watering_interval_days integer;
//   ALTER TABLE plant_collection ADD COLUMN IF NOT EXISTS next_watering_date timestamptz;

const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

export type WateringEntry = {
  id: string;
  watered_at: string;
  amount_ml?: number;
  notes?: string;
};

export type WateringInterval = {
  intervalDays: number | null;
  nextWateringDate: string | null;
};

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

function localKey(plantName: string): string {
  return `wateringLog_${plantName}`;
}

// ─── Local AsyncStorage fallback ──────────────────────────────────────────────

async function getLocalLog(plantName: string): Promise<WateringEntry[]> {
  try {
    const stored = await AsyncStorage.getItem(localKey(plantName));
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    // backward compat: old format was number[]
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'number') {
      return (parsed as number[]).map(ts => ({
        id: String(ts),
        watered_at: new Date(ts).toISOString(),
      }));
    }
    return parsed as WateringEntry[];
  } catch {
    return [];
  }
}

async function saveLocalLog(plantName: string, entries: WateringEntry[]): Promise<void> {
  await AsyncStorage.setItem(localKey(plantName), JSON.stringify(entries));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getWateringLog(plantName: string): Promise<WateringEntry[]> {
  const userId = await getUserId();
  if (!userId) return getLocalLog(plantName);

  const { data, error } = await supabase
    .from('watering_log')
    .select('id, watered_at, amount_ml, notes')
    .eq('user_id', userId)
    .ilike('plant_name', plantName)
    .order('watered_at', { ascending: false })
    .limit(20);

  if (error) return getLocalLog(plantName);
  return (data ?? []).map((row: any) => ({
    id:        row.id,
    watered_at: row.watered_at,
    amount_ml: row.amount_ml ?? undefined,
    notes:     row.notes ?? undefined,
  }));
}

export async function logWatering(
  plantName: string,
  amountMl?: number,
  notes?: string,
  wateredAt?: string,
): Promise<WateringEntry | null> {
  const timestamp = wateredAt ?? new Date().toISOString();
  const userId = await getUserId();

  if (!userId) {
    const entry: WateringEntry = {
      id: String(Date.now()),
      watered_at: timestamp,
      amount_ml: amountMl,
      notes,
    };
    const existing = await getLocalLog(plantName);
    await saveLocalLog(plantName, [entry, ...existing]);
    return entry;
  }

  const { data, error } = await supabase
    .from('watering_log')
    .insert({
      user_id:    userId,
      plant_name: plantName,
      watered_at: timestamp,
      amount_ml:  amountMl ?? null,
      notes:      notes ?? null,
    })
    .select('id, watered_at, amount_ml, notes')
    .single();

  if (error || !data) return null;

  // Update next_watering_date if an interval is set (fire-and-forget)
  supabase
    .from('plant_collection')
    .select('watering_interval_days')
    .eq('user_id', userId)
    .ilike('plant_name', plantName)
    .maybeSingle()
    .then(({ data: row }) => {
      if ((row as any)?.watering_interval_days) {
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + (row as any).watering_interval_days);
        supabase
          .from('plant_collection')
          .update({ next_watering_date: nextDate.toISOString() })
          .eq('user_id', userId)
          .ilike('plant_name', plantName)
          .then(({ error: e }) => {
            if (e) console.warn('[watering] next_watering_date update failed:', e.message);
          });
      }
    });

  return {
    id:        (data as any).id,
    watered_at: (data as any).watered_at,
    amount_ml: (data as any).amount_ml ?? undefined,
    notes:     (data as any).notes ?? undefined,
  };
}

export async function deleteWateringEntry(id: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  supabase
    .from('watering_log')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .then(({ error }) => {
      if (error) console.warn('[watering] delete failed:', error.message);
    });
}

export async function setWateringInterval(plantName: string, days: number): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + days);

  await supabase
    .from('plant_collection')
    .update({
      watering_interval_days: days,
      next_watering_date:     nextDate.toISOString(),
    })
    .eq('user_id', userId)
    .ilike('plant_name', plantName);
}

export async function getWateringInterval(plantName: string): Promise<WateringInterval> {
  const userId = await getUserId();
  if (!userId) return { intervalDays: null, nextWateringDate: null };

  const { data, error } = await supabase
    .from('plant_collection')
    .select('watering_interval_days, next_watering_date')
    .eq('user_id', userId)
    .ilike('plant_name', plantName)
    .maybeSingle();

  if (error || !data) return { intervalDays: null, nextWateringDate: null };

  return {
    intervalDays:     (data as any).watering_interval_days ?? null,
    nextWateringDate: (data as any).next_watering_date ?? null,
  };
}

export async function suggestWateringInterval(plantName: string): Promise<number> {
  if (!ANTHROPIC_API_KEY) return 7;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: `How many days between waterings for a ${plantName}? Reply with a single integer only, no other text.`,
          },
        ],
      }),
    });
    if (!response.ok) return 7;
    const json = await response.json();
    const text: string = json?.content?.[0]?.text?.trim() ?? '';
    const parsed = parseInt(text, 10);
    return isNaN(parsed) ? 7 : parsed;
  } catch {
    return 7;
  }
}

// kept for backward compatibility with existing callers
export function formatRelativeDate(timestamp: number): string {
  const diffDays = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return '1 month ago';
  return `${Math.floor(diffDays / 30)} months ago`;
}
