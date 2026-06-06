import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { cancelWateringReminder, WateringReminder } from '../../logic/reminderLogic';

type ReminderEntry = {
  plantName: string;
  intervalDays: number;
};

type AiProvider = 'gemini' | 'groq' | 'deepseek' | 'qwen' | 'moonshot';

const AI_PROVIDERS: { id: AiProvider; label: string }[] = [
  { id: 'gemini',   label: 'Gemini'   },
  { id: 'groq',     label: 'Groq'     },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'qwen',     label: 'Qwen'     },
  { id: 'moonshot', label: 'Moonshot' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const [reminders, setReminders] = useState<ReminderEntry[]>([]);
  const [aiProvider, setAiProvider] = useState<AiProvider>('gemini');

  const loadReminders = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const reminderKeys = keys.filter(k => k.startsWith('reminder_'));
      const entries = await AsyncStorage.multiGet(reminderKeys);
      const parsed: ReminderEntry[] = entries
        .filter(([ , val]) => val !== null)
        .map(([key, val]) => {
          const { intervalDays } = JSON.parse(val!) as WateringReminder;
          return { plantName: key.replace('reminder_', ''), intervalDays };
        });
      setReminders(parsed);
    } catch {
      setReminders([]);
    }
  };

  const loadAiProvider = async () => {
    const stored = await AsyncStorage.getItem('ai_provider');
    if (AI_PROVIDERS.some(p => p.id === stored)) setAiProvider(stored as AiProvider);
  };

  const handleSelectProvider = async (provider: AiProvider) => {
    setAiProvider(provider);
    await AsyncStorage.setItem('ai_provider', provider);
  };

  useFocusEffect(useCallback(() => {
    loadReminders();
    loadAiProvider();
  }, []));

  const handleCancelReminder = async (plantName: string) => {
    await cancelWateringReminder(plantName);
    setReminders(prev => prev.filter(r => r.plantName !== plantName));
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to log out?')) {
        supabase.auth.signOut();
      }
      return;
    }
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: () => supabase.auth.signOut() },
      ],
    );
  };

  const handleClearAllData = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('This will permanently delete your search history, cached tips, favourites, and all watering reminders.')) {
        await AsyncStorage.clear();
        setReminders([]);
      }
      return;
    }
    Alert.alert(
      'Clear all data',
      'This will permanently delete your search history, cached tips, favourites, and all watering reminders.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear everything',
          style: 'destructive',
          onPress: async () => {
            await Notifications.cancelAllScheduledNotificationsAsync();
            await AsyncStorage.clear();
            setReminders([]);
          },
        },
      ]
    );
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {Platform.OS === 'web' && (
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
      )}
      <Text style={s.title}>Settings</Text>

      <Text style={s.sectionLabel}>REMINDERS</Text>
      <View style={s.section}>
        {reminders.length === 0 ? (
          <Text style={s.emptyText}>No active reminders</Text>
        ) : (
          reminders.map((r, i) => (
            <View key={r.plantName} style={[s.row, i < reminders.length - 1 && s.rowBorder]}>
              <View style={s.rowInfo}>
                <Text style={s.rowTitle}>{r.plantName}</Text>
                <Text style={s.rowSub}>Every {r.intervalDays} {r.intervalDays === 1 ? 'day' : 'days'}</Text>
              </View>
              <TouchableOpacity onPress={() => handleCancelReminder(r.plantName)} style={s.cancelBtn}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <Text style={s.sectionLabel}>AI PROVIDER</Text>
      <View style={s.section}>
        {AI_PROVIDERS.map(({ id, label }, i) => (
          <TouchableOpacity
            key={id}
            style={[s.row, i < AI_PROVIDERS.length - 1 && s.rowBorder]}
            onPress={() => handleSelectProvider(id)}
          >
            <Text style={s.rowTitle}>{label}</Text>
            <Text style={[s.providerCheck, aiProvider === id && s.providerCheckActive]}>
              {aiProvider === id ? '●' : '○'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.sectionLabel}>ACCOUNT</Text>
      <View style={s.section}>
        <TouchableOpacity
          style={[s.row, s.rowBorder]}
          onPress={() => router.push('/screens/profile')}
        >
          <Text style={s.rowTitle}>Edit Profile</Text>
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.dangerRow} onPress={handleLogout}>
          <Text style={s.dangerText}>Log out</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.sectionLabel}>DATA</Text>
      <View style={s.section}>
        <TouchableOpacity style={s.dangerRow} onPress={handleClearAllData}>
          <Text style={s.dangerText}>Clear all data</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.sectionLabel}>ABOUT</Text>
      <View style={s.section}>
        <View style={s.aboutRow}>
          <Text style={s.aboutApp}>LeafyAI</Text>
          <Text style={s.aboutVersion}>v{version}</Text>
        </View>
        <Text style={s.aboutTagline}>Your AI Botanical Assistant</Text>
      </View>
    </ScrollView>
  );
}

const styles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  container:    { flex: 1, backgroundColor: t.background },
  content:      { padding: 24, paddingTop: 60, paddingBottom: 40 },
  title:        { fontSize: 28, fontWeight: '900', color: t.textTitle, marginBottom: 28 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: t.textMuted, letterSpacing: 1, marginBottom: 8, marginTop: 8 },
  section:      { backgroundColor: t.surface, borderRadius: 20, marginBottom: 24, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  emptyText:    { color: t.textMuted, fontSize: 15, padding: 18 },
  row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14 },
  rowBorder:    { borderBottomWidth: 1, borderBottomColor: t.border },
  rowInfo:      { flex: 1 },
  rowTitle:     { fontSize: 16, fontWeight: '700', color: t.textPrimary },
  rowSub:       { fontSize: 13, color: t.textSecondary, marginTop: 2 },
  cancelBtn:    { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, borderWidth: 1, borderColor: t.danger },
  cancelText:   { color: t.danger, fontSize: 13, fontWeight: '700' },
  backBtn:      { alignSelf: 'flex-start', marginBottom: 8 },
  backText:     { fontSize: 17, color: t.accent, fontWeight: '600' },
  chevron:      { fontSize: 20, color: t.textMuted },
  providerCheck:       { fontSize: 20, color: t.textMuted },
  providerCheckActive: { color: t.accent },
  dangerRow:    { paddingHorizontal: 18, paddingVertical: 16 },
  dangerText:   { color: t.danger, fontWeight: '700', fontSize: 16 },
  aboutRow:     { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 4 },
  aboutApp:     { fontSize: 18, fontWeight: '900', color: t.textTitle },
  aboutVersion: { fontSize: 14, color: t.textMuted },
  aboutTagline: { fontSize: 14, color: t.textSecondary, paddingHorizontal: 18, paddingBottom: 16 },
});
