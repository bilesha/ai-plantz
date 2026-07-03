import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import PlantIdentifyCard from '../components/PlantIdentifyCard';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('../logic/identifyLogic', () => ({
  identifyPlant: jest.fn(),
}));
jest.mock('../constants/theme', () => ({
  useTheme: () => ({
    accent: '#00aa00', surface: '#fff', surfaceGreenSubtle: '#f0fff0',
    textTitle: '#000', textPrimary: '#111', textMuted: '#999',
    background: '#fff', border: '#ddd',
  }),
}));
jest.mock('../context/ToastContext', () => ({
  useToast: jest.fn(() => ({ showToast: jest.fn() })),
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn().mockResolvedValue('base64data'),
  EncodingType: { Base64: 'base64' },
}));

import { identifyPlant } from '../logic/identifyLogic';
import * as ImagePicker from 'expo-image-picker';
import { useToast } from '../context/ToastContext';

const mockIdentifyPlant = identifyPlant as jest.Mock;
const mockRequestPermission = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const mockLaunchLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;

const plantResult = {
  isPlant: true,
  plantName: 'Snake Plant',
  scientificName: 'Dracaena trifasciata',
  confidence: 'high',
  description: 'Stiff upright sword-shaped leaves.',
};

const notAPlantResult = {
  isPlant: false,
  plantName: '',
  scientificName: '',
  confidence: 'low',
  description: 'The image appears to show a coffee mug.',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRequestPermission.mockResolvedValue({ status: 'granted' });
  mockLaunchLibrary.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://photo.jpg' }],
  });
  mockIdentifyPlant.mockResolvedValue(plantResult);
});

describe('PlantIdentifyCard', () => {
  it('renders the identify card', () => {
    const { getByTestId } = render(<PlantIdentifyCard />);
    expect(getByTestId('identify-plant-card')).toBeTruthy();
  });

  it('shows permission alert when denied (non-web)', async () => {
    mockRequestPermission.mockResolvedValue({ status: 'denied' });
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<PlantIdentifyCard />);
    fireEvent.press(getByTestId('identify-plant-card'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Permission required', expect.any(String));
    });
  });

  it('does nothing when picker is cancelled', async () => {
    mockLaunchLibrary.mockResolvedValue({ canceled: true });
    const { getByTestId, queryByText } = render(<PlantIdentifyCard />);
    fireEvent.press(getByTestId('identify-plant-card'));
    await waitFor(() => {
      expect(mockIdentifyPlant).not.toHaveBeenCalled();
      expect(queryByText('Close')).toBeNull();
    });
  });

  it('shows identification result in modal', async () => {
    const { getByTestId, getByText } = render(<PlantIdentifyCard />);
    fireEvent.press(getByTestId('identify-plant-card'));
    await waitFor(() => {
      expect(getByText('Snake Plant')).toBeTruthy();
      expect(getByText('Dracaena trifasciata')).toBeTruthy();
      expect(getByText('High confidence')).toBeTruthy();
      expect(getByText('Stiff upright sword-shaped leaves.')).toBeTruthy();
    });
  });

  it('shows not-a-plant result without care tips button', async () => {
    mockIdentifyPlant.mockResolvedValue(notAPlantResult);
    const { getByTestId, getByText, queryByTestId } = render(<PlantIdentifyCard />);
    fireEvent.press(getByTestId('identify-plant-card'));
    await waitFor(() => {
      expect(getByText('No plant found 🤔')).toBeTruthy();
      expect(getByText('The image appears to show a coffee mug.')).toBeTruthy();
      expect(queryByTestId('identify-view-tips')).toBeNull();
    });
  });

  it('navigates to plant details when View Care Tips is pressed', async () => {
    const { getByTestId } = render(<PlantIdentifyCard />);
    fireEvent.press(getByTestId('identify-plant-card'));
    await waitFor(() => expect(getByTestId('identify-view-tips')).toBeTruthy());
    fireEvent.press(getByTestId('identify-view-tips'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/screens/PlantDetailsAiGenerated',
      params: { plantName: 'Snake Plant' },
    });
  });

  it('closes modal when Close is pressed', async () => {
    const { getByTestId, getByText, queryByText } = render(<PlantIdentifyCard />);
    fireEvent.press(getByTestId('identify-plant-card'));
    await waitFor(() => expect(getByText('Close')).toBeTruthy());
    fireEvent.press(getByText('Close'));
    await waitFor(() => {
      expect(queryByText('Snake Plant')).toBeNull();
    });
  });

  it('shows toast on identification error', async () => {
    const showToast = jest.fn();
    (useToast as jest.Mock).mockReturnValue({ showToast });
    mockIdentifyPlant.mockRejectedValue(new Error('Network error'));
    const { getByTestId } = render(<PlantIdentifyCard />);
    fireEvent.press(getByTestId('identify-plant-card'));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Network error', 'error');
    });
  });
});
