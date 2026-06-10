// __tests__/photoLogic.test.ts

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn().mockResolvedValue('base64encoded=='),
  EncodingType: { Base64: 'base64' },
}));

jest.mock('base64-arraybuffer', () => ({
  decode: jest.fn().mockReturnValue(new ArrayBuffer(8)),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth:    { getSession: jest.fn() },
    from:    jest.fn(),
    storage: { from: jest.fn() },
  },
}));

import { supabase } from '../lib/supabase';
import {
  getPlantPhotos,
  uploadPlantPhoto,
  deletePhoto,
  setPrimaryPhoto,
  type PlantPhoto,
} from '../logic/photoLogic';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

const mockGetSession    = supabase.auth.getSession as jest.Mock;
const mockFrom          = supabase.from as jest.Mock;
const mockStorageFrom   = supabase.storage.from as jest.Mock;
const mockReadAsString  = FileSystem.readAsStringAsync as jest.Mock;
const mockDecode        = decode as jest.Mock;

// ─── Query chain factory ──────────────────────────────────────────────────────

function makeChain(result: { data?: any; error?: any; count?: number | null } = {}) {
  const resolved = { data: null, error: null, count: null, ...result };
  const chain: any = {
    select:      jest.fn().mockReturnThis(),
    eq:          jest.fn().mockReturnThis(),
    ilike:       jest.fn().mockReturnThis(),
    order:       jest.fn().mockReturnThis(),
    limit:       jest.fn().mockReturnThis(),
    insert:      jest.fn().mockReturnThis(),
    update:      jest.fn().mockReturnThis(),
    delete:      jest.fn().mockReturnThis(),
    upsert:      jest.fn().mockReturnThis(),
    single:      jest.fn().mockResolvedValue(resolved),
    maybeSingle: jest.fn().mockResolvedValue(resolved),
  };
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(resolved).then(resolve, reject);
  return chain;
}

// Storage sub-client returned by supabase.storage.from(bucket).
function makeStorageChain(
  uploadError: any = null,
  publicUrl = 'https://example.supabase.co/plant-photos/user-123/Monstera/1234567890.jpg',
) {
  return {
    upload:       jest.fn().mockResolvedValue({ error: uploadError }),
    getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl } }),
    remove:       jest.fn().mockResolvedValue({ error: null }),
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PRIMARY_PHOTO: PlantPhoto = {
  id:          'photo-primary',
  user_id:     'user-123',
  plant_name:  'Monstera',
  photo_url:   'https://example.supabase.co/plant-photos/user-123/Monstera/1234567890.jpg',
  caption:     null,
  taken_at:    '2026-06-01T10:00:00Z',
  is_primary:  true,
};

const SECONDARY_PHOTO: PlantPhoto = {
  id:         'photo-secondary',
  user_id:    'user-123',
  plant_name: 'Monstera',
  photo_url:  'https://example.supabase.co/plant-photos/user-123/Monstera/9876543210.jpg',
  caption:    'Second photo',
  taken_at:   '2026-06-05T10:00:00Z',
  is_primary: false,
};

beforeEach(() => {
  jest.resetAllMocks();
  // Restore module-level mocks cleared by resetAllMocks.
  mockReadAsString.mockResolvedValue('base64encoded==');
  mockDecode.mockReturnValue(new ArrayBuffer(8));
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'user-123' } } },
  });
  // Default storage mock — overridden per test when needed.
  mockStorageFrom.mockReturnValue(makeStorageChain());
});

// ─── getPlantPhotos ───────────────────────────────────────────────────────────

describe('getPlantPhotos', () => {
  test('returns photos sorted by is_primary desc, taken_at desc', async () => {
    mockFrom.mockReturnValue(makeChain({ data: [PRIMARY_PHOTO, SECONDARY_PHOTO], error: null }));

    const result = await getPlantPhotos('Monstera');

    expect(result).toEqual([PRIMARY_PHOTO, SECONDARY_PHOTO]);
    const chain = mockFrom.mock.results[0].value;
    expect(chain.order).toHaveBeenCalledWith('is_primary',  { ascending: false });
    expect(chain.order).toHaveBeenCalledWith('taken_at', { ascending: false });
  });

  test('returns empty array when unauthenticated and no userId provided', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const result = await getPlantPhotos('Monstera');
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('accepts explicit userId and skips auth session', async () => {
    mockFrom.mockReturnValue(makeChain({ data: [PRIMARY_PHOTO], error: null }));

    const result = await getPlantPhotos('Monstera', 'other-user-456');

    expect(result).toEqual([PRIMARY_PHOTO]);
    const chain = mockFrom.mock.results[0].value;
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'other-user-456');
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  test('returns empty array on Supabase error', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'DB error' } }));
    const result = await getPlantPhotos('Monstera');
    expect(result).toEqual([]);
  });
});

// ─── uploadPlantPhoto ─────────────────────────────────────────────────────────

describe('uploadPlantPhoto', () => {
  test('uploads to storage, inserts row, and returns the photo', async () => {
    const storageChain = makeStorageChain();
    mockStorageFrom.mockReturnValue(storageChain);

    // from() call sequence: count query → insert query
    const countChain  = makeChain({ count: 1, data: null, error: null }); // not first photo
    const insertChain = makeChain();
    insertChain.single.mockResolvedValue({ data: SECONDARY_PHOTO, error: null });
    mockFrom
      .mockReturnValueOnce(countChain)
      .mockReturnValueOnce(insertChain);

    const result = await uploadPlantPhoto('Monstera', 'file://tmp/photo.jpg', 'My cutting');

    expect(result).toEqual(SECONDARY_PHOTO);
    expect(storageChain.upload).toHaveBeenCalledWith(
      expect.stringContaining('user-123/Monstera/'),
      expect.any(ArrayBuffer),
      expect.objectContaining({ contentType: 'image/jpeg' }),
    );
  });

  test('sets is_primary: true for the first photo', async () => {
    const storageChain = makeStorageChain();
    mockStorageFrom.mockReturnValue(storageChain);

    const countChain  = makeChain({ count: 0, data: null, error: null }); // first photo!
    const insertChain = makeChain();
    insertChain.single.mockResolvedValue({
      data: { ...PRIMARY_PHOTO, is_primary: true },
      error: null,
    });
    const collectionChain = makeChain({ data: null, error: null }); // fire-and-forget update
    mockFrom
      .mockReturnValueOnce(countChain)
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(collectionChain);

    const result = await uploadPlantPhoto('Monstera', 'file://tmp/photo.jpg');

    // Confirm the insert includes is_primary: true
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ is_primary: true }),
    );
    expect(result).not.toBeNull();
    expect(result!.is_primary).toBe(true);
  });

  test('updates plant_collection.photo_url when uploading the first photo', async () => {
    const storageChain = makeStorageChain(
      null,
      'https://example.supabase.co/plant-photos/user-123/Monstera/abc.jpg',
    );
    mockStorageFrom.mockReturnValue(storageChain);

    const countChain       = makeChain({ count: 0,    data: null, error: null });
    const insertChain      = makeChain();
    insertChain.single.mockResolvedValue({ data: { ...PRIMARY_PHOTO }, error: null });
    const collectionChain  = makeChain({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(countChain)
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(collectionChain);

    await uploadPlantPhoto('Monstera', 'file://tmp/photo.jpg');

    // fire-and-forget plant_collection update was triggered
    expect(collectionChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ photo_url: expect.any(String) }),
    );
  });

  test('does not update plant_collection for non-first photo', async () => {
    mockStorageFrom.mockReturnValue(makeStorageChain());

    const countChain  = makeChain({ count: 2, data: null, error: null }); // not first
    const insertChain = makeChain();
    insertChain.single.mockResolvedValue({ data: SECONDARY_PHOTO, error: null });
    mockFrom
      .mockReturnValueOnce(countChain)
      .mockReturnValueOnce(insertChain);

    await uploadPlantPhoto('Monstera', 'file://tmp/photo.jpg');

    // Only 2 from() calls — no plant_collection update
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  test('returns null when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const result = await uploadPlantPhoto('Monstera', 'file://tmp/photo.jpg');
    expect(result).toBeNull();
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  test('returns null on storage upload error', async () => {
    mockStorageFrom.mockReturnValue(
      makeStorageChain({ message: 'Storage quota exceeded' }),
    );
    // No from() calls should happen after storage error
    const result = await uploadPlantPhoto('Monstera', 'file://tmp/photo.jpg');
    expect(result).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ─── deletePhoto ──────────────────────────────────────────────────────────────

describe('deletePhoto', () => {
  test('deletes row and removes from storage for a non-primary photo', async () => {
    const storageChain = makeStorageChain();
    mockStorageFrom.mockReturnValue(storageChain);

    const selectChain = makeChain();
    selectChain.single.mockResolvedValue({ data: SECONDARY_PHOTO, error: null });
    const deleteChain = makeChain({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(selectChain) // fetch photo
      .mockReturnValueOnce(deleteChain); // delete row

    await deletePhoto('photo-secondary', SECONDARY_PHOTO.photo_url);

    expect(deleteChain.delete).toHaveBeenCalled();
    expect(deleteChain.eq).toHaveBeenCalledWith('id', 'photo-secondary');
    expect(storageChain.remove).toHaveBeenCalled();
    // is_primary is false → no further from() calls
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  test('promotes next photo as primary when deleted photo was primary', async () => {
    mockStorageFrom.mockReturnValue(makeStorageChain());

    const NEXT_PHOTO: PlantPhoto = { ...SECONDARY_PHOTO, photo_url: 'https://example.com/next.jpg' };

    const selectChain   = makeChain();
    selectChain.single.mockResolvedValue({ data: PRIMARY_PHOTO, error: null });
    const deleteChain   = makeChain({ data: null, error: null });
    const remainChain   = makeChain({ data: [NEXT_PHOTO], error: null });
    const promoteChain  = makeChain({ data: null, error: null });
    const collectionChain = makeChain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(selectChain)    // fetch photo to delete
      .mockReturnValueOnce(deleteChain)    // delete the row
      .mockReturnValueOnce(remainChain)    // find remaining photos
      .mockReturnValueOnce(promoteChain)   // set is_primary: true on next
      .mockReturnValueOnce(collectionChain); // update plant_collection (fire-and-forget)

    await deletePhoto('photo-primary', PRIMARY_PHOTO.photo_url);

    expect(promoteChain.update).toHaveBeenCalledWith({ is_primary: true });
    expect(promoteChain.eq).toHaveBeenCalledWith('id', NEXT_PHOTO.id);
    expect(collectionChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ photo_url: NEXT_PHOTO.photo_url }),
    );
  });

  test('clears plant_collection.photo_url when no photos remain after primary deletion', async () => {
    mockStorageFrom.mockReturnValue(makeStorageChain());

    const selectChain     = makeChain();
    selectChain.single.mockResolvedValue({ data: PRIMARY_PHOTO, error: null });
    const deleteChain     = makeChain({ data: null, error: null });
    const remainChain     = makeChain({ data: [], error: null }); // no remaining
    const collectionChain = makeChain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(deleteChain)
      .mockReturnValueOnce(remainChain)
      .mockReturnValueOnce(collectionChain);

    await deletePhoto('photo-primary', PRIMARY_PHOTO.photo_url);

    expect(collectionChain.update).toHaveBeenCalledWith({ photo_url: null });
  });

  test('returns early without DB calls when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await deletePhoto('photo-1', PRIMARY_PHOTO.photo_url);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('returns early without deleting if photo row is not found', async () => {
    mockStorageFrom.mockReturnValue(makeStorageChain());

    const selectChain = makeChain();
    selectChain.single.mockResolvedValue({ data: null, error: null }); // not found
    mockFrom.mockReturnValueOnce(selectChain);

    await deletePhoto('nonexistent-id', 'https://example.com/photo.jpg');

    // Only 1 from() call — the select; no delete, no storage remove
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });
});

// ─── setPrimaryPhoto ──────────────────────────────────────────────────────────

describe('setPrimaryPhoto', () => {
  test('clears is_primary on all plant photos, sets it on target, updates plant_collection', async () => {
    const clearAllChain   = makeChain({ data: null, error: null });
    const setTargetChain  = makeChain({ data: null, error: null });
    const collectionChain = makeChain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(clearAllChain)
      .mockReturnValueOnce(setTargetChain)
      .mockReturnValueOnce(collectionChain);

    await setPrimaryPhoto('photo-secondary', 'Monstera', 'https://example.com/new-primary.jpg');

    // Step 1: clear all is_primary for the plant
    expect(clearAllChain.update).toHaveBeenCalledWith({ is_primary: false });
    expect(clearAllChain.eq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(clearAllChain.ilike).toHaveBeenCalledWith('plant_name', 'Monstera');

    // Step 2: set target photo as primary
    expect(setTargetChain.update).toHaveBeenCalledWith({ is_primary: true });
    expect(setTargetChain.eq).toHaveBeenCalledWith('id', 'photo-secondary');

    // Step 3: update plant_collection.photo_url (fire-and-forget)
    expect(collectionChain.update).toHaveBeenCalledWith({ photo_url: 'https://example.com/new-primary.jpg' });
    expect(collectionChain.eq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(collectionChain.ilike).toHaveBeenCalledWith('plant_name', 'Monstera');
  });

  test('returns early without DB calls when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await setPrimaryPhoto('photo-1', 'Monstera', 'https://example.com/photo.jpg');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
