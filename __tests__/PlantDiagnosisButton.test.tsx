import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import PlantDiagnosisButton from '../components/PlantDiagnosisButton';

jest.mock('../logic/diagnosisLogic', () => ({
  diagnosePlant: jest.fn(),
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

import { diagnosePlant } from '../logic/diagnosisLogic';
import * as ImagePicker from 'expo-image-picker';
import { useToast } from '../context/ToastContext';

const mockDiagnosePlant = diagnosePlant as jest.Mock;
const mockRequestPermission = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const mockLaunchLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;

const healthyResult = {
  healthy: true,
  issues: [],
  diagnosis: 'Plant looks great.',
  recommendations: ['Keep watering regularly.'],
};

const unhealthyResult = {
  healthy: false,
  issues: ['Yellow leaves', 'Root rot'],
  diagnosis: 'Several issues detected.',
  recommendations: ['Reduce watering.', 'Check drainage.'],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRequestPermission.mockResolvedValue({ status: 'granted' });
  mockLaunchLibrary.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://photo.jpg' }],
  });
  mockDiagnosePlant.mockResolvedValue(healthyResult);
});

describe('PlantDiagnosisButton', () => {
  it('renders the diagnose button', () => {
    const { getByTestId } = render(<PlantDiagnosisButton plantName="Fern" />);
    expect(getByTestId('diagnose-button')).toBeTruthy();
  });

  it('shows ActivityIndicator while loading', async () => {
    mockDiagnosePlant.mockImplementation(() => new Promise(() => {}));
    const { getByTestId, queryByText } = render(<PlantDiagnosisButton plantName="Fern" />);
    fireEvent.press(getByTestId('diagnose-button'));
    await waitFor(() => {
      expect(queryByText('Diagnose Plant 🔬')).toBeNull();
    });
  });

  it('shows permission alert when denied (non-web)', async () => {
    mockRequestPermission.mockResolvedValue({ status: 'denied' });
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<PlantDiagnosisButton plantName="Fern" />);
    fireEvent.press(getByTestId('diagnose-button'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Permission required', expect.any(String));
    });
  });

  it('does nothing when picker is cancelled', async () => {
    mockLaunchLibrary.mockResolvedValue({ canceled: true });
    const { getByTestId, queryByText } = render(<PlantDiagnosisButton plantName="Fern" />);
    fireEvent.press(getByTestId('diagnose-button'));
    await waitFor(() => {
      expect(mockDiagnosePlant).not.toHaveBeenCalled();
      expect(queryByText('Done')).toBeNull();
    });
  });

  it('shows healthy result in modal', async () => {
    const { getByTestId, getByText } = render(<PlantDiagnosisButton plantName="Fern" />);
    fireEvent.press(getByTestId('diagnose-button'));
    await waitFor(() => {
      expect(getByText('✅ Plant looks healthy!')).toBeTruthy();
      expect(getByText('Plant looks great.')).toBeTruthy();
      expect(getByText('Keep watering regularly.')).toBeTruthy();
    });
  });

  it('shows unhealthy result with issues', async () => {
    mockDiagnosePlant.mockResolvedValue(unhealthyResult);
    const { getByTestId, getByText } = render(<PlantDiagnosisButton plantName="Fern" />);
    fireEvent.press(getByTestId('diagnose-button'));
    await waitFor(() => {
      expect(getByText('⚠️ Issues detected')).toBeTruthy();
      expect(getByText('Yellow leaves')).toBeTruthy();
      expect(getByText('Root rot')).toBeTruthy();
      expect(getByText('Reduce watering.')).toBeTruthy();
    });
  });

  it('calls onSuccess after successful diagnosis', async () => {
    const onSuccess = jest.fn();
    const { getByTestId } = render(<PlantDiagnosisButton plantName="Fern" onSuccess={onSuccess} />);
    fireEvent.press(getByTestId('diagnose-button'));
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('closes modal when Done is pressed', async () => {
    const { getByTestId, getByText, queryByText } = render(<PlantDiagnosisButton plantName="Fern" />);
    fireEvent.press(getByTestId('diagnose-button'));
    await waitFor(() => expect(getByText('Done')).toBeTruthy());
    fireEvent.press(getByText('Done'));
    await waitFor(() => {
      expect(queryByText('Plant looks great.')).toBeNull();
    });
  });

  it('shows toast on diagnosis error', async () => {
    const showToast = jest.fn();
    (useToast as jest.Mock).mockReturnValue({ showToast });
    mockDiagnosePlant.mockRejectedValue(new Error('Network error'));
    const { getByTestId } = render(<PlantDiagnosisButton plantName="Fern" />);
    fireEvent.press(getByTestId('diagnose-button'));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Network error', 'error');
    });
  });
});
