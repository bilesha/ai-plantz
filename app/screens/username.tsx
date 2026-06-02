import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme, type Theme } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

export default function UsernameScreen() {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setError('Please enter a username.');
      return;
    }
    if (trimmed.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setError('Only letters, numbers, and underscores are allowed.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ data: { username: trimmed } });
      if (err) { setError(err.message); return; }
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => router.replace('/');

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={s.container}>
        <Text style={s.title}>Choose a username</Text>
        <Text style={s.subtitle}>
          This is how you'll appear in the app. You can change it later in settings.
        </Text>

        <View style={s.card}>
          <Text style={s.fieldLabel}>USERNAME</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. plant_lover42"
            placeholderTextColor={theme.textMuted}
            value={username}
            onChangeText={t => { setUsername(t); setError(null); }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username-new"
            returnKeyType="done"
            onSubmitEditing={handleSave}
            maxLength={32}
          />
        </View>

        <Text style={s.hint}>Letters, numbers, and underscores only — 3 to 32 characters.</Text>

        {error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[s.primaryBtn, loading && s.primaryBtnDisabled]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.primaryBtnText}>Save username</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSkip} style={s.skipBtn} disabled={loading}>
          <Text style={s.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  flex:               { flex: 1, backgroundColor: t.background },
  container:          { flex: 1, padding: 24, paddingTop: 80, paddingBottom: 48 },

  title:              { fontSize: 28, fontWeight: '900', color: t.textTitle, marginBottom: 10 },
  subtitle:           { fontSize: 15, color: t.textSecondary, lineHeight: 22, marginBottom: 32 },

  card:               { backgroundColor: t.surface, borderRadius: 20, paddingHorizontal: 18, paddingBottom: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  fieldLabel:         { fontSize: 11, fontWeight: '800', color: t.textMuted, letterSpacing: 1, marginTop: 16, marginBottom: 6 },
  input:              { fontSize: 16, color: t.textPrimary, paddingVertical: 10 },

  hint:               { fontSize: 13, color: t.textMuted, marginBottom: 20, paddingHorizontal: 4 },

  errorBox:           { backgroundColor: t.errorBg, borderWidth: 1, borderColor: t.errorBorder, borderRadius: 12, padding: 14, marginBottom: 16 },
  errorText:          { color: t.errorText, fontSize: 14, fontWeight: '600', lineHeight: 20 },

  primaryBtn:         { backgroundColor: t.accent, borderRadius: 100, paddingVertical: 16, alignItems: 'center', marginBottom: 14 },
  primaryBtnDisabled: { backgroundColor: t.accentDisabled },
  primaryBtnText:     { color: '#fff', fontSize: 17, fontWeight: '800' },

  skipBtn:            { alignItems: 'center', paddingVertical: 10 },
  skipText:           { fontSize: 15, color: t.textSecondary, fontWeight: '600' },
});
