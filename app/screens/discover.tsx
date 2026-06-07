// Requires the following Supabase RLS policies:
//   create policy "public read" on profiles for select using (true);
//
// Required Supabase RPC function:
//   create or replace function get_trending_plants(limit_count int default 10)
//   returns table(plant_name text, collection_count bigint)
//   language sql security definer as $$
//     select plant_name, count(*) as collection_count
//     from plant_collection
//     group by plant_name
//     order by collection_count desc
//     limit limit_count;
//   $$;

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme, type Theme } from '../../constants/theme';
import ScreenLayout from '../../components/ScreenLayout';
import { supabase } from '../../lib/supabase';
import { getFeed, type FeedItem } from '../../logic/feedLogic';
import FeedItemRow from '../../components/FeedItem';

type ProfileResult = {
  id: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type TrendingPlant = {
  plant_name: string;
  collection_count: number;
};

async function getTrendingPlants(): Promise<TrendingPlant[]> {
  const { data, error } = await supabase.rpc('get_trending_plants', { limit_count: 10 });
  if (error || !data) return [];
  return data as TrendingPlant[];
}


function getInitials(str: string): string {
  const parts = str.trim().split(/[\s._@]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return str.slice(0, 2).toUpperCase();
}

function Avatar({ url, name, size, style: styleProp }: {
  url: string | null;
  name: string;
  size: number;
  style?: object;
}) {
  const [errored, setErrored] = useState(false);
  const theme = useTheme();
  const s = useMemo(() => avatarStyles(theme), [theme]);
  const showImage = !errored && !!url?.startsWith('http');

  return showImage ? (
    <Image
      source={{ uri: url! }}
      style={[{ width: size, height: size, borderRadius: size / 2 }, styleProp]}
      onError={() => setErrored(true)}
    />
  ) : (
    <View style={[s.placeholder, { width: size, height: size, borderRadius: size / 2 }, styleProp]}>
      <Text style={[s.initials, { fontSize: size * 0.35 }]}>{getInitials(name)}</Text>
    </View>
  );
}

const avatarStyles = (t: Theme) => StyleSheet.create({
  placeholder: { backgroundColor: t.accent, justifyContent: 'center', alignItems: 'center' },
  initials:    { fontWeight: '900', color: '#fff' },
});

export default function DiscoverScreen() {
  const router = useRouter();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfileResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [trending, setTrending] = useState<TrendingPlant[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [activity, setActivity] = useState<FeedItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setTrendingLoading(true);

      (async () => {
        const trendingData = await getTrendingPlants();
        if (!active) return;
        setTrending(trendingData);
        setTrendingLoading(false);

        setActivityLoading(true);
        const feedData = await getFeed(5);
        if (active) {
          setActivity(feedData);
          setActivityLoading(false);
        }
      })();

      return () => { active = false; };
    }, [])
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, username, bio, avatar_url')
          .ilike('username', `%${trimmed}%`)
          .limit(30);

        setResults((data ?? []) as ProfileResult[]);
        setSearched(true);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  return (
    <ScreenLayout>
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Discover</Text>

      {(trendingLoading || trending.length > 0) && (
        <View style={s.trendingSection}>
          <Text style={s.trendingHeading}>TRENDING PLANTS 🌿</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.trendingScroll}
          >
            {trendingLoading
              ? [0, 1, 2].map((i) => <View key={i} style={s.skeletonPill} />)
              : trending.map((item) => (
                  <TouchableOpacity
                    key={item.plant_name}
                    style={s.trendingPill}
                    onPress={() =>
                      router.push({
                        pathname: '/screens/PlantDetailsAiGenerated',
                        params: { plantName: item.plant_name },
                      })
                    }
                    activeOpacity={0.75}
                  >
                    <Text style={s.pillName} numberOfLines={1}>{item.plant_name}</Text>
                    <Text style={s.pillCount}>{item.collection_count} collector{item.collection_count !== 1 ? 's' : ''}</Text>
                  </TouchableOpacity>
                ))}
          </ScrollView>
        </View>
      )}

      {(activityLoading || activity.length > 0) && (
        <View style={s.activitySection}>
          <Text style={s.activityHeading}>FOLLOWING ACTIVITY 🌱</Text>
          <View style={s.activityCard}>
            {activityLoading
              ? [0, 1].map((i) => <View key={i} style={[s.skeletonRow, i === 0 && s.skeletonRowBorder]} />)
              : activity.map((item, i) => (
                  <View key={item.id} style={i < activity.length - 1 ? s.activityRowBorder : undefined}>
                    <FeedItemRow item={item} />
                  </View>
                ))
            }
          </View>
          {!activityLoading && activity.length > 0 && (
            <TouchableOpacity style={s.seeAllBtn} onPress={() => router.push('/screens/feed')}>
              <Text style={s.seeAllText}>See all activity →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={s.inputCard}>
        <TextInput
          style={s.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by username..."
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {loading && (
        <ActivityIndicator style={s.spinner} color={theme.accent} />
      )}

      {!loading && query.trim().length > 0 && query.trim().length < 2 && (
        <Text style={s.hint}>Type at least 2 characters to search.</Text>
      )}

      {!loading && searched && results.length === 0 && (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>🔍</Text>
          <Text style={s.emptyText}>No users found for "{query.trim()}".</Text>
        </View>
      )}

      {!loading && results.length > 0 && (
        <View style={s.resultsList}>
          {results.map((user, i) => {
            const name = user.username ?? 'Plant Lover';
            return (
              <TouchableOpacity
                key={user.id}
                style={[s.resultRow, i < results.length - 1 && s.resultBorder]}
                onPress={() => router.push({ pathname: '/screens/publicProfile', params: { userId: user.id } })}
                activeOpacity={0.7}
              >
                <Avatar url={user.avatar_url} name={name} size={44} style={s.avatar} />
                <View style={s.resultText}>
                  <Text style={s.resultName}>{name}</Text>
                  {user.bio ? (
                    <Text style={s.resultBio} numberOfLines={1}>{user.bio}</Text>
                  ) : null}
                </View>
                <Text style={s.chevron}>›</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {!loading && !searched && query.trim().length === 0 && (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>👥</Text>
          <Text style={s.emptyText}>Search for other plant lovers by username.</Text>
        </View>
      )}
    </ScrollView>
    </ScreenLayout>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container:    { flex: 1, backgroundColor: t.background },
  content:      { padding: 24, paddingTop: 60, paddingBottom: 80 },

  title:        { fontSize: 28, fontWeight: '900', color: t.textTitle, marginBottom: 24 },

  trendingSection:  { marginBottom: 24 },
  trendingHeading:  { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: t.textMuted, marginBottom: 12 },
  trendingScroll:   { gap: 10, paddingRight: 4 },
  trendingPill:     { backgroundColor: t.surface, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3, maxWidth: 180 },
  pillName:         { fontSize: 14, fontWeight: '700', color: t.textPrimary },
  pillCount:        { fontSize: 12, color: t.accent, marginTop: 2, fontWeight: '600' },
  skeletonPill:     { width: 110, height: 52, borderRadius: 24, backgroundColor: t.border, opacity: 0.6 },

  activitySection:    { marginBottom: 24 },
  activityHeading:    { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: t.textMuted, marginBottom: 12 },
  activityCard:       { backgroundColor: t.surface, borderRadius: 20, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  activityRowBorder:  { borderBottomWidth: 1, borderBottomColor: t.border },
  skeletonRow:        { height: 52, backgroundColor: t.border, opacity: 0.5 },
  skeletonRowBorder:  { borderBottomWidth: 1, borderBottomColor: t.background },
  seeAllBtn:          { marginTop: 10, alignSelf: 'flex-end' },
  seeAllText:         { fontSize: 13, fontWeight: '700', color: t.accent },

  inputCard:    { backgroundColor: t.surface, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 4, marginBottom: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  input:        { fontSize: 17, color: t.textPrimary, paddingVertical: 14 },

  spinner:      { marginTop: 24 },
  hint:         { fontSize: 14, color: t.textMuted, textAlign: 'center', marginTop: 12 },

  resultsList:  { backgroundColor: t.surface, borderRadius: 20, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  resultRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  resultBorder: { borderBottomWidth: 1, borderBottomColor: t.border },
  avatar:       { backgroundColor: t.border },
  resultText:   { flex: 1 },
  resultName:   { fontSize: 16, fontWeight: '700', color: t.textPrimary },
  resultBio:    { fontSize: 13, color: t.textSecondary, marginTop: 2 },
  chevron:      { fontSize: 20, color: t.textMuted },

  emptyState:   { alignItems: 'center', marginTop: 48 },
  emptyIcon:    { fontSize: 40, marginBottom: 12 },
  emptyText:    { fontSize: 15, color: t.textMuted, textAlign: 'center' },
});
