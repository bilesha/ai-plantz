import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type WateringReminder = {
  id: string;
  intervalDays: number;
};

export async function scheduleWateringReminder(
  plantName: string,
  intervalDays: number,
): Promise<void> {
  if (Platform.OS === 'web') throw new Error('Notifications are not supported on web.');

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') throw new Error('Notification permission denied.');

  await cancelWateringReminder(plantName);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Time to water your ${plantName}! 💧`,
      body: `Your ${plantName} is due for watering today.`,
      data: { plantName },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: intervalDays * 24 * 60 * 60,
      repeats: true,
    },
  });

  await AsyncStorage.setItem(`reminder_${plantName}`, JSON.stringify({ id, intervalDays }));
}

export async function cancelWateringReminder(plantName: string): Promise<void> {
  const stored = await AsyncStorage.getItem(`reminder_${plantName}`);
  if (!stored) return;
  const { id } = JSON.parse(stored) as WateringReminder;
  await Notifications.cancelScheduledNotificationAsync(id);
  await AsyncStorage.removeItem(`reminder_${plantName}`);
}

export async function getWateringReminder(plantName: string): Promise<WateringReminder | null> {
  const stored = await AsyncStorage.getItem(`reminder_${plantName}`);
  return stored ? (JSON.parse(stored) as WateringReminder) : null;
}
