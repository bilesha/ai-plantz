import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { PlantEntry } from "../types";

export default function HistoryScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<PlantEntry[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  useEffect(() => {
    const loadHistory = async () => {
      const stored = await AsyncStorage.getItem("plantHistory");
      if (stored) setHistory(JSON.parse(stored));
    };
    loadHistory();
  }, []);

  const toggleFavorite = async (plantName: string) => {
    const updatedHistory = history.map((item) => {
      if (item.name === plantName) {
        return { ...item, isFavorite: !item.isFavorite };
      }
      return item;
    });
    setHistory(updatedHistory);
    await AsyncStorage.setItem("plantHistory", JSON.stringify(updatedHistory));
  };

  const displayedHistory = showFavoritesOnly
    ? history.filter(item => item.isFavorite)
    : history;

  const renderItem = ({ item }: { item: PlantEntry }) => (
    <View style={s.card}>
      <TouchableOpacity
        style={s.cardContentWrapper}
        onPress={() => router.push({
          pathname: "/screens/PlantDetailsAiGenerated",
          params: { plantName: item.name }
        })}
      >
        <View style={s.textContainer}>
          <Text style={s.plantName}>{item.name}</Text>
          <Text numberOfLines={2} style={s.summaryText}>{item.summary}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => toggleFavorite(item.name)} style={s.favButton}>
        <Text style={s.favIcon}>{item.isFavorite ? "⭐" : "☆"}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={s.container}>
      <Text style={s.title}>Search History</Text>

      {history.length > 0 && (
        <View style={s.filterContainer}>
          <TouchableOpacity 
            style={[s.filterBtn, !showFavoritesOnly && s.filterBtnActive]} 
            onPress={() => setShowFavoritesOnly(false)}
          >
            <Text style={s.filterText}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[s.filterBtn, showFavoritesOnly && s.filterBtnActive]} 
            onPress={() => setShowFavoritesOnly(true)}
          >
            <Text style={s.filterText}>⭐ Favorites</Text>
          </TouchableOpacity>
        </View>
      )}

      {history.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyText}>No plants searched yet! 🪴</Text>
        </View>
      ) : (
        <FlatList
          data={displayedHistory}
          keyExtractor={(item) => item.name}
          renderItem={renderItem}
          contentContainerStyle={s.listPadding}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", paddingHorizontal: 20, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: "900", color: "#064e3b", marginBottom: 20 },
  listPadding: { paddingBottom: 40 },
  card: { backgroundColor: "white", borderRadius: 20, marginBottom: 12, flexDirection: "row", alignItems: "center", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  cardContentWrapper: { flex: 1, padding: 16 },
  favButton: { padding: 16, justifyContent: 'center', alignItems: 'center' },
  textContainer: { flex: 1 },
  plantName: { fontSize: 18, fontWeight: "700", color: "#1e293b", marginBottom: 4 },
  summaryText: { fontSize: 14, color: "#64748b", lineHeight: 20 },
  favIcon: { fontSize: 22 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "#94a3b8", fontSize: 16 },
  filterContainer: { flexDirection: 'row', marginBottom: 20, gap: 10 },
  filterBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e2e8f0' },
  filterBtnActive: { backgroundColor: '#059669' },
  filterText: { fontWeight: '700', color: '#ffffff' }
});