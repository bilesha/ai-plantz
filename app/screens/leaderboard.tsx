import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, type Theme } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

type LeaderboardRow = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  collection_count: number;
  streak: number;
  badge_count: number;
  score: number;
};

const RANK_MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function Avatar({ url, name, size }: { url: string | null; name: string; size: number }) {
  const [errored, setErrored] = useState(false);
  const theme = useTheme();
  const showImg = !errored && !!url?.startsWith('http');

  return showImg ? (
    <Image
      source={{ uri: url! }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.border }}
      onError={() => setErrored(true)}
    />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.accent, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: size * 0.35 }}>{getInitials(name)}</Text>
    </View>
  );
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [sessionRes, dataRes] = await Promise.all([
        supabase.auth.getSession(),
        supabase
          .from('leaderboard')
          .select('user_id, username, avatar_url, collection_count, streak, badge_count, score')
          .order('score', { ascending: false })
          .limit(50),
      ]);
      if (!mountedRef.current) return;
      setCurrentUserId(sessionRes.data.session?.user?.id ?? null);
      setRows((dataRes.data ?? []) as LeaderboardRow[]);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => { load(); }, []);

  const renderItem = ({ item, index }: { item: LeaderboardRow; index: number }) => {
    const rank = index + 1;
    const isMe = item.user_id === currentUserId;
    const medal = RANK_MEDALS[rank];

    return (
      <View style={[s.row, isMe && s.rowMe, index > 0 && s.rowBorder]}>
        <View style={s.rankBox}>
          {medal
            ? <Text style={s.medal}>{medal}</Text>
            : <Text style={[s.rankNum, isMe && s.rankNumMe]}>{rank}</Text>
          }
        </View>
        <Avatar url={item.avatar_url} name={item.username} size={40} />
        <View style={s.nameBox}>
          <Text style={[s.username, isMe && s.usernameMe]} numberOfLines={1}>
            {item.username}{isMe ? ' (you)' : ''}
          </Text>
          <Text style={s.meta}>
            🪴 {item.collection_count} · 🔥 {item.streak} · 🏅 {item.badge_count}
          </Text>
        </View>
        <Text style={[s.score, isMe && s.scoreMe]}>{item.score}</Text>
      </View>
    );
  };

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>Leaderboard</Text>
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : rows.length === 0 ? (
        <View style={s.centered}>
          <Text style={s.emptyIcon}>🏆</Text>
          <Text style={s.emptyText}>No scores yet. Be the first!</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={item => item.user_id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.accent} />}
          ListHeaderComponent={
            <View style={s.scoreKey}>
              <Text style={s.scoreKeyText}>Score = 🪴×10 + 🔥×5 + 🏅×20</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: t.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: t.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.border,
    gap: 8,
  },
  backBtn:   { paddingRight: 4 },
  backArrow: { fontSize: 30, color: t.accent, lineHeight: 32 },
  title:     { fontSize: 20, fontWeight: '800', color: t.textTitle },

  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, color: t.textMuted, fontWeight: '600' },

  list: { padding: 16, paddingBottom: 60 },

  scoreKey:     { marginBottom: 12, alignItems: 'center' },
  scoreKeyText: { fontSize: 12, color: t.textMuted, fontWeight: '600' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: t.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  rowMe:     { backgroundColor: t.surfaceGreen },

  rankBox:   { width: 32, alignItems: 'center' },
  medal:     { fontSize: 22 },
  rankNum:   { fontSize: 15, fontWeight: '800', color: t.textMuted },
  rankNumMe: { color: t.accent },

  nameBox:   { flex: 1, gap: 2 },
  username:  { fontSize: 15, fontWeight: '700', color: t.textPrimary },
  usernameMe:{ color: t.accentDark },
  meta:      { fontSize: 12, color: t.textMuted },

  score:    { fontSize: 18, fontWeight: '900', color: t.textPrimary, minWidth: 40, textAlign: 'right' },
  scoreMe:  { color: t.accent },
});
