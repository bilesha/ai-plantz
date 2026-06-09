import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { supabase } from '../../lib/supabase';

type Mode = 'login' | 'signup';

export default function AuthScreen() {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLogin = mode === 'login';

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (!isLogin) {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (!/[A-Z]/.test(password)) {
        setError('Password must contain at least one capital letter.');
        return;
      }
      if (!/[0-9]/.test(password)) {
        setError('Password must contain at least one number.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) { setError(err.message); return; }
        router.replace('/');
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password });
        if (err) { setError(err.message); return; }
        if (data.session) {
          router.replace('/screens/username');
        } else {
          setError('Check your email to confirm your account before signing in.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(m => (m === 'login' ? 'signup' : 'login'));
    setConfirmPassword('');
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.appName}>LeafyAI</Text>
        <Text style={s.tagline}>Your AI Botanical Assistant</Text>

        <View style={s.toggle}>
          <TouchableOpacity
            style={[s.toggleBtn, isLogin && s.toggleBtnActive]}
            onPress={() => { setMode('login'); setError(null); }}
          >
            <Text style={[s.toggleText, isLogin && s.toggleTextActive]}>Log in</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="auth-signup-tab"
            style={[s.toggleBtn, !isLogin && s.toggleBtnActive]}
            onPress={() => { setMode('signup'); setError(null); }}
          >
            <Text style={[s.toggleText, !isLogin && s.toggleTextActive]}>Sign up</Text>
          </TouchableOpacity>
        </View>

        <View style={s.card}>
          <Text style={s.fieldLabel}>EMAIL</Text>
          <TextInput
            testID="auth-email-input"
            style={s.input}
            placeholder="you@example.com"
            placeholderTextColor={theme.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            returnKeyType="next"
          />

          <View style={s.divider} />

          <Text style={s.fieldLabel}>PASSWORD</Text>
          <TextInput
            testID="auth-password-input"
            style={s.input}
            placeholder={isLogin ? 'Enter your password' : 'Min 6 chars, 1 capital, 1 number'}
            placeholderTextColor={theme.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            returnKeyType={isLogin ? 'done' : 'next'}
            onSubmitEditing={isLogin ? handleSubmit : undefined}
          />

          {!isLogin && (
            <>
              <View style={s.divider} />
              <Text style={s.fieldLabel}>CONFIRM PASSWORD</Text>
              <TextInput
                testID="auth-confirm-password-input"
                style={s.input}
                placeholder="Re-enter your password"
                placeholderTextColor={theme.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </>
          )}
        </View>

        {error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          testID={isLogin ? 'auth-login-button' : 'auth-signup-button'}
          style={[s.primaryBtn, loading && s.primaryBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.primaryBtnText}>{isLogin ? 'Log in' : 'Create account'}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={toggleMode} style={s.switchRow}>
          <Text style={s.switchText}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <Text style={s.switchLink}>{isLogin ? 'Sign up' : 'Log in'}</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  flex:               { flex: 1, backgroundColor: t.background },
  container:          { flex: 1 },
  content:            { padding: 24, paddingTop: 80, paddingBottom: 48, alignItems: 'stretch' },

  appName:            { fontSize: 36, fontWeight: '900', color: t.textTitle, textAlign: 'center' },
  tagline:            { fontSize: 15, color: t.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: 36 },

  toggle:             { flexDirection: 'row', backgroundColor: t.surface, borderRadius: 16, padding: 4, marginBottom: 24, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  toggleBtn:          { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  toggleBtnActive:    { backgroundColor: t.accent },
  toggleText:         { fontSize: 15, fontWeight: '700', color: t.textSecondary },
  toggleTextActive:   { color: '#fff' },

  card:               { backgroundColor: t.surface, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 4, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  fieldLabel:         { fontSize: 11, fontWeight: '800', color: t.textMuted, letterSpacing: 1, marginTop: 16, marginBottom: 6 },
  input:              { fontSize: 16, color: t.textPrimary, paddingVertical: 10, paddingHorizontal: 0 },
  divider:            { height: 1, backgroundColor: t.border, marginTop: 4 },

  errorBox:           { backgroundColor: t.errorBg, borderWidth: 1, borderColor: t.errorBorder, borderRadius: 12, padding: 14, marginBottom: 16 },
  errorText:          { color: t.errorText, fontSize: 14, fontWeight: '600', lineHeight: 20 },

  primaryBtn:         { backgroundColor: t.accent, borderRadius: 100, paddingVertical: 16, alignItems: 'center', marginBottom: 20 },
  primaryBtnDisabled: { backgroundColor: t.accentDisabled },
  primaryBtnText:     { color: '#fff', fontSize: 17, fontWeight: '800' },

  switchRow:          { alignItems: 'center' },
  switchText:         { fontSize: 14, color: t.textSecondary },
  switchLink:         { color: t.accent, fontWeight: '700' },
});
