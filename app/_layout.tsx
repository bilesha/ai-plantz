import { type Session } from "@supabase/supabase-js";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View, useColorScheme } from "react-native";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";
import { supabase } from "../lib/supabase";
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
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  // undefined = still loading, null = no session, Session = logged in
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('watering-reminders', {
        name: 'Watering Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Wait until the navigator is mounted and session is resolved before redirecting.
    if (!navigationState?.key || session === undefined) return;

    SplashScreen.hideAsync();

    const onAuthScreen = segments[0] === 'screens' && segments[1] === 'auth';

    if (!session && !onAuthScreen) {
      router.replace('/screens/auth');
    } else if (session && onAuthScreen) {
      router.replace('/');
    }
  }, [session, segments, navigationState?.key]);

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
