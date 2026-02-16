import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { 
  ScrollView, Text, TextInput, TouchableOpacity, View, 
  ActivityIndicator, StyleSheet 
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import PlantCareTips from "../components/PlantCareTips";
import { RANDOM_PLANTS } from "../constants/plants";
import { getPlantTips } from "../utilities/fetchPlantTips";

export default function Index() {
  const router = useRouter();
  const [plant, setPlant] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load History
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem("recentSearches");
      if (saved) setRecentSearches(JSON.parse(saved));
    })();
  }, []);

  const handleGetTips = async (nameToSearch?: string) => {
    const target = nameToSearch || plant;
    if (!target.trim()) return;

    setLoading(true);
    setError(null);
    setSummary("");

    try {
      const tips = await getPlantTips(target);
      setSummary(tips.summary);
      
      // Update history
      const newList = [target, ...recentSearches.filter(p => p !== target)].slice(0, 5);
      setRecentSearches(newList);
      await AsyncStorage.setItem("recentSearches", JSON.stringify(newList));
    } catch (err) {
      setError("Server connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Text style={s.title}>🌿 LeafyAI</Text>
        <Text style={s.subtitle}>Your AI Botanical Assistant</Text>
      </View>

      <View style={s.inputCard}>
        <TextInput
          placeholder="Search a plant..."
          style={s.input}
          value={plant}
          onChangeText={setPlant}
          placeholderTextColor="#94a3b8"
        />
      </View>

      <View style={s.buttonRow}>
        <TouchableOpacity 
          style={[s.btnMain, (!plant || loading) && s.btnDisabled]} 
          onPress={() => handleGetTips()}
          disabled={!plant || loading}
        >
          {loading ? <ActivityIndicator color="white" /> : <Text style={s.btnMainText}>Get Tips</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.btnRandom} onPress={() => {
          const r = RANDOM_PLANTS[Math.floor(Math.random() * RANDOM_PLANTS.length)];
          setPlant(r);
          handleGetTips(r);
        }}>
          <Text style={s.btnRandomText}>Random</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Searches Section */}
      {recentSearches.length > 0 && (
        <View style={s.recentSection}>
          <View style={s.recentHeader}>
            <Text style={s.recentTitle}>RECENT SEARCHES</Text>
            <TouchableOpacity onPress={async () => { setRecentSearches([]); await AsyncStorage.removeItem("recentSearches"); }}>
              <Text style={s.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recentSearches.map((item, i) => (
              <TouchableOpacity key={i} style={s.pill} onPress={() => { setPlant(item); handleGetTips(item); }}>
                <Text style={s.pillText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <PlantCareTips summary={summary} loading={loading} error={error} />

      {summary && !loading && (
        <TouchableOpacity 
          style={s.btnOutline} 
          onPress={() => router.push({ pathname: "/screens/PlantDetailsAiGenerated", params: { plantName: plant } })}
        >
          <Text style={s.btnOutlineText}>View Detailed Guide →</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 24, paddingTop: 60, flexGrow: 1 },
  header: { marginBottom: 32 },
  title: { fontSize: 32, fontWeight: '900', color: '#064e3b' },
  subtitle: { fontSize: 16, color: '#64748b' },
  inputCard: { backgroundColor: 'white', padding: 14, borderRadius: 20, marginBottom: 16, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  input: { fontSize: 18, color: '#1e293b' },
  buttonRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  btnMain: { flex: 1, backgroundColor: '#059669', height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { backgroundColor: '#a7f3d0' },
  btnMainText: { color: 'white', fontWeight: '700', fontSize: 18 },
  btnRandom: { paddingHorizontal: 20, backgroundColor: '#ecfdf5', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  btnRandomText: { color: '#065f46', fontWeight: '700' },
  recentSection: { marginBottom: 24 },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  recentTitle: { fontSize: 12, fontWeight: '800', color: '#94a3b8', letterSpacing: 1 },
  clearText: { fontSize: 12, color: '#f87171' },
  pill: { backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  pillText: { color: '#475569', fontWeight: '600' },
  btnOutline: { marginTop: 16, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#059669', padding: 18, borderRadius: 20, alignItems: 'center' },
  btnOutlineText: { color: '#065f46', fontWeight: '800', fontSize: 16 },
});