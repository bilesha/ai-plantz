import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { getPlantTips } from "../../utilities/fetchPlantTips";

export default function PlantDetailsAiGenerated() {
  const { plantName } = useLocalSearchParams();
  const router = useRouter();
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await getPlantTips(plantName as string);
        setDetails(data.details);
      } finally {
        setLoading(false);
      }
    })();
  }, [plantName]);

  return (
    <ScrollView style={d.container} contentContainerStyle={d.content}>
      <TouchableOpacity onPress={() => router.back()} style={d.backBtn}>
        <Text style={d.backText}>← Back to Search</Text>
      </TouchableOpacity>

      <Text style={d.headerTitle}>{plantName}</Text>
      <View style={d.divider} />

      {loading ? (
        <View style={d.loaderContainer}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={d.loaderText}>Asking Gemini for botanical expertise...</Text>
        </View>
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
});