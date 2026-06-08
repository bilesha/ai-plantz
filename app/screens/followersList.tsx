import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme, type Theme } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { followUser, unfollowUser } from '../../logic/followLogic';

type UserRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

export default function FollowersListScreen() {
  const { userId, type, username } = useLocalSearchParams();
  const safeUserId  = Array.isArray(userId)   ? userId[0]   : userId!;
  const safeType    = (Array.isArray(type)     ? type[0]     : type) as 'followers' | 'following';
  const safeUsername = Array.isArray(username) ? username[0] : (username ?? 'User');
  const router = useRouter();
  const theme  = useTheme();
  const s      = useMemo(() => styles(theme), [theme]);

  const [users, setUsers]               = useState<UserRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [followLoading, setFollowLoading] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id ?? null;
        setCurrentUserId(uid);

        const filterField = safeType === 'followers' ? 'following_id' : 'follower_id';
        const targetField = safeType === 'followers' ? 'follower_id'  : 'following_id';

        const { data: followRows } = await supabase
          .from('follows')
          .select(targetField)
          .eq(filterField, safeUserId);

        const targetIds = (followRows ?? []).map((r: any) => r[targetField]);
        if (targetIds.length === 0) { setLoading(false); return; }

        const [profilesRes, myFollowingRes] = await Promise.all([
          supabase.from('profiles').select('id, username, avatar_url').in('id', targetIds),
          uid
            ? supabase.from('follows').select('following_id').eq('follower_id', uid)
            : Promise.resolve({ data: [] as { following_id: string }[] }),
        ]);

        setUsers(profilesRes.data ?? []);
        setFollowingSet(new Set((myFollowingRes.data ?? []).map(r => r.following_id)));
      } catch {
        // silent — list just stays empty
      } finally {
        setLoading(false);
      }
    })();
  }, [safeUserId, safeType]);

  const handleFollowToggle = async (targetId: string) => {
    if (!currentUserId || followLoading.has(targetId)) return;
    setFollowLoading(prev => new Set(prev).add(targetId));
    const wasFollowing = followingSet.has(targetId);
    setFollowingSet(prev => {
      const next = new Set(prev);
      wasFollowing ? next.delete(targetId) : next.add(targetId);
      return next;
    });
    try {
      await (wasFollowing ? unfollowUser(targetId) : followUser(targetId));
    } catch {
      setFollowingSet(prev => {
        const next = new Set(prev);
        wasFollowing ? next.add(targetId) : next.delete(targetId);
        return next;
      });
    } finally {
      setFollowLoading(prev => { const next = new Set(prev); next.delete(targetId); return next; });
    }
  };

  const title = safeType === 'followers'
    ? `${safeUsername}'s Followers`
    : `${safeUsername}'s Following`;

  const renderItem = ({ item }: { item: UserRow }) => {
    const isMe         = item.id === currentUserId;
    const isFollowing  = followingSet.has(item.id);
    const isProcessing = followLoading.has(item.id);

    return (
      <View style={s.row}>
        <TouchableOpacity
          style={s.userLeft}
          onPress={() => router.push({ pathname: '/screens/publicProfile', params: { userId: item.id } })}
        >
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={s.avatar} />
          ) : (
            <View style={s.avatarPlaceholder}>
              <Text style={s.avatarInitials}>{(item.username ?? 'U').slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          <Text style={s.username}>{item.username ?? 'User'}</Text>
        </TouchableOpacity>

        {!isMe && currentUserId && (
          <TouchableOpacity
            style={isFollowing ? s.unfollowBtn : s.followBtn}
            onPress={() => handleFollowToggle(item.id)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={isFollowing ? theme.accent : '#fff'} />
            ) : (
              <Text style={isFollowing ? s.unfollowBtnText : s.followBtnText}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : users.length === 0 ? (
        <View style={s.centered}>
          <Text style={s.emptyText}>
            {safeType === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
        />
      )}
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container:          { flex: 1, backgroundColor: t.background },
  header:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: t.border },
  backBtn:            { marginRight: 16, padding: 4 },
  backText:           { fontSize: 22, color: t.accent, fontWeight: '700' },
  title:              { fontSize: 18, fontWeight: '800', color: t.textTitle, flex: 1 },
  centered:           { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText:          { fontSize: 15, color: t.textMuted },
  list:               { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  row:                { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: t.border },
  userLeft:           { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatar:             { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: t.border },
  avatarPlaceholder:  { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: t.accent, justifyContent: 'center', alignItems: 'center' },
  avatarInitials:     { fontSize: 14, fontWeight: '900', color: '#fff' },
  username:           { fontSize: 15, fontWeight: '700', color: t.textPrimary },
  followBtn:          { backgroundColor: t.accent, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 100, minWidth: 90, alignItems: 'center' },
  followBtnText:      { color: '#fff', fontWeight: '700', fontSize: 13 },
  unfollowBtn:        { borderWidth: 1.5, borderColor: t.accent, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 100, minWidth: 90, alignItems: 'center' },
  unfollowBtnText:    { color: t.accent, fontWeight: '700', fontSize: 13 },
});
