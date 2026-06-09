import { supabase } from '../lib/supabase';

export type PlantListing = {
  id: string;
  user_id: string;
  plant_name: string;
  listing_type: 'trade' | 'gift' | 'sell';
  price: number | null;
  description: string | null;
  created_at: string;
  is_active: boolean;
};

export type ListingWithProfile = PlantListing & {
  profiles: { username: string | null; avatar_url: string | null } | null;
};

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export async function getMyListings(): Promise<PlantListing[]> {
  const userId = await getUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('plant_listings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as PlantListing[];
}

export async function getMyListingForPlant(plantName: string): Promise<PlantListing | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await supabase
    .from('plant_listings')
    .select('*')
    .eq('user_id', userId)
    .eq('plant_name', plantName)
    .maybeSingle();
  return (data as PlantListing | null) ?? null;
}

export async function getListingsForUser(userId: string): Promise<PlantListing[]> {
  const { data, error } = await supabase
    .from('plant_listings')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as PlantListing[];
}

export async function getActiveListings(limit = 20): Promise<ListingWithProfile[]> {
  const { data, error } = await supabase
    .from('plant_listings')
    .select('*, profiles(username, avatar_url)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as ListingWithProfile[];
}

export async function createListing(
  plantName: string,
  listingType: 'trade' | 'gift' | 'sell',
  description?: string,
  price?: number,
): Promise<PlantListing | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('plant_listings')
    .insert({
      user_id: userId,
      plant_name: plantName,
      listing_type: listingType,
      description: description ?? null,
      price: listingType === 'sell' ? (price ?? null) : null,
    })
    .select()
    .single();
  if (error) return null;
  return data as PlantListing;
}

export async function deleteListing(id: string): Promise<void> {
  await supabase.from('plant_listings').delete().eq('id', id);
}

export async function toggleListing(id: string, isActive: boolean): Promise<void> {
  await supabase.from('plant_listings').update({ is_active: isActive }).eq('id', id);
}
