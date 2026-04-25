import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../constants/theme";
import type { PlantEntry } from "../types";
import { toggleFavoriteLogic, sortHistoryByDate } from "../logic/historyLogic";

export default function HistoryScreen() {
  const router = useRouter();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

  const [history, setHistory] = useState<PlantEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const loadHistory = async () => {
    try {
      const stored = await AsyncStorage.getItem("plantHistory");
      setHistory(stored ? JSON.parse(stored) : []);
    } catch {
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadHistory(); }, []));

  const toggleFavorite = async (plantName: string) => {
    const updated = toggleFavoriteLogic(history, plantName);
    setHistory(updated);
    try {
      await AsyncStorage.setItem("plantHistory", JSON.stringify(updated));
    } catch {
      setHistory(history);
    }
  };

  const deleteItem = async (plantName: string) => {
    const updated = history.filter(p => p.name !== plantName);
    setHistory(updated);
    try {
      await AsyncStorage.setItem("plantHistory", JSON.stringify(updated));
    } catch {
      setHistory(history);
    }
  };

  const displayedHistory = useMemo(() => {
    const filtered = showFavoritesOnly
      ? history.filter(item => item.isFavorite)
      : history;
    return sortHistoryByDate(filtered);
  }, [history, showFavoritesOnly]);

  const renderItem = ({ item }: { item: PlantEntry }) => (
    <View style={s.card}>
      <TouchableOpacity
        style={s.cardContentWrapper}
        onPress={() => router.push({
          pathname: "/screens/PlantDetailsAiGenerated",
          params: { plantName: item.name },
        })}
      >
        <View style={s.textContainer}>
          <Text style={s.plantName}>{item.name}</Text>
          <Text numberOfLines={2} style={s.summaryText}>{item.summary}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => toggleFavorite(item.name)} style={s.iconButton}>
        <Text style={s.favIcon}>{item.isFavorite ? "⭐" : "☆"}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => deleteItem(item.name)} style={s.iconButton}>
        <Text style={s.deleteIcon}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[s.container, s.centered]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>Search History</Text>

      {history.length > 0 && (
        <View style={s.filterContainer}>
          <TouchableOpacity
            style={[s.filterBtn, !showFavoritesOnly && s.filterBtnActive]}
            onPress={() => setShowFavoritesOnly(false)}
          >
            <Text style={[s.filterText, !showFavoritesOnly && s.filterTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.filterBtn, showFavoritesOnly && s.filterBtnActive]}
            onPress={() => setShowFavoritesOnly(true)}
          >
            <Text style={[s.filterText, showFavoritesOnly && s.filterTextActive]}>⭐ Favorites</Text>
          </TouchableOpacity>
        </View>
      )}

      {displayedHistory.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyText}>
            {showFavoritesOnly
              ? "No favourites yet — tap ☆ on any plant."
              : "No plants searched yet! 🪴"}
          </Text>
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

const styles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  container:        { flex: 1, backgroundColor: t.background, paddingHorizontal: 20, paddingTop: 60 },
  centered:         { justifyContent: 'center', alignItems: 'center' },
  title:            { fontSize: 28, fontWeight: "900", color: t.textTitle, marginBottom: 20 },
  listPadding:      { paddingBottom: 40 },
  card:             { backgroundColor: t.surface, borderRadius: 20, marginBottom: 12, flexDirection: "row", alignItems: "center", elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  cardContentWrapper: { flex: 1, padding: 16 },
  iconButton:       { padding: 14, justifyContent: 'center', alignItems: 'center' },
  textContainer:    { flex: 1 },
  plantName:        { fontSize: 18, fontWeight: "700", color: t.textPrimary, marginBottom: 4 },
  summaryText:      { fontSize: 14, color: t.textSecondary, lineHeight: 20 },
  favIcon:          { fontSize: 22 },
  deleteIcon:       { fontSize: 14, color: t.textMuted },
  emptyState:       { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText:        { color: t.textMuted, fontSize: 16, textAlign: 'center' },
  filterContainer:  { flexDirection: 'row', marginBottom: 20, gap: 10 },
  filterBtn:        { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: t.border },
  filterBtnActive:  { backgroundColor: t.accent },
  filterText:       { fontWeight: '700', color: t.textSecondary },
  filterTextActive: { color: '#ffffff' },
});
