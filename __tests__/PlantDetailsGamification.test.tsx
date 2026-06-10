import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PlantDetailsAiGenerated from '../app/screens/PlantDetailsAiGenerated';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useLocalSearchParams: () => ({ plantName: 'Monstera', summary: 'A lovely plant' }),
}));
jest.mock('../constants/theme', () => ({
  useTheme: () => ({
    accent: '#00aa00', accentDark: '#007700', accentMid: '#00cc00',
    surface: '#fff', surfaceGreenSubtle: '#f0fff0', surfaceGreen: '#e0ffe0',
    background: '#f9f9f9', border: '#ddd', borderGreen: '#cce',
    textMuted: '#999', textPrimary: '#111', textTitle: '#000',
    textHeading: '#000', textBody: '#222', textSecondary: '#555',
    danger: '#ef4444',
  }),
}));
jest.mock('../context/ToastContext', () => ({
  useToast: jest.fn(() => ({ showToast: jest.fn() })),
}));
jest.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null } }) } },
}));
jest.mock('../logic/gamificationLogic', () => ({
  recordActivity: jest.fn().mockResolvedValue(undefined),
  checkAndAwardBadges: jest.fn().mockResolvedValue(undefined),
  updateLeaderboard: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../logic/collectionLogic', () => ({
  addToCollection: jest.fn(),
  removeFromCollection: jest.fn().mockResolvedValue(undefined),
  getCollectionEntry: jest.fn().mockResolvedValue(null),
  updateCollectionEntry: jest.fn().mockResolvedValue(undefined),
  getCollection: jest.fn().mockResolvedValue([]),
}));
jest.mock('../logic/cacheLogic', () => ({
  getPlantDetailsFromCache: jest.fn().mockResolvedValue({ watering: 'Weekly', light: 'Indirect', fertilizer: 'Monthly', careLevel: 'easy', toxicity: 'Non-toxic', funFact: 'Fun!', seasonalCare: 'Normal', compatibility: 'Good', propagation: 'Easy', pairingPlants: 'Pothos', troubleshooting: 'None' }),
  savePlantDetailsToCache: jest.fn().mockResolvedValue(undefined),
  getPlantImageFromCache: jest.fn().mockResolvedValue(null),
  savePlantImageToCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../logic/reminderLogic', () => ({
  getWateringReminder: jest.fn().mockResolvedValue(null),
  scheduleWateringReminder: jest.fn().mockResolvedValue(undefined),
  cancelWateringReminder: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../logic/listingLogic', () => ({
  getMyListingForPlant: jest.fn().mockResolvedValue(null),
  createListing: jest.fn().mockResolvedValue(undefined),
  deleteListing: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../logic/deathLogLogic', () => ({
  addDeathEntry: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../utilities/fetchPlantTips', () => ({
  getPlantTips: jest.fn().mockResolvedValue({ details: {} }),
}));
jest.mock('../utilities/fetchPlantImage', () => ({
  fetchPlantImage: jest.fn().mockResolvedValue(null),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue('gemini'),
  setItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
}));
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});
jest.mock('../components/PlantPhotoGallery', () => () => null);
jest.mock('../components/PlantDiagnosisButton', () => () => null);
jest.mock('../components/PlantChatSection', () => () => null);
jest.mock('../components/PlantSocialSection', () => () => null);
jest.mock('../components/SkeletonLoader', () => ({ CardSkeleton: () => null }));
jest.mock('../components/HealthLogSection', () => () => null);
jest.mock('../components/SeasonalAdviceSection', () => () => null);
jest.mock('../components/WateringSection', () => () => null);

import { recordActivity, checkAndAwardBadges, updateLeaderboard } from '../logic/gamificationLogic';
import { addToCollection, getCollection } from '../logic/collectionLogic';

const mockRecordActivity = recordActivity as jest.Mock;
const mockCheckAndAwardBadges = checkAndAwardBadges as jest.Mock;
const mockUpdateLeaderboard = updateLeaderboard as jest.Mock;
const mockAddToCollection = addToCollection as jest.Mock;
const mockGetCollection = getCollection as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockAddToCollection.mockResolvedValue({ success: true });
  mockGetCollection.mockResolvedValue([{ name: 'Monstera' }]);
});

describe('PlantDetailsAiGenerated — gamification wiring', () => {
  it('calls recordActivity after adding to collection', async () => {
    const { getByText } = render(<PlantDetailsAiGenerated />);
    await waitFor(() => getByText(/Save to Collection/i));
    fireEvent.press(getByText(/Save to Collection/i));
    await waitFor(() => getByText('Own it'));
    fireEvent.press(getByText('Own it'));
    await waitFor(() => getByText('Save'));
    fireEvent.press(getByText('Save'));
    await waitFor(() => {
      expect(mockRecordActivity).toHaveBeenCalled();
    });
  });

  it('calls checkAndAwardBadges with collectionCount after adding', async () => {
    const { getByText } = render(<PlantDetailsAiGenerated />);
    await waitFor(() => getByText(/Save to Collection/i));
    fireEvent.press(getByText(/Save to Collection/i));
    await waitFor(() => getByText('Own it'));
    fireEvent.press(getByText('Own it'));
    await waitFor(() => getByText('Save'));
    fireEvent.press(getByText('Save'));
    await waitFor(() => {
      expect(mockCheckAndAwardBadges).toHaveBeenCalledWith(
        expect.objectContaining({ collectionCount: 1 }),
      );
    });
  });

  it('calls updateLeaderboard after adding to collection', async () => {
    const { getByText } = render(<PlantDetailsAiGenerated />);
    await waitFor(() => getByText(/Save to Collection/i));
    fireEvent.press(getByText(/Save to Collection/i));
    await waitFor(() => getByText('Own it'));
    fireEvent.press(getByText('Own it'));
    await waitFor(() => getByText('Save'));
    fireEvent.press(getByText('Save'));
    await waitFor(() => {
      expect(mockUpdateLeaderboard).toHaveBeenCalled();
    });
  });

  it('does not call gamification functions when addToCollection fails', async () => {
    mockAddToCollection.mockResolvedValue({ success: false, error: 'DB error' });
    const { getByText } = render(<PlantDetailsAiGenerated />);
    await waitFor(() => getByText(/Save to Collection/i));
    fireEvent.press(getByText(/Save to Collection/i));
    await waitFor(() => getByText('Own it'));
    fireEvent.press(getByText('Own it'));
    await waitFor(() => getByText('Save'));
    fireEvent.press(getByText('Save'));
    await waitFor(() => {
      expect(mockRecordActivity).not.toHaveBeenCalled();
      expect(mockCheckAndAwardBadges).not.toHaveBeenCalled();
      expect(mockUpdateLeaderboard).not.toHaveBeenCalled();
    });
  });
});
