// __tests__/fertilizerLogic.test.ts

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
  },
}));

import { supabase } from '../lib/supabase';
import {
  getFertilizerProducts,
  addFertilizerProduct,
  updateFertilizerProduct,
  deleteFertilizerProduct,
  getFertilizerRecipes,
  getFertilizerRecipe,
  addFertilizerRecipe,
  updateFertilizerRecipe,
  deleteFertilizerRecipe,
  type FertilizerProduct,
  type FertilizerRecipe,
} from '../logic/fertilizerLogic';

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

// Returns a self-contained chainable query builder that resolves to `result`.
// Tests wire mockFrom via mockReturnValue (single from() call) or
// mockReturnValueOnce (multiple from() calls per function).
function makeChain(result: { data?: any; error?: any; count?: number | null } = {}) {
  const resolved = { data: null, error: null, count: null, ...result };
  const chain: any = {
    select:      jest.fn().mockReturnThis(),
    eq:          jest.fn().mockReturnThis(),
    order:       jest.fn().mockReturnThis(),
    insert:      jest.fn().mockReturnThis(),
    update:      jest.fn().mockReturnThis(),
    delete:      jest.fn().mockReturnThis(),
    single:      jest.fn().mockResolvedValue(resolved),
    maybeSingle: jest.fn().mockResolvedValue(resolved),
  };
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(resolved).then(resolve, reject);
  return chain;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PRODUCT_FIXTURE: FertilizerProduct = {
  id:                 'prod-1',
  name:               'GrowMaster',
  manufacturer_ratio: '1 tsp per gallon',
  notes:              null,
  created_at:         '2026-06-01T10:00:00Z',
};

// Raw row as Supabase returns it for a recipe with nested joins
const RAW_RECIPE_WITH_PRODUCT = {
  id:                 'recipe-1',
  name:               'Carnivorous plant spray mix',
  instructions:       '0.2ml of each into 1L spray bottle',
  applies_to:         'Nepenthes, carnivorous plants',
  application_method: 'spray',
  frequency:          'Every 2 weeks',
  notes:              "Manufacturer's amount is too strong for these",
  created_at:         '2026-06-29T00:00:00Z',
  fertilizer_recipe_products: [
    {
      product_id:          'prod-1',
      amount:              '0.2ml',
      fertilizer_products: { name: 'GrowMaster' },
    },
  ],
};

const MAPPED_RECIPE_WITH_PRODUCT: FertilizerRecipe = {
  id:                 'recipe-1',
  name:               'Carnivorous plant spray mix',
  instructions:       '0.2ml of each into 1L spray bottle',
  applies_to:         'Nepenthes, carnivorous plants',
  application_method: 'spray',
  frequency:          'Every 2 weeks',
  notes:              "Manufacturer's amount is too strong for these",
  created_at:         '2026-06-29T00:00:00Z',
  products: [{ product_id: 'prod-1', product_name: 'GrowMaster', amount: '0.2ml' }],
};

beforeEach(() => {
  jest.resetAllMocks();
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'user-123' } } },
  });
});

// ─── getFertilizerProducts ────────────────────────────────────────────────────

describe('getFertilizerProducts', () => {
  test('returns products ordered by name for authenticated user', async () => {
    mockFrom.mockReturnValue(makeChain({ data: [PRODUCT_FIXTURE], error: null }));

    const result = await getFertilizerProducts();

    expect(result).toEqual([PRODUCT_FIXTURE]);
    const chain = mockFrom.mock.results[0].value;
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(chain.order).toHaveBeenCalledWith('name', { ascending: true });
  });

  test('returns empty array when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const result = await getFertilizerProducts();

    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('returns empty array on Supabase error', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'DB error' } }));

    const result = await getFertilizerProducts();

    expect(result).toEqual([]);
  });
});

// ─── addFertilizerProduct ─────────────────────────────────────────────────────

describe('addFertilizerProduct', () => {
  test('inserts with user_id and returns the saved row', async () => {
    const chain = makeChain();
    chain.single.mockResolvedValue({ data: PRODUCT_FIXTURE, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await addFertilizerProduct({ name: 'GrowMaster', manufacturer_ratio: '1 tsp per gallon', notes: null });

    expect(result).toEqual(PRODUCT_FIXTURE);
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'GrowMaster', user_id: 'user-123' }),
    );
  });

  test('returns null when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const result = await addFertilizerProduct({ name: 'x', manufacturer_ratio: null, notes: null });

    expect(result).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('returns null on Supabase insert error', async () => {
    const chain = makeChain();
    chain.single.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });
    mockFrom.mockReturnValue(chain);

    const result = await addFertilizerProduct({ name: 'x', manufacturer_ratio: null, notes: null });

    expect(result).toBeNull();
  });
});

// ─── updateFertilizerProduct ──────────────────────────────────────────────────

describe('updateFertilizerProduct', () => {
  test('returns true and filters by id and user_id on success', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }));

    const result = await updateFertilizerProduct('prod-1', { name: 'Updated' });

    expect(result).toBe(true);
    const chain = mockFrom.mock.results[0].value;
    expect(chain.update).toHaveBeenCalledWith({ name: 'Updated' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'prod-1');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-123');
  });

  test('returns false when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const result = await updateFertilizerProduct('prod-1', { name: 'x' });

    expect(result).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('returns false on Supabase error', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'Update failed' } }));

    const result = await updateFertilizerProduct('prod-1', { notes: 'test' });

    expect(result).toBe(false);
  });
});

// ─── deleteFertilizerProduct ──────────────────────────────────────────────────

describe('deleteFertilizerProduct', () => {
  test('calls delete with correct id and user_id', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }));

    await deleteFertilizerProduct('prod-1');

    const chain = mockFrom.mock.results[0].value;
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 'prod-1');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-123');
  });

  test('no-ops when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    await deleteFertilizerProduct('prod-1');

    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ─── getFertilizerRecipes ─────────────────────────────────────────────────────

describe('getFertilizerRecipes', () => {
  test('returns recipes with joined product_name and amount', async () => {
    mockFrom.mockReturnValue(makeChain({ data: [RAW_RECIPE_WITH_PRODUCT], error: null }));

    const result = await getFertilizerRecipes();

    expect(result).toEqual([MAPPED_RECIPE_WITH_PRODUCT]);
  });

  test('returns recipe with empty products array when fertilizer_recipe_products is empty', async () => {
    const rawWithNoProducts = { ...RAW_RECIPE_WITH_PRODUCT, fertilizer_recipe_products: [] };
    mockFrom.mockReturnValue(makeChain({ data: [rawWithNoProducts], error: null }));

    const result = await getFertilizerRecipes();

    expect(result[0].products).toEqual([]);
  });

  test('sets product_name to null when fertilizer_products join is null (product deleted)', async () => {
    const rawOrphaned = {
      ...RAW_RECIPE_WITH_PRODUCT,
      fertilizer_recipe_products: [
        { product_id: 'prod-gone', amount: '0.5ml', fertilizer_products: null },
      ],
    };
    mockFrom.mockReturnValue(makeChain({ data: [rawOrphaned], error: null }));

    const result = await getFertilizerRecipes();

    expect(result[0].products[0].product_name).toBeNull();
    expect(result[0].products[0].amount).toBe('0.5ml');
  });

  test('returns empty array when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const result = await getFertilizerRecipes();

    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('returns empty array on Supabase error', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'DB error' } }));

    const result = await getFertilizerRecipes();

    expect(result).toEqual([]);
  });
});

// ─── getFertilizerRecipe ──────────────────────────────────────────────────────

describe('getFertilizerRecipe', () => {
  test('returns a single mapped recipe when found', async () => {
    const chain = makeChain();
    chain.single.mockResolvedValue({ data: RAW_RECIPE_WITH_PRODUCT, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await getFertilizerRecipe('recipe-1');

    expect(result).toEqual(MAPPED_RECIPE_WITH_PRODUCT);
    expect(chain.eq).toHaveBeenCalledWith('id', 'recipe-1');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-123');
  });

  test('returns null when recipe is not found (Supabase single() error)', async () => {
    const chain = makeChain();
    chain.single.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'Not found' } });
    mockFrom.mockReturnValue(chain);

    const result = await getFertilizerRecipe('no-such-id');

    expect(result).toBeNull();
  });

  test('returns null when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const result = await getFertilizerRecipe('recipe-1');

    expect(result).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ─── addFertilizerRecipe ──────────────────────────────────────────────────────

describe('addFertilizerRecipe', () => {
  const NEW_RECIPE = {
    name:               'Carnivorous plant spray mix',
    instructions:       '0.2ml of each into 1L spray bottle',
    applies_to:         'Nepenthes, carnivorous plants',
    application_method: 'spray' as const,
    frequency:          'Every 2 weeks',
    notes:              null,
  };

  const INSERTED_ROW = {
    id:                 'recipe-new',
    name:               'Carnivorous plant spray mix',
    instructions:       '0.2ml of each into 1L spray bottle',
    applies_to:         'Nepenthes, carnivorous plants',
    application_method: 'spray',
    frequency:          'Every 2 weeks',
    notes:              null,
    created_at:         '2026-06-29T00:00:00Z',
  };

  test('inserts recipe then join rows, returns recipe with products (product_name null on insert)', async () => {
    const recipeChain = makeChain();
    recipeChain.single.mockResolvedValue({ data: INSERTED_ROW, error: null });
    const joinChain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValueOnce(recipeChain).mockReturnValueOnce(joinChain);

    const result = await addFertilizerRecipe(NEW_RECIPE, [{ product_id: 'prod-1', amount: '0.2ml' }]);

    expect(result).toEqual({
      ...INSERTED_ROW,
      products: [{ product_id: 'prod-1', product_name: null, amount: '0.2ml' }],
    });
    // Confirm the join insert was called with the correct recipe_id
    expect(joinChain.insert).toHaveBeenCalledWith([
      { recipe_id: 'recipe-new', product_id: 'prod-1', amount: '0.2ml' },
    ]);
  });

  test('inserts recipe with no products when products array is empty — does not call from() a second time', async () => {
    const recipeChain = makeChain();
    recipeChain.single.mockResolvedValue({ data: INSERTED_ROW, error: null });
    mockFrom.mockReturnValue(recipeChain);

    const result = await addFertilizerRecipe(NEW_RECIPE, []);

    expect(result).toEqual({ ...INSERTED_ROW, products: [] });
    // Only one from() call — no join insert
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  test('inserts recipe row with user_id', async () => {
    const recipeChain = makeChain();
    recipeChain.single.mockResolvedValue({ data: INSERTED_ROW, error: null });
    mockFrom.mockReturnValue(recipeChain);

    await addFertilizerRecipe(NEW_RECIPE, []);

    expect(recipeChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Carnivorous plant spray mix', user_id: 'user-123' }),
    );
  });

  test('returns null when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const result = await addFertilizerRecipe(NEW_RECIPE, []);

    expect(result).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('returns null on recipe insert error', async () => {
    const recipeChain = makeChain();
    recipeChain.single.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });
    mockFrom.mockReturnValue(recipeChain);

    const result = await addFertilizerRecipe(NEW_RECIPE, [{ product_id: 'prod-1', amount: '0.2ml' }]);

    expect(result).toBeNull();
    // Join insert must not run if the recipe insert failed
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});

// ─── updateFertilizerRecipe ───────────────────────────────────────────────────

describe('updateFertilizerRecipe', () => {
  test('updates recipe fields only when products arg is omitted — one from() call', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }));

    const result = await updateFertilizerRecipe('recipe-1', { name: 'Renamed' });

    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledTimes(1);
    const chain = mockFrom.mock.results[0].value;
    expect(chain.update).toHaveBeenCalledWith({ name: 'Renamed' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'recipe-1');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-123');
  });

  test('replaces join rows when products array is provided with items', async () => {
    const updateChain = makeChain({ data: null, error: null });
    const deleteChain = makeChain({ data: null, error: null });
    const insertChain = makeChain({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(deleteChain)
      .mockReturnValueOnce(insertChain);

    const result = await updateFertilizerRecipe(
      'recipe-1',
      { frequency: 'Monthly' },
      [{ product_id: 'prod-2', amount: '0.5ml' }],
    );

    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledTimes(3);
    // Old join rows deleted
    expect(deleteChain.delete).toHaveBeenCalled();
    expect(deleteChain.eq).toHaveBeenCalledWith('recipe_id', 'recipe-1');
    // New join rows inserted
    expect(insertChain.insert).toHaveBeenCalledWith([
      { recipe_id: 'recipe-1', product_id: 'prod-2', amount: '0.5ml' },
    ]);
  });

  test('deletes join rows but skips insert when products array is empty', async () => {
    const updateChain = makeChain({ data: null, error: null });
    const deleteChain = makeChain({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(deleteChain);

    const result = await updateFertilizerRecipe('recipe-1', { notes: 'cleared' }, []);

    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(deleteChain.delete).toHaveBeenCalled();
  });

  test('returns false when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const result = await updateFertilizerRecipe('recipe-1', { name: 'x' });

    expect(result).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('returns false on Supabase update error', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'Update failed' } }));

    const result = await updateFertilizerRecipe('recipe-1', { name: 'x' });

    expect(result).toBe(false);
  });
});

// ─── deleteFertilizerRecipe ───────────────────────────────────────────────────

describe('deleteFertilizerRecipe', () => {
  test('calls delete with correct id and user_id', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }));

    await deleteFertilizerRecipe('recipe-1');

    const chain = mockFrom.mock.results[0].value;
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 'recipe-1');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-123');
  });

  test('no-ops when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    await deleteFertilizerRecipe('recipe-1');

    expect(mockFrom).not.toHaveBeenCalled();
  });
});
