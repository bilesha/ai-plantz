import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { getPlantTips } from "../../utilities/fetchPlantTips";
import { CardSkeleton } from "../../components/SkeletonLoader"; // Import the skeleton loader
import { getPlantDetailsFromCache, savePlantDetailsToCache } from "../logic/cacheLogic";

export default function PlantDetailsAiGenerated() {
  const { plantName } = useLocalSearchParams();
  const safePlantName = Array.isArray(plantName) ? plantName[0] : plantName;
  const router = useRouter();
  
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. One clean source of truth for fetching
  const fetchDetails = async (name: string) => {
    setLoading(true);
    setError(null);

    try {
      const cachedData = await getPlantDetailsFromCache(name);
      if (cachedData) {
        setDetails(cachedData);
        return; // Exit early if cache hit
      }

      const apiData = await getPlantTips(name);
      await savePlantDetailsToCache(name, apiData.details);
      setDetails(apiData.details);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Could not load plant details. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Single effect to trigger on load
  useEffect(() => {
    if (safePlantName) fetchDetails(safePlantName);
  }, [safePlantName]);

  return (
    <ScrollView style={d.container} contentContainerStyle={d.content}>
      <TouchableOpacity onPress={() => router.back()} style={d.backBtn}>
        <Text style={d.backText}>← Back to Search</Text>
      </TouchableOpacity>

      <Text style={d.headerTitle}>{safePlantName}</Text>
      <View style={d.divider} />

      {/* 3. Logic to show Error, Loading, or Content */}
      {error ? (
        <View style={d.errorContainer}>
          <Text style={d.errorIcon}>⚠️</Text>
          <Text style={d.errorText}>{error}</Text>
          <TouchableOpacity style={d.retryButton} onPress={() => fetchDetails(safePlantName as string)}>
            <Text style={d.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <CardSkeleton /> 
      ) : (
        <View>
          {details && Object.entries(details).map(([key, value]) => (
            <View key={key} style={d.card}>
              <Text style={d.cardLabel}>{key}</Text>
              <Text style={d.cardValue}>{value as string}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const d = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  content: { padding: 24, paddingTop: 60 },
  backBtn: { marginBottom: 24 },
  backText: { color: '#059669', fontWeight: '700', fontSize: 16 },
  headerTitle: { fontSize: 40, fontWeight: '900', color: '#0f172a' },
  divider: { height: 6, width: 60, backgroundColor: '#10b981', borderRadius: 3, marginVertical: 16 },
  loaderContainer: { marginTop: 100, alignItems: 'center' },
  loaderText: { marginTop: 16, color: '#94a3b8', fontWeight: '500' },
  card: { backgroundColor: '#f8fafc', padding: 20, borderRadius: 24, marginBottom: 16, borderLeftWidth: 5, borderLeftColor: '#10b981' },
  cardLabel: { fontSize: 12, fontWeight: '900', color: '#059669', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  cardValue: { fontSize: 17, color: '#334155', lineHeight: 26 },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorIcon: {
    fontSize: 50,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#64748b', // slate-500
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: '#059669', // your emerald-600 green
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
});