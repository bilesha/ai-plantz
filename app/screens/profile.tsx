import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme, type Theme } from '../../constants/theme';
import ScreenLayout from '../../components/ScreenLayout';
import { supabase } from '../../lib/supabase';

// Run once in Supabase SQL editor:
//
//   create table profiles (
//     id         uuid primary key references auth.users(id) on delete cascade,
//     username   text,
//     bio        text,
//     avatar_url text,
//     updated_at timestamptz default now()
//   );
//   alter table profiles enable row level security;
//   create policy "own profile only" on profiles for all using (auth.uid() = id);

const BIO_LIMIT = 160;

function getInitials(str: string): string {
  const parts = str.trim().split(/[\s._@]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return str.slice(0, 2).toUpperCase();
}

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

  const [userId, setUserId]       = useState<string | null>(null);
  const [email, setEmail]         = useState('');
  const [username, setUsername]   = useState('');
  const [bio, setBio]             = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarError, setAvatarError] = useState(false);

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/screens/auth'); return; }

      setUserId(user.id);
      setEmail(user.email ?? '');

      const { data } = await supabase
        .from('profiles')
        .select('username, bio, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        setUsername(data.username ?? '');
        setBio(data.bio ?? '');
        setAvatarUrl(data.avatar_url ?? '');
      } else {
        // First visit — seed username from auth metadata set during signup
        setUsername(user.user_metadata?.username ?? '');
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!userId) return;

    const trimmedUsername = username.trim();
    if (trimmedUsername && trimmedUsername.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (trimmedUsername && !/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      setError('Username: only letters, numbers, and underscores.');
      return;
    }

    setError(null);
    setSaving(true);
    setSaveStatus('idle');

    const { error: err } = await supabase.from('profiles').upsert({
      id:         userId,
      username:   trimmedUsername || null,
      bio:        bio.trim()       || null,
      avatar_url: avatarUrl.trim() || null,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    if (err) {
      setError(err.message);
      setSaveStatus('error');
    } else {
      setSaveStatus('saved');
      setAvatarError(false);
    }
  };

  const displayName   = username || email;
  const showImage     = avatarUrl.trim().startsWith('http') && !avatarError;

  if (loading) {
    return (
      <ScreenLayout>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={s.title}>Profile</Text>

        <View style={s.avatarSection}>
          {showImage ? (
            <Image
              source={{ uri: avatarUrl.trim() }}
              style={s.avatar}
              onError={() => setAvatarError(true)}
            />
          ) : (
            <View style={s.avatarPlaceholder}>
              <Text style={s.avatarInitials}>{getInitials(displayName)}</Text>
            </View>
          )}
          <Text style={s.emailLabel}>{email}</Text>
        </View>

        <Text style={s.sectionLabel}>PROFILE</Text>
        <View style={s.card}>
          <Text style={s.fieldLabel}>USERNAME</Text>
          <TextInput
            style={s.input}
            value={username}
            onChangeText={v => { setUsername(v); setError(null); setSaveStatus('idle'); }}
            placeholder="e.g. plant_lover42"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={32}
            returnKeyType="next"
          />

          <View style={s.divider} />

          <Text style={s.fieldLabel}>BIO</Text>
          <TextInput
            style={[s.input, s.bioInput]}
            value={bio}
            onChangeText={v => { setBio(v.slice(0, BIO_LIMIT)); setError(null); setSaveStatus('idle'); }}
            placeholder="Tell us about your plant journey..."
            placeholderTextColor={theme.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <Text style={s.charCount}>{bio.length}/{BIO_LIMIT}</Text>

          <View style={s.divider} />

          <Text style={s.fieldLabel}>AVATAR URL</Text>
          <TextInput
            style={s.input}
            value={avatarUrl}
            onChangeText={v => { setAvatarUrl(v); setAvatarError(false); setError(null); setSaveStatus('idle'); }}
            placeholder="https://example.com/photo.jpg"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
        </View>

        {error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {saveStatus === 'saved' && (
          <View style={s.successBox}>
            <Text style={s.successText}>Profile saved.</Text>
          </View>
        )}

        <TouchableOpacity
          style={[s.saveBtn, saving && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.saveBtnText}>Save Profile</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </ScreenLayout>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  flex:              { flex: 1, backgroundColor: t.background },
  container:         { flex: 1 },
  content:           { padding: 24, paddingTop: 60, paddingBottom: 80 },
  centered:          { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.background },

  backBtn:           { marginBottom: 16 },
  backText:          { color: t.accent, fontWeight: '700', fontSize: 16 },
  title:             { fontSize: 28, fontWeight: '900', color: t.textTitle, marginBottom: 28 },

  avatarSection:     { alignItems: 'center', marginBottom: 32 },
  avatar:            { width: 88, height: 88, borderRadius: 44, marginBottom: 12, backgroundColor: t.border },
  avatarPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: t.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarInitials:    { fontSize: 32, fontWeight: '900', color: '#fff' },
  emailLabel:        { fontSize: 14, color: t.textMuted },

  sectionLabel:      { fontSize: 12, fontWeight: '800', color: t.textMuted, letterSpacing: 1, marginBottom: 8 },
  card:              { backgroundColor: t.surface, borderRadius: 20, paddingHorizontal: 18, paddingBottom: 8, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  fieldLabel:        { fontSize: 11, fontWeight: '800', color: t.textMuted, letterSpacing: 1, marginTop: 16, marginBottom: 6 },
  input:             { fontSize: 16, color: t.textPrimary, paddingVertical: 8 },
  bioInput:          { minHeight: 72 },
  charCount:         { fontSize: 12, color: t.textMuted, textAlign: 'right', paddingBottom: 8 },
  divider:           { height: 1, backgroundColor: t.border },

  errorBox:          { backgroundColor: t.errorBg, borderWidth: 1, borderColor: t.errorBorder, borderRadius: 12, padding: 14, marginBottom: 16 },
  errorText:         { color: t.errorText, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  successBox:        { backgroundColor: t.surfaceGreen, borderWidth: 1, borderColor: t.borderGreen, borderRadius: 12, padding: 14, marginBottom: 16 },
  successText:       { color: t.accentDark, fontSize: 14, fontWeight: '600' },

  saveBtn:           { backgroundColor: t.accent, borderRadius: 100, paddingVertical: 16, alignItems: 'center' },
  saveBtnDisabled:   { backgroundColor: t.accentDisabled },
  saveBtnText:       { color: '#fff', fontSize: 17, fontWeight: '800' },
});
