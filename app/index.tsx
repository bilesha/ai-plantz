import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import PlantCareTips from "../components/PlantCareTips";
import { PLANT_SUGGESTIONS, RANDOM_PLANTS } from "../constants/plants";
import { useTheme } from "../constants/theme";
import { getPlantTips } from "../utilities/fetchPlantTips";
import { PlantEntry } from "./types";

export default function Index() {
  const router = useRouter();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

  const [plant, setPlant] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PlantEntry[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = useMemo(() => {
    const q = plant.trim().toLowerCase();
    if (!q) return [];
    const historySuggestions = history
      .map(p => p.name)
      .filter(name => name.toLowerCase().includes(q));
    const staticSuggestions = PLANT_SUGGESTIONS
      .filter(name => name.toLowerCase().includes(q))
      .filter(name => !historySuggestions.some(h => h.toLowerCase() === name.toLowerCase()));
    return [...historySuggestions, ...staticSuggestions].slice(0, 6);
  }, [plant, history]);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem("plantHistory");
      if (saved) setHistory(JSON.parse(saved));
    })();
  }, []);

  const handleSelectSuggestion = (name: string) => {
    setPlant(name);
    setShowSuggestions(false);
    handleGetTips(name);
  };

  const handleGetTips = async (nameToSearch?: string) => {
    const target = nameToSearch || plant;
    if (!target.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const cached = history.find(p => p.name.toLowerCase() === target.toLowerCase());
      if (cached) {
        setSummary(cached.summary);
        setLoading(false);
        return;
      }

      const tips = await getPlantTips(target);
      setSummary(tips.summary);

      const newEntry: PlantEntry = {
        name: target,
        summary: tips.summary,
        details: tips.details,
        isFavorite: false,
        lastViewed: Date.now(),
      };

      const updatedHistory = [
        newEntry,
        ...history.filter(p => p.name.toLowerCase() !== target.toLowerCase()),
      ].slice(0, 10);

      setHistory(updatedHistory);
      await AsyncStorage.setItem("plantHistory", JSON.stringify(updatedHistory));

    } catch (err: any) {
      setSummary("");
      const msg = err?.message ?? '';
      if (msg.includes('429')) {
        setError('Too many requests — wait a moment and try again.');
      } else if (msg.includes('Server error')) {
        setError('The server hit an error. Try again shortly.');
      } else {
        setError('Could not reach the server. Check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear history',
      'This will remove all your recent searches.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setHistory([]);
            await AsyncStorage.removeItem("plantHistory");
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.title}>🌿 LeafyAI</Text>
            <Text style={s.subtitle}>Your AI Botanical Assistant</Text>
          </View>
          <TouchableOpacity style={s.btnHistoryIcon} onPress={() => router.push("/history")}>
            <Text style={{ fontSize: 24 }}>📜</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.inputWrapper}>
        <View style={s.inputCard}>
          <TextInput
            placeholder="Search a plant..."
            style={s.input}
            value={plant}
            onChangeText={(text) => { setPlant(text); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholderTextColor={theme.textMuted}
            returnKeyType="search"
            onSubmitEditing={() => { setShowSuggestions(false); handleGetTips(); }}
          />
        </View>
        {showSuggestions && suggestions.length > 0 && (
          <View style={s.dropdown}>
            {suggestions.map((name, i) => (
              <TouchableOpacity
                key={name}
                style={[s.suggestionRow, i < suggestions.length - 1 && s.suggestionBorder]}
                onPress={() => handleSelectSuggestion(name)}
              >
                <Text style={s.suggestionText}>{name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={s.buttonRow}>
        <TouchableOpacity
          style={[s.btnMain, (!plant || loading) && s.btnDisabled]}
          onPress={() => handleGetTips()}
          disabled={!plant || loading}
        >
          {loading
            ? <ActivityIndicator color="white" />
            : <Text style={s.btnMainText}>Get Tips</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.btnRandom, loading && s.btnRandomDisabled]}
          disabled={loading}
          onPress={() => {
            const r = RANDOM_PLANTS[Math.floor(Math.random() * RANDOM_PLANTS.length)];
            setPlant(r);
            handleGetTips(r);
          }}
        >
          {loading
            ? <ActivityIndicator color={theme.accentDark} size="small" />
            : <Text style={s.btnRandomText}>Random</Text>
          }
        </TouchableOpacity>
      </View>

      {history.length > 0 && (
        <View style={s.recentSection}>
          <View style={s.recentHeader}>
            <Text style={s.recentTitle}>RECENT SEARCHES</Text>
            <TouchableOpacity onPress={handleClearHistory}>
              <Text style={s.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {history.map((item) => (
              <TouchableOpacity
                key={item.name}
                style={s.pill}
                onPress={() => { setPlant(item.name); setSummary(item.summary); }}
              >
                <Text style={s.pillText}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <PlantCareTips summary={summary} loading={loading} error={error} />

      {summary && !loading && (
        <TouchableOpacity
          style={s.btnOutline}
          onPress={() => router.push({
            pathname: "/screens/PlantDetailsAiGenerated",
            params: { plantName: plant },
          })}
        >
          <Text style={s.btnOutlineText}>View Detailed Guide →</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  container:        { flex: 1, backgroundColor: t.background },
  content:          { padding: 24, paddingTop: 60, flexGrow: 1 },
  header:           { marginBottom: 32 },
  headerRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title:            { fontSize: 32, fontWeight: '900', color: t.textTitle },
  subtitle:         { fontSize: 16, color: t.textSecondary },
  inputWrapper:     { marginBottom: 16, zIndex: 100 },
  inputCard:        { backgroundColor: t.surface, padding: 14, borderRadius: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  input:            { fontSize: 18, color: t.textPrimary },
  dropdown:         { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: t.surface, borderRadius: 16, marginTop: 4, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, overflow: 'hidden', zIndex: 101 },
  suggestionRow:    { paddingHorizontal: 18, paddingVertical: 14 },
  suggestionBorder: { borderBottomWidth: 1, borderBottomColor: t.border },
  suggestionText:   { fontSize: 16, color: t.textPrimary },
  buttonRow:        { flexDirection: 'row', gap: 12, marginBottom: 32 },
  btnMain:          { flex: 1, backgroundColor: t.accent, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  btnDisabled:      { backgroundColor: t.accentDisabled },
  btnMainText:      { color: 'white', fontWeight: '700', fontSize: 18 },
  btnRandom:        { paddingHorizontal: 20, backgroundColor: t.surfaceGreen, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  btnRandomDisabled:{ opacity: 0.5 },
  btnRandomText:    { color: t.accentDark, fontWeight: '700' },
  recentSection:    { marginBottom: 24 },
  recentHeader:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  recentTitle:      { fontSize: 12, fontWeight: '800', color: t.textMuted, letterSpacing: 1 },
  clearText:        { fontSize: 12, color: t.danger },
  pill:             { backgroundColor: t.surface, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, marginRight: 8, borderWidth: 1, borderColor: t.border },
  pillText:         { color: t.textSecondary, fontWeight: '600' },
  btnOutline:       { marginTop: 16, backgroundColor: t.surfaceGreenSubtle, borderWidth: 1, borderColor: t.accent, padding: 18, borderRadius: 20, alignItems: 'center' },
  btnOutlineText:   { color: t.accentDark, fontWeight: '800', fontSize: 16 },
  btnHistoryIcon:   { backgroundColor: t.surface, padding: 12, borderRadius: 18, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
});
