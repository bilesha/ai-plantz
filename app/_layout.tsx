import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import "../global.css";

export default function RootLayout() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

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
