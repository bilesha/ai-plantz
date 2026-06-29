import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme, type Theme } from '../../constants/theme';
import { comparePlants, type CompareResult } from '../../logic/compareLogic';

export default function CompareScreen() {
  const router = useRouter();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

  const [plantA, setPlantA] = useState('');
  const [plantB, setPlantB] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputBRef = useRef<TextInput>(null);

  const canCompare = plantA.trim().length > 0 && plantB.trim().length > 0;

  const handleCompare = async () => {
    if (!canCompare || loading) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const data = await comparePlants(plantA.trim(), plantB.trim());
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setPlantA('');
    setPlantB('');
  };

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity testID="compare-back-button" onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>Compare Plants</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Inputs */}
        <View style={s.inputsCard}>
          <Text style={s.inputLabel}>PLANT A</Text>
          <TextInput
            testID="compare-plant-a-input"
            style={s.input}
            value={plantA}
            onChangeText={setPlantA}
            placeholder="e.g. Monstera"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => inputBRef.current?.focus()}
            editable={!loading && !result}
          />

          <View style={s.vsRow}>
            <View style={s.vsDivider} />
            <Text style={s.vsText}>VS</Text>
            <View style={s.vsDivider} />
          </View>

          <Text style={s.inputLabel}>PLANT B</Text>
          <TextInput
            testID="compare-plant-b-input"
            ref={inputBRef}
            style={s.input}
            value={plantB}
            onChangeText={setPlantB}
            placeholder="e.g. Pothos"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleCompare}
            editable={!loading && !result}
          />
        </View>

        {!result && (
          <TouchableOpacity
            testID="compare-submit-button"
            style={[s.compareBtn, (!canCompare || loading) && s.compareBtnDisabled]}
            onPress={handleCompare}
            disabled={!canCompare || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.compareBtnText}>Compare</Text>
            )}
          </TouchableOpacity>
        )}

        {!!error && (
          <View testID="compare-error-box" style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
            <TouchableOpacity testID="compare-try-again-button" onPress={handleReset} style={s.tryAgainBtn}>
              <Text style={s.tryAgainText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Summary */}
            <View testID="compare-summary-card" style={s.summaryCard}>
              <Text style={s.summaryText}>{result.summary}</Text>
            </View>

            {/* Column headers */}
            <View style={s.colHeaders}>
              <View style={s.colHeaderSpacer} />
              <View style={s.colHeader}>
                <Text style={s.colHeaderText} numberOfLines={2}>{plantA}</Text>
              </View>
              <View style={s.colHeader}>
                <Text style={[s.colHeaderText, s.colHeaderB]} numberOfLines={2}>{plantB}</Text>
              </View>
            </View>

            {/* Category rows */}
            {result.categories.map((cat, i) => (
              <View key={cat.label} testID={`compare-category-row-${cat.label}`} style={[s.catRow, i % 2 === 1 && s.catRowAlt]}>
                <Text style={s.catLabel}>{cat.label}</Text>
                <Text style={s.catValueA}>{cat.plantA}</Text>
                <Text style={s.catValueB}>{cat.plantB}</Text>
              </View>
            ))}

            {/* Verdict */}
            <View testID="compare-verdict-card" style={s.verdictCard}>
              <Text style={s.verdictHeading}>VERDICT</Text>
              <Text style={s.verdictText}>{result.verdict}</Text>
            </View>

            <TouchableOpacity testID="compare-reset-button" style={s.resetBtn} onPress={handleReset}>
              <Text style={s.resetBtnText}>Compare again</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: t.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: t.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.border,
    gap: 8,
  },
  backBtn:   { paddingRight: 4 },
  backArrow: { fontSize: 30, color: t.accent, lineHeight: 32 },
  title:     { fontSize: 20, fontWeight: '800', color: t.textTitle },

  scroll:   { flex: 1 },
  content:  { padding: 20, paddingBottom: 60, gap: 12 },

  inputsCard: {
    backgroundColor: t.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: t.border,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: t.textMuted,
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: t.background,
    borderWidth: 1.5,
    borderColor: t.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: t.textPrimary,
    fontWeight: '600',
  },
  vsRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 },
  vsDivider:{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: t.border },
  vsText:   { fontSize: 12, fontWeight: '900', color: t.textMuted, letterSpacing: 2 },

  compareBtn: {
    backgroundColor: t.accent,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  compareBtnDisabled: { opacity: 0.45 },
  compareBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    alignItems: 'center',
    gap: 10,
  },
  errorText:    { color: '#ef4444', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  tryAgainBtn:  { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.12)' },
  tryAgainText: { color: '#ef4444', fontWeight: '700', fontSize: 14 },

  summaryCard: {
    backgroundColor: t.surfaceGreen,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: t.borderGreen,
  },
  summaryText: { fontSize: 15, color: t.textBody, lineHeight: 22 },

  colHeaders: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  colHeaderSpacer: { flex: 1 },
  colHeader:       { flex: 1, alignItems: 'center' },
  colHeaderText:   { fontSize: 12, fontWeight: '800', color: t.accent, textAlign: 'center' },
  colHeaderB:      { color: t.accentDark },

  catRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: t.surface,
    borderRadius: 12,
    padding: 12,
  },
  catRowAlt:  { backgroundColor: t.background },
  catLabel:   { flex: 1, fontSize: 12, fontWeight: '800', color: t.textMuted, letterSpacing: 0.5 },
  catValueA:  { flex: 1, fontSize: 13, color: t.textBody, lineHeight: 18, textAlign: 'center' },
  catValueB:  { flex: 1, fontSize: 13, color: t.textBody, lineHeight: 18, textAlign: 'center' },

  verdictCard: {
    backgroundColor: t.accent,
    borderRadius: 16,
    padding: 18,
    gap: 6,
  },
  verdictHeading: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
  verdictText:    { fontSize: 15, color: '#fff', lineHeight: 22 },

  resetBtn:     { alignItems: 'center', paddingVertical: 14 },
  resetBtnText: { color: t.accent, fontWeight: '700', fontSize: 15 },
});
