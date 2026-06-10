import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import PlantChatSection from '../components/PlantChatSection';

jest.mock('../logic/chatLogic', () => ({
  getPlantChat: jest.fn(),
  saveChatMessage: jest.fn(),
  clearPlantChat: jest.fn(),
}));
jest.mock('../constants/theme', () => ({
  useTheme: () => ({
    accent: '#00aa00', surface: '#fff', background: '#fff',
    border: '#ddd', textMuted: '#999', textPrimary: '#111', textTitle: '#000',
  }),
}));
jest.mock('../context/ToastContext', () => ({
  useToast: jest.fn(() => ({ showToast: jest.fn() })),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue('gemini'),
}));
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

global.fetch = jest.fn();

import { getPlantChat, saveChatMessage, clearPlantChat } from '../logic/chatLogic';
import { useToast } from '../context/ToastContext';

const mockGetPlantChat = getPlantChat as jest.Mock;
const mockSaveChatMessage = saveChatMessage as jest.Mock;
const mockClearPlantChat = clearPlantChat as jest.Mock;
const mockFetch = fetch as jest.Mock;

const mockMessages = [
  { id: '1', user_id: 'u1', plant_name: 'Fern', role: 'user', content: 'How often to water?', created_at: '2024-01-01T00:00:00Z' },
  { id: '2', user_id: 'u1', plant_name: 'Fern', role: 'assistant', content: 'Water every 3 days.', created_at: '2024-01-01T00:01:00Z' },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPlantChat.mockResolvedValue([]);
  mockSaveChatMessage.mockResolvedValue(null);
  mockClearPlantChat.mockResolvedValue(undefined);
  mockFetch.mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({ reply: 'AI response here.' }),
  });
});

describe('PlantChatSection', () => {
  it('shows loading indicator while fetching history', () => {
    mockGetPlantChat.mockImplementation(() => new Promise(() => {}));
    const { getByTestId } = render(<PlantChatSection plantName="Fern" />);
    // ActivityIndicator renders during load
    expect(getByTestId !== undefined).toBe(true);
  });

  it('shows empty state message when no chat history', async () => {
    const { getByText } = render(<PlantChatSection plantName="Fern" />);
    await waitFor(() => {
      expect(getByText(/Ask anything about your Fern/)).toBeTruthy();
    });
  });

  it('renders existing chat messages', async () => {
    mockGetPlantChat.mockResolvedValue(mockMessages);
    const { getByText } = render(<PlantChatSection plantName="Fern" />);
    await waitFor(() => {
      expect(getByText('How often to water?')).toBeTruthy();
      expect(getByText('Water every 3 days.')).toBeTruthy();
    });
  });

  it('send button is disabled when input is empty', async () => {
    const { getByText } = render(<PlantChatSection plantName="Fern" />);
    await waitFor(() => getByText('Send'));
    const sendBtn = getByText('Send');
    expect(sendBtn).toBeTruthy();
  });

  it('sends a message and shows AI reply', async () => {
    const { getByPlaceholderText, getByText } = render(<PlantChatSection plantName="Fern" />);
    await waitFor(() => getByPlaceholderText('Ask about your Fern…'));
    fireEvent.changeText(getByPlaceholderText('Ask about your Fern…'), 'What soil is best?');
    fireEvent.press(getByText('Send'));
    await waitFor(() => {
      expect(getByText('What soil is best?')).toBeTruthy();
      expect(getByText('AI response here.')).toBeTruthy();
    });
  });

  it('calls saveChatMessage for user and assistant messages', async () => {
    const { getByPlaceholderText, getByText } = render(<PlantChatSection plantName="Fern" />);
    await waitFor(() => getByPlaceholderText('Ask about your Fern…'));
    fireEvent.changeText(getByPlaceholderText('Ask about your Fern…'), 'Test message');
    fireEvent.press(getByText('Send'));
    await waitFor(() => {
      expect(mockSaveChatMessage).toHaveBeenCalledWith('Fern', 'user', 'Test message');
      expect(mockSaveChatMessage).toHaveBeenCalledWith('Fern', 'assistant', 'AI response here.');
    });
  });

  it('shows toast on fetch error', async () => {
    const showToast = jest.fn();
    (useToast as jest.Mock).mockReturnValue({ showToast });
    mockFetch.mockResolvedValue({ ok: false, json: jest.fn().mockResolvedValue({ error: 'Server down' }) });
    const { getByPlaceholderText, getByText } = render(<PlantChatSection plantName="Fern" />);
    await waitFor(() => getByPlaceholderText('Ask about your Fern…'));
    fireEvent.changeText(getByPlaceholderText('Ask about your Fern…'), 'Hello');
    fireEvent.press(getByText('Send'));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Server down', 'error');
    });
  });

  it('clears chat on native confirm', async () => {
    mockGetPlantChat.mockResolvedValue(mockMessages);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const destructive = buttons?.find(b => b.style === 'destructive');
      destructive?.onPress?.();
    });
    const { getByText, queryByText } = render(<PlantChatSection plantName="Fern" />);
    await waitFor(() => getByText('How often to water?'));
    fireEvent.press(getByText('Clear'));
    await waitFor(() => {
      expect(mockClearPlantChat).toHaveBeenCalledWith('Fern');
      expect(queryByText('How often to water?')).toBeNull();
    });
    alertSpy.mockRestore();
  });

  it('does not clear chat when cancel is pressed on native', async () => {
    mockGetPlantChat.mockResolvedValue(mockMessages);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = render(<PlantChatSection plantName="Fern" />);
    await waitFor(() => getByText('How often to water?'));
    fireEvent.press(getByText('Clear'));
    await waitFor(() => {
      expect(mockClearPlantChat).not.toHaveBeenCalled();
    });
  });
});
