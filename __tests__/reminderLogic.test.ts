jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  scheduleWateringReminder,
  cancelWateringReminder,
  getWateringReminder,
} from '../app/logic/reminderLogic';

const mockPermissions  = Notifications.requestPermissionsAsync  as jest.Mock;
const mockSchedule     = Notifications.scheduleNotificationAsync as jest.Mock;
const mockCancel       = Notifications.cancelScheduledNotificationAsync as jest.Mock;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  (Platform as any).OS = 'ios';
});

describe('scheduleWateringReminder', () => {
  test('throws when running on web', async () => {
    (Platform as any).OS = 'web';
    await expect(scheduleWateringReminder('Monstera', 7)).rejects.toThrow('web');
  });

  test('throws when notification permission is denied', async () => {
    mockPermissions.mockResolvedValue({ status: 'denied' });
    await expect(scheduleWateringReminder('Monstera', 7)).rejects.toThrow('permission');
  });

  test('schedules a repeating TIME_INTERVAL trigger with the correct seconds', async () => {
    mockPermissions.mockResolvedValue({ status: 'granted' });
    mockSchedule.mockResolvedValue('notif-id-1');

    await scheduleWateringReminder('Monstera', 7);

    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({
          type: 'timeInterval',
          seconds: 7 * 24 * 60 * 60,
          repeats: true,
        }),
      })
    );
  });

  test('includes the plant name in the notification title and body', async () => {
    mockPermissions.mockResolvedValue({ status: 'granted' });
    mockSchedule.mockResolvedValue('notif-id-1');

    await scheduleWateringReminder('Peace Lily', 14);

    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: expect.stringContaining('Peace Lily'),
          body:  expect.stringContaining('Peace Lily'),
        }),
      })
    );
  });

  test('saves the notification id and intervalDays to AsyncStorage', async () => {
    mockPermissions.mockResolvedValue({ status: 'granted' });
    mockSchedule.mockResolvedValue('notif-id-42');

    await scheduleWateringReminder('Cactus', 30);

    const stored = await AsyncStorage.getItem('reminder_Cactus');
    expect(JSON.parse(stored!)).toEqual({ id: 'notif-id-42', intervalDays: 30 });
  });

  test('cancels any existing reminder for the plant before scheduling', async () => {
    await AsyncStorage.setItem('reminder_Fern', JSON.stringify({ id: 'old-id', intervalDays: 7 }));
    mockPermissions.mockResolvedValue({ status: 'granted' });
    mockSchedule.mockResolvedValue('new-id');

    await scheduleWateringReminder('Fern', 14);

    expect(mockCancel).toHaveBeenCalledWith('old-id');
  });
});

describe('cancelWateringReminder', () => {
  test('does nothing when no reminder is stored for the plant', async () => {
    await cancelWateringReminder('Orchid');
    expect(mockCancel).not.toHaveBeenCalled();
  });

  test('calls cancelScheduledNotificationAsync with the stored notification id', async () => {
    await AsyncStorage.setItem('reminder_Monstera', JSON.stringify({ id: 'notif-xyz', intervalDays: 7 }));

    await cancelWateringReminder('Monstera');

    expect(mockCancel).toHaveBeenCalledWith('notif-xyz');
  });

  test('removes the reminder key from AsyncStorage after cancelling', async () => {
    await AsyncStorage.setItem('reminder_Monstera', JSON.stringify({ id: 'notif-xyz', intervalDays: 7 }));

    await cancelWateringReminder('Monstera');

    expect(await AsyncStorage.getItem('reminder_Monstera')).toBeNull();
  });
});

describe('getWateringReminder', () => {
  test('returns null when no reminder is stored', async () => {
    expect(await getWateringReminder('Monstera')).toBeNull();
  });

  test('returns the stored reminder object', async () => {
    await AsyncStorage.setItem('reminder_ZZ Plant', JSON.stringify({ id: 'abc', intervalDays: 14 }));

    const result = await getWateringReminder('ZZ Plant');

    expect(result).toEqual({ id: 'abc', intervalDays: 14 });
  });
});
