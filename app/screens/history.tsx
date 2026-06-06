import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme } from "../../constants/theme";
import ScreenLayout from "../../components/ScreenLayout";
import type { PlantEntry } from "../../types";
import { toggleFavoriteLogic, sortHistoryByDate } from "../../logic/historyLogic";
import { getHistory, deleteHistoryItem, setFavorite } from "../../utilities/storage";

export default function HistoryScreen() {
  const router = useRouter();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

  const [history, setHistory] = useState<PlantEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const loadHistory = async () => {
    try {
      setHistory(await getHistory());
    } catch {
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadHistory(); }, []));

  const toggleFavorite = useCallback((plantName: string) => {
    const updated = toggleFavoriteLogic(history, plantName);
    const entry = updated.find(p => p.name === plantName);
    if (!entry) return;
    setHistory(updated);
    setFavorite(plantName, entry.isFavorite);
  }, [history]);

  const deleteItem = useCallback((plantName: string) => {
    setHistory(prev => prev.filter(p => p.name !== plantName));
    deleteHistoryItem(plantName);
  }, []);

  const displayedHistory = useMemo(() => {
    const filtered = showFavoritesOnly
      ? history.filter(item => item.isFavorite)
      : history;
    return sortHistoryByDate(filtered);
  }, [history, showFavoritesOnly]);

  const renderItem = useCallback(({ item, index }: { item: PlantEntry; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(350)}>
    <View style={s.card}>
      <TouchableOpacity
        style={s.cardContentWrapper}
        onPress={() => router.push({
          pathname: "/screens/PlantDetailsAiGenerated",
          params: { plantName: item.name, summary: item.summary },
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
    </Animated.View>
  ), [s, router, toggleFavorite, deleteItem]);

  if (isLoading) {
    return (
      <ScreenLayout>
        <View style={[s.container, s.centered]}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
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
        showFavoritesOnly ? (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>⭐</Text>
            <Text style={s.emptyTitle}>No favourites yet</Text>
            <Text style={s.emptyBody}>Tap the ☆ on any plant in your history to save it here.</Text>
          </View>
        ) : (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>🔍</Text>
            <Text style={s.emptyTitle}>No searches yet</Text>
            <Text style={s.emptyBody}>Plants you search for will appear here. Tap the star to save your favourites.</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/')}>
              <Text style={s.emptyBtnText}>Search your first plant →</Text>
            </TouchableOpacity>
          </View>
        )
      ) : (
        <FlatList
          data={displayedHistory}
          keyExtractor={(item) => item.name}
          renderItem={renderItem}
          contentContainerStyle={s.listPadding}
        />
      )}
    </View>
    </ScreenLayout>
  );
}

const styles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  container:        { flex: 1, backgroundColor: t.background, paddingHorizontal: 20, paddingTop: 60 },
  centered:         { justifyContent: 'center', alignItems: 'center' },
  title:            { fontSize: 28, fontWeight: "900", color: t.textTitle, marginBottom: 20 },
  listPadding:      { paddingBottom: 80 },
  card:             { backgroundColor: t.surface, borderRadius: 20, marginBottom: 12, flexDirection: "row", alignItems: "center", elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  cardContentWrapper: { flex: 1, padding: 16 },
  iconButton:       { padding: 14, justifyContent: 'center', alignItems: 'center' },
  textContainer:    { flex: 1 },
  plantName:        { fontSize: 18, fontWeight: "700", color: t.textPrimary, marginBottom: 4 },
  summaryText:      { fontSize: 14, color: t.textSecondary, lineHeight: 20 },
  favIcon:          { fontSize: 22 },
  deleteIcon:       { fontSize: 14, color: t.textMuted },
  emptyState:   { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyIcon:    { fontSize: 56, marginBottom: 16 },
  emptyTitle:   { fontSize: 20, fontWeight: '800', color: t.textTitle, marginBottom: 10, textAlign: 'center' },
  emptyBody:    { fontSize: 15, color: t.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  emptyBtn:     { backgroundColor: t.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  filterContainer:  { flexDirection: 'row', marginBottom: 20, gap: 10 },
  filterBtn:        { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: t.border },
  filterBtnActive:  { backgroundColor: t.accent },
  filterText:       { fontWeight: '700', color: t.textSecondary },
  filterTextActive: { color: '#ffffff' },
});
