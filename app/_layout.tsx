import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform, useColorScheme } from "react-native";
import "../global.css";

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('watering-reminders', {
        name: 'Watering Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: isDark ? '#0f172a' : '#f8fafc' },
        }}
      />
    </>
  );
}
