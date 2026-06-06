import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme } from "../../constants/theme";
import ScreenLayout from "../../components/ScreenLayout";
import type { CollectionEntry, OwnershipStatus } from "../../types";
import { getCollection, removeFromCollection } from "../../logic/collectionLogic";

type FilterStatus = 'all' | OwnershipStatus;

const STATUS_COLORS: Record<OwnershipStatus, string> = {
  own:   '#059669',
  want:  '#d97706',
  tried: '#64748b',
};

const STATUS_LABELS: Record<OwnershipStatus, string> = {
  own:   'Own it',
  want:  'Want it',
  tried: 'Tried it',
};

const FILTERS: { key: FilterStatus; label: string }[] = [
  { key: 'all',   label: 'All'   },
  { key: 'own',   label: 'Own'   },
  { key: 'want',  label: 'Want'  },
  { key: 'tried', label: 'Tried' },
];

export default function CollectionScreen() {
  const router = useRouter();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

  const [collection, setCollection] = useState<CollectionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

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

  const filtered = useMemo(
    () => filterStatus === 'all' ? collection : collection.filter(p => p.status === filterStatus),
    [collection, filterStatus],
  );

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
            <View style={s.metaRow}>
              {item.status && (
                <Text style={[s.statusBadge, { color: STATUS_COLORS[item.status] }]}>
                  {STATUS_LABELS[item.status]}
                </Text>
              )}
              {item.rating != null && (
                <Text style={s.ratingText}>
                  {'  '}{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
                </Text>
              )}
            </View>
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
      <Text style={s.title}>My Collection</Text>
      <Text style={s.subtitle}>{filtered.length} {filtered.length === 1 ? 'plant' : 'plants'}</Text>

      <View style={s.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[s.filterPill, filterStatus === f.key && s.filterPillActive]}
            onPress={() => setFilterStatus(f.key)}
          >
            <Text style={[s.filterPillText, filterStatus === f.key && s.filterPillActiveText]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>🪴</Text>
          <Text style={s.emptyText}>{collection.length === 0 ? 'No plants saved yet.' : 'No plants in this list.'}</Text>
          {collection.length === 0 && (
            <Text style={s.emptyHint}>Open any plant's detail page and tap "Save to Collection".</Text>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
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
  container:    { flex: 1, backgroundColor: t.background, paddingHorizontal: 20, paddingTop: 60 },
  centered:     { justifyContent: 'center', alignItems: 'center' },
  title:        { fontSize: 28, fontWeight: '900', color: t.textTitle, marginBottom: 4 },
  subtitle:     { fontSize: 14, color: t.textMuted, marginBottom: 24 },
  listPadding:  { paddingBottom: 80 },
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
  filterRow:         { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  filterPill:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1.5, borderColor: t.border, backgroundColor: t.surface },
  filterPillActive:  { borderColor: t.accent, backgroundColor: t.surfaceGreenSubtle },
  filterPillText:    { color: t.textSecondary, fontWeight: '600', fontSize: 13 },
  filterPillActiveText: { color: t.accentDark },
  metaRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  statusBadge:  { fontSize: 12, fontWeight: '600' },
  ratingText:   { fontSize: 12, color: t.textMuted },
});
