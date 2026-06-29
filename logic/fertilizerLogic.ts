import { supabase } from '../lib/supabase';

export type FertilizerProduct = {
  id: string;
  name: string;
  manufacturer_ratio: string | null;
  notes: string | null;
  created_at: string;
};

export type NewFertilizerProduct = Omit<FertilizerProduct, 'id' | 'created_at'>;

export type RecipeProductLink = {
  product_id: string;
  product_name: string | null;
  amount: string | null;
};

export type FertilizerRecipe = {
  id: string;
  name: string;
  instructions: string | null;
  applies_to: string | null;
  application_method: 'spray' | 'soil_drench' | 'other' | null;
  frequency: string | null;
  notes: string | null;
  created_at: string;
  products: RecipeProductLink[];
};

export type NewFertilizerRecipe = Omit<FertilizerRecipe, 'id' | 'created_at' | 'products'>;

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

function mapRecipeRow(row: any): FertilizerRecipe {
  return {
    id:                 row.id,
    name:               row.name,
    instructions:       row.instructions,
    applies_to:         row.applies_to,
    application_method: row.application_method,
    frequency:          row.frequency,
    notes:              row.notes,
    created_at:         row.created_at,
    products: (row.fertilizer_recipe_products ?? []).map((rp: any) => ({
      product_id:   rp.product_id,
      product_name: rp.fertilizer_products?.name ?? null,
      amount:       rp.amount,
    })),
  };
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function getFertilizerProducts(): Promise<FertilizerProduct[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('fertilizer_products')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (error || !data) return [];
  return data as FertilizerProduct[];
}

export async function addFertilizerProduct(product: NewFertilizerProduct): Promise<FertilizerProduct | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('fertilizer_products')
    .insert({ ...product, user_id: userId })
    .select()
    .single();

  if (error || !data) return null;
  return data as FertilizerProduct;
}

export async function updateFertilizerProduct(id: string, updates: Partial<NewFertilizerProduct>): Promise<boolean> {
  const userId = await getUserId();
  if (!userId) return false;

  const { error } = await supabase
    .from('fertilizer_products')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId);

  return !error;
}

export async function deleteFertilizerProduct(id: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  await supabase
    .from('fertilizer_products')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
}

// ── Recipes ───────────────────────────────────────────────────────────────────

export async function getFertilizerRecipes(): Promise<FertilizerRecipe[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('fertilizer_recipes')
    .select('*, fertilizer_recipe_products(product_id, amount, fertilizer_products(name))')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (error || !data) return [];
  return (data as any[]).map(mapRecipeRow);
}

export async function getFertilizerRecipe(id: string): Promise<FertilizerRecipe | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('fertilizer_recipes')
    .select('*, fertilizer_recipe_products(product_id, amount, fertilizer_products(name))')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return mapRecipeRow(data);
}

export async function addFertilizerRecipe(
  recipe: NewFertilizerRecipe,
  products: Array<{ product_id: string; amount: string | null }>,
): Promise<FertilizerRecipe | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('fertilizer_recipes')
    .insert({ ...recipe, user_id: userId })
    .select()
    .single();

  if (error || !data) return null;

  const saved = data as any;

  if (products.length > 0) {
    await supabase
      .from('fertilizer_recipe_products')
      .insert(products.map((p) => ({ recipe_id: saved.id, product_id: p.product_id, amount: p.amount })));
  }

  return {
    id:                 saved.id,
    name:               saved.name,
    instructions:       saved.instructions,
    applies_to:         saved.applies_to,
    application_method: saved.application_method,
    frequency:          saved.frequency,
    notes:              saved.notes,
    created_at:         saved.created_at,
    products: products.map((p) => ({
      product_id:   p.product_id,
      product_name: null,
      amount:       p.amount,
    })),
  };
}

export async function updateFertilizerRecipe(
  id: string,
  updates: Partial<NewFertilizerRecipe>,
  products?: Array<{ product_id: string; amount: string | null }>,
): Promise<boolean> {
  const userId = await getUserId();
  if (!userId) return false;

  const { error } = await supabase
    .from('fertilizer_recipes')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return false;

  if (products !== undefined) {
    await supabase
      .from('fertilizer_recipe_products')
      .delete()
      .eq('recipe_id', id);

    if (products.length > 0) {
      await supabase
        .from('fertilizer_recipe_products')
        .insert(products.map((p) => ({ recipe_id: id, product_id: p.product_id, amount: p.amount })));
    }
  }

  return true;
}

export async function deleteFertilizerRecipe(id: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  await supabase
    .from('fertilizer_recipes')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
}
