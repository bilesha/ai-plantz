import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../constants/theme";
import { getPlantTips } from "../../utilities/fetchPlantTips";
import { CardSkeleton } from "../../components/SkeletonLoader";
import { getPlantDetailsFromCache, savePlantDetailsToCache } from "../logic/cacheLogic";
import { PlantDetails } from "../types";

const CARD_ORDER: (keyof PlantDetails)[] = ['watering', 'light', 'fertilizer'];

export default function PlantDetailsAiGenerated() {
  const { plantName } = useLocalSearchParams();
  const safePlantName = Array.isArray(plantName) ? plantName[0] : plantName;
  const router = useRouter();
  const theme = useTheme();
  const d = useMemo(() => styles(theme), [theme]);

  const [details, setDetails] = useState<PlantDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = async (name: string) => {
    setLoading(true);
    setError(null);

    try {
      const cachedData = await getPlantDetailsFromCache(name);
      if (cachedData) {
        setDetails(cachedData);
        return;
      }

      const apiData = await getPlantTips(name);
      await savePlantDetailsToCache(name, apiData.details);
      setDetails(apiData.details);
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('429')) {
        setError('Too many requests — wait a moment and try again.');
      } else if (msg.includes('502')) {
        setError('The AI service returned an unexpected response. Please try again.');
      } else if (msg.includes('Server error')) {
        setError('The server hit an error. Try again shortly.');
      } else {
        setError('Could not load plant details. Check your internet connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (safePlantName) fetchDetails(safePlantName);
  }, [safePlantName]);

  if (!safePlantName) {
    return (
      <View style={d.container}>
        <TouchableOpacity onPress={() => router.back()} style={d.backBtn}>
          <Text style={d.backText}>← Back to Search</Text>
        </TouchableOpacity>
        <View style={d.errorContainer}>
          <Text style={d.errorIcon}>🌿</Text>
          <Text style={d.errorText}>No plant selected.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={d.container} contentContainerStyle={d.content}>
      <TouchableOpacity onPress={() => router.back()} style={d.backBtn}>
        <Text style={d.backText}>← Back to Search</Text>
      </TouchableOpacity>

      <Text style={d.headerTitle}>{safePlantName}</Text>
      <View style={d.divider} />

      {error ? (
        <View style={d.errorContainer}>
          <Text style={d.errorIcon}>⚠️</Text>
          <Text style={d.errorText}>{error}</Text>
          <TouchableOpacity style={d.retryButton} onPress={() => fetchDetails(safePlantName)}>
            <Text style={d.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <CardSkeleton />
      ) : (
        <View>
          {CARD_ORDER.map(key => {
            const value = details?.[key];
            if (!value) return null;
            return (
              <View key={key} style={d.card}>
                <Text style={d.cardLabel}>{key}</Text>
                <Text style={d.cardValue}>{value}</Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  container:       { flex: 1, backgroundColor: t.surface },
  content:         { padding: 24, paddingTop: 60 },
  backBtn:         { marginBottom: 24 },
  backText:        { color: t.accent, fontWeight: '700', fontSize: 16 },
  headerTitle:     { fontSize: 40, fontWeight: '900', color: t.textHeading },
  divider:         { height: 6, width: 60, backgroundColor: t.accentMid, borderRadius: 3, marginVertical: 16 },
  card:            { backgroundColor: t.background, padding: 20, borderRadius: 24, marginBottom: 16, borderLeftWidth: 5, borderLeftColor: t.accentMid },
  cardLabel:       { fontSize: 12, fontWeight: '900', color: t.accent, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  cardValue:       { fontSize: 17, color: t.textBody, lineHeight: 26 },
  errorContainer:  { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorIcon:       { fontSize: 50, marginBottom: 20 },
  errorText:       { fontSize: 16, color: t.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  retryButton:     { backgroundColor: t.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  retryButtonText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
