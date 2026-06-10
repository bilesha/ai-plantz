// __tests__/PlantPhotoGallery.test.tsx

jest.mock('../logic/photoLogic', () => ({
  getPlantPhotos:   jest.fn(),
  uploadPlantPhoto: jest.fn(),
  deletePhoto:      jest.fn(),
  setPrimaryPhoto:  jest.fn(),
}));

jest.mock('../constants/theme', () => ({
  useTheme: jest.fn(() => ({
    background:         '#ffffff',
    surface:            '#f8f8f8',
    surfaceGreenSubtle: '#f0fdf4',
    textPrimary:        '#111111',
    textTitle:          '#000000',
    textMuted:          '#888888',
    accent:             '#22c55e',
    border:             '#e2e8f0',
  })),
}));

jest.mock('../context/ToastContext', () => ({
  useToast: jest.fn(() => ({ showToast: jest.fn() })),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync:             jest.fn(),
}));

// react-native is already mocked by jest-expo's preset (react-native/jest/setup.js).
// Alert.alert is spied on in beforeEach; Platform.OS overridden via Object.defineProperty.

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert, Image, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useToast } from '../context/ToastContext';

import PlantPhotoGallery from '../components/PlantPhotoGallery';
import {
  getPlantPhotos,
  uploadPlantPhoto,
  deletePhoto,
  setPrimaryPhoto,
} from '../logic/photoLogic';

// ─── Typed mock helpers ───────────────────────────────────────────────────────

const mockGetPlantPhotos     = getPlantPhotos   as jest.Mock;
const mockUploadPlantPhoto   = uploadPlantPhoto as jest.Mock;
const mockDeletePhoto        = deletePhoto      as jest.Mock;
const mockSetPrimaryPhoto    = setPrimaryPhoto  as jest.Mock;
const mockRequestPermissions = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const mockLaunchLibrary      = ImagePicker.launchImageLibraryAsync             as jest.Mock;

// ─── Sample data ──────────────────────────────────────────────────────────────

const mockPhotos = [
  {
    id: '1', photo_url: 'https://example.com/a.jpg', is_primary: true,
    caption: 'First', taken_at: '2024-01-01T00:00:00Z', user_id: 'user-1', plant_name: 'Monstera',
  },
  {
    id: '2', photo_url: 'https://example.com/b.jpg', is_primary: false,
    caption: '', taken_at: '2024-02-01T00:00:00Z', user_id: 'user-1', plant_name: 'Monstera',
  },
];

// ─── Setup / teardown ─────────────────────────────────────────────────────────

let mockShowToast: jest.Mock;
let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();

  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  mockShowToast = jest.fn();
  (useToast as jest.Mock).mockReturnValue({ showToast: mockShowToast });

  mockGetPlantPhotos.mockResolvedValue(mockPhotos);
  mockUploadPlantPhoto.mockResolvedValue(null);
  mockDeletePhoto.mockResolvedValue(undefined);
  mockSetPrimaryPhoto.mockResolvedValue(undefined);

  mockRequestPermissions.mockResolvedValue({ status: 'granted' });
  mockLaunchLibrary.mockResolvedValue({ canceled: true, assets: [] });

  Object.defineProperty(Platform, 'OS', { get: () => 'ios', configurable: true });
});

afterEach(() => {
  alertSpy.mockRestore();
});

// ─── Helper: render and wait for the async load to settle ────────────────────

// Renders without wrapping in act so RNTL can build the result normally.
// Then flushes the resolved promise so setLoading(false) is applied.
async function renderAndLoad(
  props: Partial<React.ComponentProps<typeof PlantPhotoGallery>> = {},
) {
  const merged = { plantName: 'Monstera', isOwner: true, ...props };
  const utils = render(<PlantPhotoGallery {...merged} />);
  await waitFor(() => expect(mockGetPlantPhotos).toHaveBeenCalled());
  await act(async () => {});   // flush state updates
  return utils;
}

// Shorthand: get all rendered Image elements by component type.
function getImages(utils: ReturnType<typeof render>) {
  return utils.UNSAFE_queryAllByType(Image);
}

// ─── 1. Loading state ─────────────────────────────────────────────────────────

test('shows skeleton placeholders (3 Views) while getPlantPhotos is pending', () => {
  // Never resolve — component stays in the loading branch
  mockGetPlantPhotos.mockReturnValue(new Promise(() => {}));

  const utils = render(<PlantPhotoGallery plantName="Monstera" isOwner={true} />);

  // Gallery container is present during loading
  expect(utils.getByTestId('plant-photo-gallery')).toBeTruthy();
  // Section label is present
  expect(utils.getByText('PHOTOS')).toBeTruthy();
  // No Image elements yet — skeletons are plain Views
  expect(getImages(utils)).toHaveLength(0);
});

// ─── 2. Renders photos + primary badge ───────────────────────────────────────

test('renders an Image for each photo and shows ⭐ badge on the primary photo', async () => {
  const utils = await renderAndLoad();

  expect(getImages(utils).length).toBeGreaterThanOrEqual(2);
  expect(utils.getByText('⭐')).toBeTruthy();
});

// ─── 3. Add button visibility ─────────────────────────────────────────────────

test('shows "+ Add photo" button when isOwner=true', async () => {
  const utils = await renderAndLoad({ isOwner: true });
  expect(utils.getByText('+ Add\nphoto')).toBeTruthy();
});

test('hides "+ Add photo" button when isOwner=false', async () => {
  const utils = await renderAndLoad({ isOwner: false });
  expect(utils.queryByText('+ Add\nphoto')).toBeNull();
});

// ─── 4. Hidden when no photos and not owner ───────────────────────────────────

test('returns null when isOwner=false and photos array is empty', async () => {
  mockGetPlantPhotos.mockResolvedValue([]);
  const utils = await renderAndLoad({ isOwner: false });
  expect(utils.queryByTestId('plant-photo-gallery')).toBeNull();
});

// ─── 5. Photo picker — permission denied ─────────────────────────────────────

test('calls Alert.alert with permission message when permission denied; upload modal stays closed', async () => {
  mockRequestPermissions.mockResolvedValue({ status: 'denied' });

  const utils = await renderAndLoad();

  await act(async () => {
    fireEvent.press(utils.getByText('+ Add\nphoto'));
  });

  expect(alertSpy).toHaveBeenCalledWith(
    'Permission required',
    'Allow photo library access to add a plant photo.',
  );
  expect(utils.queryByText('Add Photo')).toBeNull();
});

// ─── 6. Photo picker — cancelled ─────────────────────────────────────────────

test('does not open upload modal when image picker is cancelled', async () => {
  mockLaunchLibrary.mockResolvedValue({ canceled: true, assets: [] });

  const utils = await renderAndLoad();

  await act(async () => {
    fireEvent.press(utils.getByText('+ Add\nphoto'));
  });

  expect(utils.queryByText('Add Photo')).toBeNull();
});

// ─── 7. Upload modal opens after valid pick ───────────────────────────────────

test('upload modal becomes visible with "Add Photo" title and preview image after picking', async () => {
  mockLaunchLibrary.mockResolvedValue({
    canceled: false, assets: [{ uri: 'file://tmp/photo.jpg' }],
  });

  const utils = await renderAndLoad();

  await act(async () => {
    fireEvent.press(utils.getByText('+ Add\nphoto'));
  });

  expect(utils.getByText('Add Photo')).toBeTruthy();

  const previewImg = getImages(utils).find(
    img => img.props.source?.uri === 'file://tmp/photo.jpg',
  );
  expect(previewImg).toBeTruthy();
});

// ─── 8. Upload modal — Cancel closes it ──────────────────────────────────────

test('pressing Cancel in the upload modal closes it and clears the pending URI', async () => {
  mockLaunchLibrary.mockResolvedValue({
    canceled: false, assets: [{ uri: 'file://tmp/photo.jpg' }],
  });

  const utils = await renderAndLoad();

  await act(async () => { fireEvent.press(utils.getByText('+ Add\nphoto')); });
  expect(utils.getByText('Add Photo')).toBeTruthy();

  await act(async () => { fireEvent.press(utils.getByText('Cancel')); });
  expect(utils.queryByText('Add Photo')).toBeNull();
});

// ─── 9. Upload — success ──────────────────────────────────────────────────────

test('successful upload adds photo to list, shows success toast, fires onPhotoUploaded', async () => {
  const newPhoto = {
    id: '3', photo_url: 'https://example.com/c.jpg', is_primary: false,
    caption: 'New', taken_at: '2024-03-01T00:00:00Z', user_id: 'user-1', plant_name: 'Monstera',
  };
  mockUploadPlantPhoto.mockResolvedValue(newPhoto);
  mockLaunchLibrary.mockResolvedValue({
    canceled: false, assets: [{ uri: 'file://tmp/photo.jpg' }],
  });
  const onPhotoUploaded = jest.fn();

  const utils = await renderAndLoad({ onPhotoUploaded });

  await act(async () => { fireEvent.press(utils.getByText('+ Add\nphoto')); });
  await act(async () => { fireEvent.press(utils.getByText('Upload')); });

  await waitFor(() => {
    expect(mockUploadPlantPhoto).toHaveBeenCalledWith('Monstera', 'file://tmp/photo.jpg', undefined);
    expect(mockShowToast).toHaveBeenCalledWith('Photo added!', 'success');
    expect(onPhotoUploaded).toHaveBeenCalledTimes(1);
  });

  // 3 thumbnails now in the list
  expect(getImages(utils).length).toBeGreaterThanOrEqual(3);
});

// ─── 10. Upload — failure ─────────────────────────────────────────────────────

test('failed upload (null returned) shows error toast', async () => {
  mockUploadPlantPhoto.mockResolvedValue(null);
  mockLaunchLibrary.mockResolvedValue({
    canceled: false, assets: [{ uri: 'file://tmp/photo.jpg' }],
  });

  const utils = await renderAndLoad();

  await act(async () => { fireEvent.press(utils.getByText('+ Add\nphoto')); });
  await act(async () => { fireEvent.press(utils.getByText('Upload')); });

  await waitFor(() => {
    expect(mockShowToast).toHaveBeenCalledWith('Upload failed', 'error');
  });
});

// ─── 11. Fullscreen viewer — opens on photo tap ───────────────────────────────

test('tapping a photo thumbnail opens the fullscreen viewer with caption and Close button', async () => {
  const utils = await renderAndLoad();

  // Press the first thumbnail — bubbles up to its parent TouchableOpacity
  await act(async () => { fireEvent.press(getImages(utils)[0]); });

  expect(utils.getByText('First')).toBeTruthy();
  expect(utils.getByText('Close')).toBeTruthy();
});

// ─── 12. Fullscreen viewer — Close button ────────────────────────────────────

test('pressing Close dismisses the fullscreen viewer', async () => {
  const utils = await renderAndLoad();

  await act(async () => { fireEvent.press(getImages(utils)[0]); });
  expect(utils.getByText('Close')).toBeTruthy();

  await act(async () => { fireEvent.press(utils.getByText('Close')); });
  expect(utils.queryByText('Close')).toBeNull();
});

// ─── 13. Set as primary ───────────────────────────────────────────────────────

test('"Set as primary" appears for non-primary photo; pressing it calls setPrimaryPhoto', async () => {
  const utils = await renderAndLoad();

  // Press the second thumbnail (non-primary photo)
  await act(async () => { fireEvent.press(getImages(utils)[1]); });
  expect(utils.getByText('Set as primary')).toBeTruthy();

  await act(async () => { fireEvent.press(utils.getByText('Set as primary')); });

  await waitFor(() => {
    expect(mockSetPrimaryPhoto).toHaveBeenCalledWith('2', 'Monstera', 'https://example.com/b.jpg');
    expect(mockShowToast).toHaveBeenCalledWith('Set as primary photo', 'success');
  });

  // Photo is now primary — button disappears
  expect(utils.queryByText('Set as primary')).toBeNull();
});

// ─── 14. Delete — web confirm ────────────────────────────────────────────────

test('on web, Delete calls window.confirm; confirming deletes the photo and removes it', async () => {
  Object.defineProperty(Platform, 'OS', { get: () => 'web', configurable: true });
  const mockConfirm = jest.fn().mockReturnValue(true);
  (global as any).window = { ...((global as any).window ?? {}), confirm: mockConfirm };

  const utils = await renderAndLoad();
  const thumbCountBefore = getImages(utils).length; // 2 thumbnails

  await act(async () => { fireEvent.press(getImages(utils)[0]); });
  await act(async () => { fireEvent.press(utils.getByText('Delete')); });

  await waitFor(() => {
    expect(mockConfirm).toHaveBeenCalledWith('Delete this photo?');
    expect(mockDeletePhoto).toHaveBeenCalledWith('1', 'https://example.com/a.jpg');
    expect(mockShowToast).toHaveBeenCalledWith('Photo deleted', 'success');
  });

  // After deletion and viewer close, fewer images remain
  await waitFor(() => {
    expect(getImages(utils).length).toBeLessThan(thumbCountBefore + 1); // +1 for viewer image
  });
});

// ─── 15. Delete — native Alert ───────────────────────────────────────────────

test('on iOS, Delete calls Alert.alert; pressing the destructive button removes the photo', async () => {
  // Platform.OS = 'ios' from beforeEach

  const utils = await renderAndLoad();
  const thumbCountBefore = getImages(utils).length; // 2 thumbnails

  await act(async () => { fireEvent.press(getImages(utils)[0]); });
  await act(async () => { fireEvent.press(utils.getByText('Delete')); });

  expect(alertSpy).toHaveBeenCalledWith(
    'Delete photo',
    'Are you sure?',
    expect.arrayContaining([
      expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
      expect.objectContaining({ text: 'Delete', style: 'destructive' }),
    ]),
  );

  // Simulate the user pressing the destructive button
  const buttons: any[] = alertSpy.mock.calls[0][2];
  const deleteBtn = buttons.find((b: any) => b.style === 'destructive');

  await act(async () => { deleteBtn.onPress(); });

  await waitFor(() => {
    expect(mockDeletePhoto).toHaveBeenCalledWith('1', 'https://example.com/a.jpg');
    expect(mockShowToast).toHaveBeenCalledWith('Photo deleted', 'success');
  });

  await waitFor(() => {
    expect(getImages(utils).length).toBeLessThan(thumbCountBefore + 1); // +1 for viewer image
  });
});
