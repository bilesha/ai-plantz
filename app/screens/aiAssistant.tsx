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
import Animated, { FadeInDown } from "react-native-reanimated";
import PlantCareTips from "../../components/PlantCareTips";
import ScreenLayout from "../../components/ScreenLayout";
import { PLANT_SUGGESTIONS, RANDOM_PLANTS } from "../../constants/plants";
import { useTheme } from "../../constants/theme";
import { getPlantTips } from "../../utilities/fetchPlantTips";
import { getHistory, savePlant, deleteHistoryItem, clearHistory } from "../../utilities/storage";
import { removeHistoryItem } from "../../logic/historyLogic";
import { PlantEntry } from "../../types";

const TOUR_STEPS = [
  {
    icon: '🌿',
    title: 'Welcome to Rootnote',
    body: 'Search for any plant and get instant AI-powered care tips. Tap the Plant of the Day to get started.',
  },
  {
    icon: '🪴',
    title: 'Build your collection',
    body: 'Save plants to your collection with status (own/want/tried), ratings, and personal notes.',
  },
  {
    icon: '👥',
    title: 'Discover the community',
    body: "Find other plant lovers, follow them, and see what they're growing in the Discover tab.",
  },
  {
    icon: '⚙️',
    title: 'Make it yours',
    body: 'Choose your AI provider, switch between light and dark mode, and set watering reminders in Settings.',
  },
];

export default function Index() {
  const router = useRouter();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

  const dailyPlant = useMemo(() => {
    const seed = new Date().toDateString();
    const hash = seed.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return RANDOM_PLANTS[hash % RANDOM_PLANTS.length];
  }, []);

  const [plant, setPlant] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PlantEntry[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [tourStep, setTourStep] = useState<number | null>(null);

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
      const [entries, seen] = await Promise.all([
        getHistory(),
        AsyncStorage.getItem("seen_welcome_v2"),
      ]);
      setHistory(entries);
      setTourStep(seen ? null : 0);
    })();
  }, []);

  const advanceTour = async () => {
    if (tourStep === null) return;
    if (tourStep < TOUR_STEPS.length - 1) {
      setTourStep(tourStep + 1);
    } else {
      setTourStep(null);
      await AsyncStorage.setItem("seen_welcome_v2", "1");
    }
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

      setHistory(prev => [newEntry, ...prev.filter(p => p.name.toLowerCase() !== target.toLowerCase())].slice(0, 10));
      savePlant(newEntry);

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

  const handleSelectSuggestion = (name: string) => {
    setPlant(name);
    setShowSuggestions(false);
    handleGetTips(name);
  };

  const handleRemoveItem = (name: string) => {
    setHistory(prev => removeHistoryItem(prev, name));
    deleteHistoryItem(name);
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
          onPress: () => {
            setHistory([]);
            clearHistory();
          },
        },
      ]
    );
  };

  return (
    <ScreenLayout>
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.header}>
        <Text style={s.title}>🌿 Rootnote</Text>
        <Text style={s.subtitle}>Your AI Botanical Assistant</Text>
      </View>

      {tourStep !== null && (
        <Animated.View key={tourStep} entering={FadeInDown.duration(300)} style={s.welcomeCard}>
          <Text style={s.tourIcon}>{TOUR_STEPS[tourStep].icon}</Text>
          <Text style={s.welcomeTitle}>{TOUR_STEPS[tourStep].title}</Text>
          <Text style={s.welcomeBody}>{TOUR_STEPS[tourStep].body}</Text>
          <View style={s.tourFooter}>
            <View style={s.tourDots}>
              {TOUR_STEPS.map((_, i) => (
                <View key={i} style={[s.tourDot, i === tourStep && s.tourDotActive]} />
              ))}
            </View>
            <TouchableOpacity style={s.welcomeBtn} onPress={advanceTour}>
              <Text style={s.welcomeBtnText}>
                {tourStep < TOUR_STEPS.length - 1 ? 'Next →' : 'Get started →'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      <View style={s.inputWrapper}>
        <View style={s.inputCard}>
          <TextInput
            testID="plant-search-input"
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
          <Animated.View entering={FadeInDown.duration(180)} style={s.dropdown}>
            {suggestions.map((name, i) => (
              <TouchableOpacity
                key={name}
                style={[s.suggestionRow, i < suggestions.length - 1 && s.suggestionBorder]}
                onPress={() => handleSelectSuggestion(name)}
              >
                <Text style={s.suggestionText}>{name}</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}
      </View>

      <TouchableOpacity
        testID="potd-card"
        style={s.potdCard}
        onPress={() => router.push({
          pathname: '/screens/PlantDetailsAiGenerated',
          params: { plantName: dailyPlant },
        })}
        activeOpacity={0.85}
      >
        <Text style={s.potdLabel}>PLANT OF THE DAY 🌿</Text>
        <Text style={s.potdName}>{dailyPlant}</Text>
        <Text style={s.potdCta}>Discover care tips →</Text>
      </TouchableOpacity>

      <View style={s.buttonRow}>
        <TouchableOpacity
          testID="get-tips-button"
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
          testID="random-plant-button"
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
              <View key={item.name} style={s.chip}>
                <TouchableOpacity onPress={() => { setPlant(item.name); handleGetTips(item.name); }}>
                  <Text style={s.pillText}>{item.name}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleRemoveItem(item.name)} hitSlop={8}>
                  <Text style={s.chipX}>×</Text>
                </TouchableOpacity>
              </View>
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
            params: { plantName: plant, summary },
          })}
        >
          <Text style={s.btnOutlineText}>View Detailed Guide →</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
    </ScreenLayout>
  );
}

const styles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  container:        { flex: 1, backgroundColor: t.background },
  content:          { padding: 24, paddingTop: 60, paddingBottom: 80, flexGrow: 1 },
  header:           { marginBottom: 32 },
  title:            { fontSize: 32, fontWeight: '900', color: t.textTitle },
  subtitle:         { fontSize: 16, color: t.textSecondary },
  welcomeCard:      { backgroundColor: t.surfaceGreen, borderWidth: 1, borderColor: t.borderGreen, borderRadius: 20, padding: 20, marginBottom: 20 },
  tourIcon:         { fontSize: 28, marginBottom: 10 },
  welcomeTitle:     { fontSize: 18, fontWeight: '800', color: t.textTitle, marginBottom: 8 },
  welcomeBody:      { fontSize: 14, color: t.textSecondary, lineHeight: 22, marginBottom: 16 },
  tourFooter:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tourDots:         { flexDirection: 'row', gap: 6 },
  tourDot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: t.borderGreen },
  tourDotActive:    { backgroundColor: t.accent, width: 18 },
  welcomeBtn:       { backgroundColor: t.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100 },
  welcomeBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  potdCard:     { backgroundColor: t.surface, borderRadius: 20, padding: 20, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: t.accent, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  potdLabel:    { fontSize: 11, fontWeight: '800', color: t.textMuted, letterSpacing: 1, marginBottom: 6 },
  potdName:     { fontSize: 22, fontWeight: '900', color: t.textTitle, marginBottom: 8 },
  potdCta:      { fontSize: 14, fontWeight: '700', color: t.accent },
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
  chip:             { flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, marginRight: 8, borderWidth: 1, borderColor: t.border, gap: 6 },
  pillText:         { color: t.textSecondary, fontWeight: '600' },
  chipX:            { color: t.textMuted, fontSize: 16, lineHeight: 18, fontWeight: '400' },
  btnOutline:       { marginTop: 16, backgroundColor: t.surfaceGreenSubtle, borderWidth: 1, borderColor: t.accent, padding: 18, borderRadius: 20, alignItems: 'center' },
  btnOutlineText:   { color: t.accentDark, fontWeight: '800', fontSize: 16 },
});
