import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme } from "../../constants/theme";
import type { CollectionEntry } from "../../types";
import { getCollection, removeFromCollection } from "../../logic/collectionLogic";

export default function CollectionScreen() {
  const router = useRouter();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

  const [collection, setCollection] = useState<CollectionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCollection = async () => {
    try {
      const items = await getCollection();
      setCollection(items);
    } catch {
      setCollection([]);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadCollection(); }, []));

  const handleRemove = useCallback(async (name: string) => {
    const prev = collection;
    const optimistic = collection.filter(p => p.name !== name);
    setCollection(optimistic);
    try {
      await removeFromCollection(name);
    } catch {
      setCollection(prev);
    }
  }, [collection]);

  const renderItem = useCallback(({ item, index }: { item: CollectionEntry; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(350)}>
      <View style={s.card}>
        <TouchableOpacity
          style={s.cardContent}
          onPress={() => router.push({
            pathname: "/screens/PlantDetailsAiGenerated",
            params: { plantName: item.name, summary: item.summary },
          })}
        >
          <View style={s.cardLeft}>
            <Text style={s.leafIcon}>🪴</Text>
          </View>
          <View style={s.textContainer}>
            <Text style={s.plantName}>{item.name}</Text>
            {item.summary ? (
              <Text numberOfLines={2} style={s.summaryText}>{item.summary}</Text>
            ) : null}
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleRemove(item.name)} style={s.removeBtn}>
          <Text style={s.removeIcon}>✕</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  ), [s, router, handleRemove]);

  if (isLoading) {
    return (
      <View style={[s.container, s.centered]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
        <Text style={s.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={s.title}>My Collection</Text>
      <Text style={s.subtitle}>{collection.length} {collection.length === 1 ? 'plant' : 'plants'} saved</Text>

      {collection.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>🪴</Text>
          <Text style={s.emptyText}>No plants saved yet.</Text>
          <Text style={s.emptyHint}>Open any plant's detail page and tap "Save to Collection".</Text>
        </View>
      ) : (
        <FlatList
          data={collection}
          keyExtractor={(item) => item.name}
          renderItem={renderItem}
          contentContainerStyle={s.listPadding}
        />
      )}
    </View>
  );
}

const styles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  container:    { flex: 1, backgroundColor: t.background, paddingHorizontal: 20, paddingTop: 60 },
  centered:     { justifyContent: 'center', alignItems: 'center' },
  backBtn:      { marginBottom: 20 },
  backText:     { color: t.accent, fontWeight: '700', fontSize: 16 },
  title:        { fontSize: 28, fontWeight: '900', color: t.textTitle, marginBottom: 4 },
  subtitle:     { fontSize: 14, color: t.textMuted, marginBottom: 24 },
  listPadding:  { paddingBottom: 40 },
  card:         { backgroundColor: t.surface, borderRadius: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  cardContent:  { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16 },
  cardLeft:     { marginRight: 14 },
  leafIcon:     { fontSize: 28 },
  textContainer: { flex: 1 },
  plantName:    { fontSize: 18, fontWeight: '700', color: t.textPrimary, marginBottom: 4 },
  summaryText:  { fontSize: 14, color: t.textSecondary, lineHeight: 20 },
  removeBtn:    { padding: 14, justifyContent: 'center', alignItems: 'center' },
  removeIcon:   { fontSize: 14, color: t.textMuted },
  emptyState:   { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyIcon:    { fontSize: 56, marginBottom: 16 },
  emptyText:    { fontSize: 18, fontWeight: '700', color: t.textTitle, marginBottom: 8, textAlign: 'center' },
  emptyHint:    { fontSize: 14, color: t.textMuted, textAlign: 'center', lineHeight: 22 },
});
