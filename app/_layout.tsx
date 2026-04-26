import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Platform, StyleSheet, Text, View, useColorScheme } from "react-native";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";
import "../global.css";

SplashScreen.preventAutoHideAsync();

function ErrorFallback({ error }: FallbackProps) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <View style={eb.container}>
      <Text style={eb.icon}>🌿</Text>
      <Text style={eb.heading}>Something went wrong</Text>
      <Text style={eb.message}>{message}</Text>
    </View>
  );
}

const eb = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#f8fafc' },
  icon:      { fontSize: 40, marginBottom: 16 },
  heading:   { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  message:   { fontSize: 14, color: '#64748b', textAlign: 'center' },
});

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
    SplashScreen.hideAsync();
  }, []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: isDark ? '#0f172a' : '#f8fafc' },
        }}
      />
    </ErrorBoundary>
  );
}
