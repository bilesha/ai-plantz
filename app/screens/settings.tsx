// Required Supabase RPC for account deletion:
//   create or replace function delete_user()
//   returns void language plpgsql security definer as $$
//   begin
//     delete from auth.users where id = auth.uid();
//   end;
//   $$;

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../constants/theme';
import { useThemePreference, type ThemePreference } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { getCollection } from '../../logic/collectionLogic';
import { getAllHealthLogs } from '../../logic/healthLogLogic';
import { cancelWateringReminder, WateringReminder } from '../../logic/reminderLogic';
import { getWateringLog } from '../../logic/wateringLogic';
import { requestAndSaveLocation } from '../../logic/locationLogic';

type ReminderEntry = {
  plantName: string;
  intervalDays: number;
};

type AiProvider = 'gemini' | 'groq' | 'deepseek' | 'qwen' | 'moonshot';

const APPEARANCE_OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: 'light', label: '☀️  Light' },
  { id: 'dark',  label: '🌙  Dark'  },
  { id: 'auto',  label: '🌓  Auto'  },
];

function getInitials(str: string): string {
  const parts = str.trim().split(/[\s._@]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return str.slice(0, 2).toUpperCase();
}

function csvField(val: string | number | null | undefined): string {
  if (val == null) return '';
  const s = String(val);
  return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

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
  const { preference: themePreference, setPreference: setThemePreference } = useThemePreference();
  const [reminders, setReminders] = useState<ReminderEntry[]>([]);
  const [aiProvider, setAiProvider] = useState<AiProvider>('gemini');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [cacheCount, setCacheCount] = useState(0);
  const [dataMsg, setDataMsg] = useState<string | null>(null);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [locationUpdatedAt, setLocationUpdatedAt] = useState<string | null>(null);
  const { showToast } = useToast();

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
    let stored: string | null = null;
    if (Platform.OS === 'web') stored = localStorage.getItem('ai_provider');
    if (!stored) stored = await AsyncStorage.getItem('ai_provider');
    if (AI_PROVIDERS.some(p => p.id === stored)) setAiProvider(stored as AiProvider);
  };

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setProfileEmail(user.email ?? '');
      const { data } = await supabase
        .from('profiles')
        .select('username, avatar_url, location_updated_at')
        .eq('id', user.id)
        .maybeSingle();
      setProfileUsername((data as any)?.username ?? null);
      setProfileAvatarUrl((data as any)?.avatar_url ?? null);
      setLocationUpdatedAt((data as any)?.location_updated_at ?? null);
      setAvatarError(false);
    } catch {}
  };

  const loadCacheCount = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      setCacheCount(keys.filter(k => k.startsWith('cache_') || k.startsWith('image_')).length);
    } catch {}
  };

  const handleSelectProvider = async (provider: AiProvider) => {
    setAiProvider(provider);
    await AsyncStorage.setItem('ai_provider', provider);
    if (Platform.OS === 'web') localStorage.setItem('ai_provider', provider);
  };

  const showConfirm = (message: string, action: () => void) => {
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setConfirmVisible(true);
  };

  useFocusEffect(useCallback(() => {
    loadReminders();
    loadAiProvider();
    loadProfile();
    loadCacheCount();
  }, []));

  useEffect(() => {
    if (!dataMsg) return;
    const t = setTimeout(() => setDataMsg(null), 3000);
    return () => clearTimeout(t);
  }, [dataMsg]);

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      showToast('Password must be at least 8 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordLoading(false);
    if (error) {
      showToast(error.message, 'error');
      return;
    }
    showToast('Password updated', 'success');
    setChangePasswordVisible(false);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleClearCache = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith('cache_') || k.startsWith('image_'));
      await AsyncStorage.multiRemove(cacheKeys);
      setCacheCount(0);
      setDataMsg('Cache cleared ✓');
    } catch {
      setDataMsg('Failed to clear cache');
    }
  };

  const handleExportCsv = async () => {
    try {
      const collection = await getCollection();
      const plantNames = collection.map(e => e.name);

      const [wateringResults, healthLogs] = await Promise.all([
        Promise.all(collection.map(async e => ({ name: e.name, log: await getWateringLog(e.name) }))),
        getAllHealthLogs(plantNames),
      ]);

      const wateringByName: Record<string, Awaited<ReturnType<typeof getWateringLog>>> = {};
      for (const { name, log } of wateringResults) wateringByName[name] = log;

      const header = 'Plant Name,Status,Rating,Notes,Added Date,Watering Interval (days),Last Watered,Watering Count,Health Notes Count,Latest Health Note';
      const rows = collection.map(e => {
        const wLog = wateringByName[e.name] ?? [];
        const hLog = healthLogs[e.name] ?? [];
        const latestNote = (hLog[0]?.note ?? '').replace(/,/g, ';').replace(/[\r\n]+/g, ' ');
        return [
          csvField(e.name),
          csvField(e.status),
          csvField(e.rating),
          csvField(e.notes),
          csvField(new Date(e.addedAt).toLocaleDateString()),
          csvField(e.watering_interval_days),
          csvField(wLog[0]?.watered_at ? new Date(wLog[0].watered_at).toLocaleDateString() : ''),
          csvField(wLog.length),
          csvField(hLog.length),
          csvField(latestNote),
        ].join(',');
      });
      const csv = [header, ...rows].join('\n');

      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plant-collection.csv';
        a.click();
        URL.revokeObjectURL(url);
        setDataMsg('Collection exported ✓');
      } else {
        await Share.share({ title: 'Plant Collection', message: csv });
        setDataMsg('Collection exported ✓');
      }
    } catch {
      setDataMsg('Export failed');
    }
  };

  const handleDeleteConfirmed = async () => {
    await supabase.rpc('delete_user');
    await performLogout();
  };

  const handleDeleteAccount = () => {
    showConfirm('This will permanently delete your account and all data. This cannot be undone.', handleDeleteConfirmed);
  };

  const handleUpdateLocation = async () => {
    try {
      const loc = await requestAndSaveLocation();
      if (loc) {
        setLocationUpdatedAt(new Date().toISOString());
        showToast('Location saved — seasonal tips will be personalised', 'success');
      } else {
        showToast('Location permission denied', 'error');
      }
    } catch {
      showToast('Could not get location', 'error');
    }
  };

  const handleCancelReminder = async (plantName: string) => {
    await cancelWateringReminder(plantName);
    setReminders(prev => prev.filter(r => r.plantName !== plantName));
  };

  const performLogout = async () => {
    if (Platform.OS !== 'web') {
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
    await AsyncStorage.clear();
    await supabase.auth.signOut();
  };

  const handleLogoutConfirmed = () => performLogout();

  const handleLogout = () => {
    showConfirm('Are you sure you want to log out?', handleLogoutConfirmed);
  };

  const handleClearAllDataConfirmed = async () => {
    if (Platform.OS !== 'web') {
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
    await AsyncStorage.clear();
    setReminders([]);
  };

  const handleClearAllData = () => {
    showConfirm('This will clear all local data including your plant history and cache.', handleClearAllDataConfirmed);
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <>
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {Platform.OS === 'web' && (
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
      )}
      <Text style={s.title}>Settings</Text>

      <TouchableOpacity style={s.profileCard} onPress={() => router.push('/screens/editProfile')} activeOpacity={0.8}>
        {!avatarError && profileAvatarUrl?.startsWith('http') ? (
          <Image
            source={{ uri: profileAvatarUrl }}
            style={s.profileAvatar}
            onError={() => setAvatarError(true)}
          />
        ) : (
          <View style={s.profileAvatarPlaceholder}>
            <Text style={s.profileAvatarInitials}>
              {getInitials(profileUsername || profileEmail || '?')}
            </Text>
          </View>
        )}
        <View style={s.profileCardText}>
          <Text style={s.profileName} numberOfLines={1}>
            {profileUsername || 'Plant Lover'}
          </Text>
          <Text style={s.profileEmail} numberOfLines={1}>{profileEmail}</Text>
        </View>
        <Text style={s.chevron}>›</Text>
      </TouchableOpacity>

      <Text style={s.sectionLabel}>APPEARANCE</Text>
      <View style={s.section}>
        {APPEARANCE_OPTIONS.map(({ id, label }, i) => (
          <TouchableOpacity
            key={id}
            style={[s.row, i < APPEARANCE_OPTIONS.length - 1 && s.rowBorder]}
            onPress={() => setThemePreference(id)}
          >
            <Text style={s.rowTitle}>{label}</Text>
            <Text style={[s.providerCheck, themePreference === id && s.providerCheckActive]}>
              {themePreference === id ? '●' : '○'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
            testID={`settings-ai-provider-${id}`}
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

      <Text style={s.sectionLabel}>LOCATION</Text>
      <View style={s.section}>
        <TouchableOpacity
          testID="settings-location-row"
          style={s.row}
          onPress={handleUpdateLocation}
        >
          <View style={s.rowInfo}>
            <Text style={s.rowTitle}>
              {locationUpdatedAt ? '📍 Location saved ✓' : '📍 Update location'}
            </Text>
            {locationUpdatedAt ? (
              <Text style={s.rowSub}>
                Updated {new Date(locationUpdatedAt).toLocaleDateString()}
              </Text>
            ) : null}
          </View>
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>
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
        <TouchableOpacity
          testID="settings-change-password"
          style={[s.row, s.rowBorder]}
          onPress={() => setChangePasswordVisible(true)}
        >
          <Text style={s.rowTitle}>Change Password</Text>
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="settings-logout" style={[s.dangerRow, s.rowBorder]} onPress={handleLogout}>
          <Text style={s.dangerText}>Log out</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="settings-delete-account" style={s.dangerRow} onPress={handleDeleteAccount}>
          <Text style={s.dangerText}>Delete Account</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.sectionLabel}>DATA</Text>
      {dataMsg && (
        <View style={s.dataMsgBanner}>
          <Text style={s.dataMsgText}>{dataMsg}</Text>
        </View>
      )}
      <View style={s.section}>
        <TouchableOpacity style={[s.row, s.rowBorder]} onPress={handleClearCache}>
          <View style={s.rowInfo}>
            <Text style={s.rowTitle}>Clear Cache</Text>
            {cacheCount > 0 && (
              <Text style={s.rowSub}>{cacheCount} cached {cacheCount === 1 ? 'entry' : 'entries'}</Text>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity testID="settings-export-csv" style={[s.row, s.rowBorder]} onPress={handleExportCsv}>
          <Text style={s.rowTitle}>Export Collection</Text>
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.row, s.rowBorder]} onPress={() => router.push('/screens/deathLog')}>
          <Text style={s.rowTitle}>☠️ Death Log</Text>
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>
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

    <Modal
      visible={changePasswordVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setChangePasswordVisible(false)}
    >
      <View style={s.modalOverlay}>
        <View style={s.modalBox}>
          <Text style={s.modalTitle}>Change Password</Text>

          <Text style={s.modalLabel}>NEW PASSWORD</Text>
          <TextInput
            style={s.modalInput}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="Min. 8 characters"
            placeholderTextColor={theme.textMuted}
          />

          <Text style={s.modalLabel}>CONFIRM PASSWORD</Text>
          <TextInput
            style={s.modalInput}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="Re-enter password"
            placeholderTextColor={theme.textMuted}
          />

          <TouchableOpacity
            style={[s.modalSaveBtn, passwordLoading && s.modalBtnDisabled]}
            onPress={handleChangePassword}
            disabled={passwordLoading}
          >
            {passwordLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.modalSaveBtnText}>Update Password</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setChangePasswordVisible(false); setNewPassword(''); setConfirmPassword(''); }}
            style={s.modalCancelBtn}
          >
            <Text style={s.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>

    <Modal
      visible={confirmVisible}
      transparent
      animationType="fade"
      onRequestClose={() => { setConfirmVisible(false); setConfirmAction(null); }}
    >
      <View style={s.modalOverlay}>
        <View style={s.modalBox}>
          <Text style={s.modalTitle}>{confirmMessage}</Text>
          <TouchableOpacity
            testID="confirm-modal-confirm"
            style={s.modalDangerBtn}
            onPress={() => { confirmAction?.(); setConfirmVisible(false); setConfirmAction(null); }}
          >
            <Text style={s.modalSaveBtnText}>Confirm</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="confirm-modal-cancel"
            onPress={() => { setConfirmVisible(false); setConfirmAction(null); }}
            style={s.modalCancelBtn}
          >
            <Text style={s.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
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
  // profile card
  profileCard:             { flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface, borderRadius: 20, padding: 16, marginBottom: 28, gap: 14, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  profileAvatar:           { width: 52, height: 52, borderRadius: 26, backgroundColor: t.border },
  profileAvatarPlaceholder:{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.accent, justifyContent: 'center', alignItems: 'center' },
  profileAvatarInitials:   { fontSize: 18, fontWeight: '900', color: '#fff' },
  profileCardText:         { flex: 1 },
  profileName:             { fontSize: 16, fontWeight: '700', color: t.textPrimary },
  profileEmail:            { fontSize: 13, color: t.textMuted, marginTop: 2 },
  // data message banner
  dataMsgBanner: { backgroundColor: t.surfaceGreenSubtle, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 10, borderWidth: 1, borderColor: t.accentMid },
  dataMsgText:   { color: t.accentDark, fontWeight: '700', fontSize: 14, textAlign: 'center' as const },
  // change password modal
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox:        { backgroundColor: t.surface, borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 },
  modalTitle:      { fontSize: 18, fontWeight: '800', color: t.textTitle, marginBottom: 20 },
  modalLabel:      { fontSize: 12, fontWeight: '700', color: t.textMuted, letterSpacing: 0.8, marginBottom: 6, marginTop: 12 },
  modalInput:      { backgroundColor: t.background, borderWidth: 1.5, borderColor: t.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: t.textPrimary },
  modalSaveBtn:    { backgroundColor: t.accent, padding: 14, borderRadius: 16, alignItems: 'center' as const, marginTop: 20 },
  modalDangerBtn:  { backgroundColor: t.danger, padding: 14, borderRadius: 16, alignItems: 'center' as const, marginTop: 20 },
  modalSaveBtnText:{ color: '#fff', fontWeight: '700', fontSize: 15 },
  modalCancelBtn:  { alignItems: 'center' as const, paddingVertical: 12 },
  modalCancelText: { color: t.textMuted, fontSize: 14, fontWeight: '600' },
  modalBtnDisabled:{ opacity: 0.5 },
});
