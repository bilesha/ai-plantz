import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme } from "../../constants/theme";
import ScreenLayout from "../../components/ScreenLayout";
import type { CollectionEntry, OwnershipStatus } from "../../types";
import { getCollection, removeFromCollection } from "../../logic/collectionLogic";
import { getRecentHealthLogCounts } from "../../logic/healthLogLogic";
import { useToast } from "../../context/ToastContext";

type FilterStatus = 'all' | OwnershipStatus;
type SortBy = 'name_asc' | 'name_desc' | 'date_new' | 'date_old' | 'rating_high';

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

const SORT_OPTIONS: { key: SortBy; label: string }[] = [
  { key: 'date_new',    label: 'Newest'    },
  { key: 'date_old',    label: 'Oldest'    },
  { key: 'name_asc',    label: 'Name A–Z'  },
  { key: 'name_desc',   label: 'Name Z–A'  },
  { key: 'rating_high', label: 'Top Rated' },
];

function isDueForWatering(item: CollectionEntry): boolean {
  if (!item.next_watering_date) return false;
  return new Date(item.next_watering_date) <= new Date();
}

export default function CollectionScreen() {
  const router = useRouter();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const { showToast } = useToast();

  const [collection, setCollection] = useState<CollectionEntry[]>([]);
  const [healthLogCounts, setHealthLogCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date_new');

  const loadCollection = async () => {
    try {
      const items = await getCollection();
      setCollection(items);
      if (items.length > 0) {
        const counts = await getRecentHealthLogCounts(items.map(i => i.name));
        setHealthLogCounts(counts);
      }
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
      showToast('Plant removed', 'success');
    } catch {
      setCollection(prev);
    }
  }, [collection, showToast]);

  const filtered = useMemo(() => {
    let items = filterStatus === 'all' ? collection : collection.filter(p => p.status === filterStatus);

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.notes != null && p.notes.toLowerCase().includes(q))
      );
    }

    return [...items].sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':    return a.name.localeCompare(b.name);
        case 'name_desc':   return b.name.localeCompare(a.name);
        case 'date_old':    return a.addedAt - b.addedAt;
        case 'rating_high': return (b.rating ?? -1) - (a.rating ?? -1);
        default:            return b.addedAt - a.addedAt; // date_new
      }
    });
  }, [collection, filterStatus, searchQuery, sortBy]);

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
            {item.photo_url ? (
              <Image source={{ uri: item.photo_url }} style={s.plantThumb} />
            ) : (
              <Text style={s.leafIcon}>🪴</Text>
            )}
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
            {(isDueForWatering(item) || (healthLogCounts[item.name] ?? 0) > 0) && (
              <View style={s.badgeRow}>
                {isDueForWatering(item) && (
                  <Text style={s.waterBadge}>💧 Water due</Text>
                )}
                {(healthLogCounts[item.name] ?? 0) > 0 && (
                  <Text style={s.healthBadge}>
                    📋 {healthLogCounts[item.name]} {healthLogCounts[item.name] === 1 ? 'note' : 'notes'}
                  </Text>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleRemove(item.name)} style={s.removeBtn}>
          <Text style={s.removeIcon}>✕</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  ), [s, router, handleRemove, healthLogCounts]);

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

      <TextInput
        style={s.searchInput}
        placeholder="Search plants or notes..."
        placeholderTextColor={theme.textMuted}
        value={searchQuery}
        onChangeText={setSearchQuery}
        clearButtonMode="while-editing"
        returnKeyType="search"
      />

      <View style={s.filterRow}>
        {SORT_OPTIONS.map(o => (
          <TouchableOpacity
            key={o.key}
            style={[s.filterPill, sortBy === o.key && s.filterPillActive]}
            onPress={() => setSortBy(o.key)}
          >
            <Text style={[s.filterPillText, sortBy === o.key && s.filterPillActiveText]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
        collection.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>🪴</Text>
            <Text style={s.emptyTitle}>Your collection is empty</Text>
            <Text style={s.emptyBody}>Start searching for plants and save them here with your ownership status, ratings, and notes.</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/')}>
              <Text style={s.emptyBtnText}>Search for plants →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>🔍</Text>
            <Text style={s.emptyTitle}>No plants in this list.</Text>
          </View>
        )
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
  plantThumb:   { width: 40, height: 40, borderRadius: 8 },
  textContainer: { flex: 1 },
  plantName:    { fontSize: 18, fontWeight: '700', color: t.textPrimary, marginBottom: 4 },
  summaryText:  { fontSize: 14, color: t.textSecondary, lineHeight: 20 },
  removeBtn:    { padding: 14, justifyContent: 'center', alignItems: 'center' },
  removeIcon:   { fontSize: 14, color: t.textMuted },
  emptyState:   { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyIcon:    { fontSize: 56, marginBottom: 16 },
  emptyTitle:   { fontSize: 20, fontWeight: '800', color: t.textTitle, marginBottom: 10, textAlign: 'center' },
  emptyBody:    { fontSize: 15, color: t.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  emptyBtn:     { backgroundColor: t.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  searchInput:  { backgroundColor: t.surface, borderRadius: 14, borderWidth: 1.5, borderColor: t.border, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: t.textPrimary, marginBottom: 12 },
  filterRow:         { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  filterPill:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1.5, borderColor: t.border, backgroundColor: t.surface },
  filterPillActive:  { borderColor: t.accent, backgroundColor: t.surfaceGreenSubtle },
  filterPillText:    { color: t.textSecondary, fontWeight: '600', fontSize: 13 },
  filterPillActiveText: { color: t.accentDark },
  metaRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  statusBadge:  { fontSize: 12, fontWeight: '600' },
  ratingText:   { fontSize: 12, color: t.textMuted },
  badgeRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  waterBadge:   { fontSize: 12, color: '#2563eb', fontWeight: '700' },
  healthBadge:  { fontSize: 12, color: '#059669', fontWeight: '700' },
});
