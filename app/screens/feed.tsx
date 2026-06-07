import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme, type Theme } from '../../constants/theme';
import { getFeed, type FeedItem } from '../../logic/feedLogic';
import FeedItemRow from '../../components/FeedItem';

export default function FeedScreen() {
  const router = useRouter();
  const theme  = useTheme();
  const s      = useMemo(() => styles(theme), [theme]);

  const [items, setItems]         = useState<FeedItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await getFeed(30);
    setItems(data);
    setLoading(false);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const data = await getFeed(30);
    setItems(data);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, []);

  return (
    <View style={s.container}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Activity Feed</Text>
        <View style={s.topBarSpacer} />
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <FeedItemRow item={item} />}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.accent}
            />
          }
          contentContainerStyle={[s.listContent, items.length === 0 && s.listContentEmpty]}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Text style={s.emptyIcon}>🌱</Text>
              <Text style={s.emptyTitle}>No activity yet</Text>
              <Text style={s.emptyBody}>Follow some people to see what they're up to</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container:        { flex: 1, backgroundColor: t.background },
  topBar:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, backgroundColor: t.surface, borderBottomWidth: 1, borderBottomColor: t.border },
  backBtn:          { paddingRight: 12 },
  backText:         { color: t.accent, fontWeight: '700', fontSize: 16 },
  title:            { flex: 1, fontSize: 18, fontWeight: '800', color: t.textTitle, textAlign: 'center' },
  topBarSpacer:     { width: 60 },
  centered:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent:      { paddingBottom: 80 },
  listContentEmpty: { flexGrow: 1 },
  separator:        { height: 1, backgroundColor: t.border, marginLeft: 62 },
  emptyState:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon:        { fontSize: 48, marginBottom: 12 },
  emptyTitle:       { fontSize: 18, fontWeight: '800', color: t.textTitle, marginBottom: 8 },
  emptyBody:        { fontSize: 14, color: t.textSecondary, textAlign: 'center', lineHeight: 20 },
});
