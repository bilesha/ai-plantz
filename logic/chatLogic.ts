import { supabase } from '../lib/supabase';

export type ChatMessage = {
  id: string;
  user_id: string;
  plant_name: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export async function getPlantChat(plantName: string): Promise<ChatMessage[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('plant_chats')
    .select('*')
    .eq('user_id', userId)
    .ilike('plant_name', plantName)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data as ChatMessage[];
}

export async function saveChatMessage(
  plantName: string,
  role: 'user' | 'assistant',
  content: string,
): Promise<ChatMessage | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('plant_chats')
    .insert({ user_id: userId, plant_name: plantName, role, content })
    .select()
    .single();

  if (error || !data) return null;
  return data as ChatMessage;
}

export async function clearPlantChat(plantName: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  await supabase
    .from('plant_chats')
    .delete()
    .eq('user_id', userId)
    .ilike('plant_name', plantName);
}
