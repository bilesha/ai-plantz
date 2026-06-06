// Run in Supabase SQL editor to allow public reads of profiles:
//   create policy "public read" on profiles for select using (true);

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme, type Theme } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { getPublicCollection } from '../../logic/collectionLogic';
import {
  followUser,
  unfollowUser,
  isFollowing,
  getFollowerCount,
  getFollowingCount,
} from '../../logic/followLogic';
import type { CollectionEntry, OwnershipStatus } from '../../types';

type ProfileData = {
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
};

const STATUS_GROUPS: { status: OwnershipStatus; label: string }[] = [
  { status: 'own',   label: 'Owns'  },
  { status: 'want',  label: 'Wants' },
  { status: 'tried', label: 'Tried' },
];

const STATUS_COLORS: Record<OwnershipStatus, string> = {
  own:   '#059669',
  want:  '#d97706',
  tried: '#64748b',
};

function getInitials(str: string): string {
  const parts = str.trim().split(/[\s._@]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return str.slice(0, 2).toUpperCase();
}

export default function PublicProfileScreen() {
  const { userId } = useLocalSearchParams();
  const safeUserId = Array.isArray(userId) ? userId[0] : userId;
  const router = useRouter();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [collection, setCollection] = useState<CollectionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (!safeUserId) { setError('No user specified.'); setLoading(false); return; }

    (async () => {
      try {
        const sessionPromise = supabase.auth.getSession();

        const [
          profileRes,
          collectionData,
          followerCountVal,
          followingCountVal,
          { data: { session } },
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select('username, bio, avatar_url')
            .eq('id', safeUserId)
            .maybeSingle(),
          getPublicCollection(safeUserId),
          getFollowerCount(safeUserId),
          getFollowingCount(safeUserId),
          sessionPromise,
        ]);

        if (profileRes.error) throw profileRes.error;
        setProfile(profileRes.data ?? { username: null, bio: null, avatar_url: null });
        setCollection(collectionData);
        setFollowerCount(followerCountVal);
        setFollowingCount(followingCountVal);

        const currentUserId = session?.user?.id ?? null;
        if (currentUserId === safeUserId) {
          setIsOwnProfile(true);
        } else if (currentUserId) {
          setFollowing(await isFollowing(safeUserId));
        }
      } catch {
        setError('Could not load this profile.');
      } finally {
        setLoading(false);
      }
    })();
  }, [safeUserId]);

  const handleFollowToggle = async () => {
    if (followLoading) return;
    setFollowLoading(true);

    if (following) {
      setFollowing(false);
      setFollowerCount(c => c - 1);
      await unfollowUser(safeUserId!);
    } else {
      setFollowing(true);
      setFollowerCount(c => c + 1);
      await followUser(safeUserId!);
    }

    setFollowLoading(false);
  };

  const displayName = profile?.username ?? 'Plant Lover';
  const showImage = !avatarError && !!profile?.avatar_url?.startsWith('http');

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.centered}>
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtnCentered}>
          <Text style={s.backText}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
        <Text style={s.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={s.avatarSection}>
        {showImage ? (
          <Image
            source={{ uri: profile!.avatar_url! }}
            style={s.avatar}
            onError={() => setAvatarError(true)}
          />
        ) : (
          <View style={s.avatarPlaceholder}>
            <Text style={s.avatarInitials}>{getInitials(displayName)}</Text>
          </View>
        )}

        <Text style={s.username}>{displayName}</Text>

        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text style={s.statCount}>{followerCount}</Text>
            <Text style={s.statLabel}>Followers</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statCount}>{followingCount}</Text>
            <Text style={s.statLabel}>Following</Text>
          </View>
        </View>

        {profile?.bio ? <Text style={s.bio}>{profile.bio}</Text> : null}

        {!isOwnProfile && (
          <TouchableOpacity
            style={following ? s.unfollowBtn : s.followBtn}
            onPress={handleFollowToggle}
            disabled={followLoading}
            activeOpacity={0.8}
          >
            {followLoading
              ? <ActivityIndicator color={following ? theme.accent : '#fff'} size="small" />
              : <Text style={following ? s.unfollowBtnText : s.followBtnText}>
                  {following ? 'Following' : 'Follow'}
                </Text>
            }
          </TouchableOpacity>
        )}
      </View>

      <Text style={s.sectionLabel}>COLLECTION</Text>

      {collection.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>No plants in collection yet.</Text>
        </View>
      ) : (
        STATUS_GROUPS.map(({ status, label }) => {
          const group = collection.filter(e => e.status === status);
          if (group.length === 0) return null;
          return (
            <View key={status} style={s.groupSection}>
              <Text style={[s.groupLabel, { color: STATUS_COLORS[status] }]}>
                {label.toUpperCase()} · {group.length}
              </Text>
              <View style={s.card}>
                {group.map((entry, i) => (
                  <View
                    key={entry.name}
                    style={[s.row, i < group.length - 1 && s.rowBorder]}
                  >
                    <Text style={s.plantName}>{entry.name}</Text>
                    {entry.rating != null && (
                      <Text style={s.rating}>
                        {'★'.repeat(entry.rating)}{'☆'.repeat(5 - entry.rating)}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container:         { flex: 1, backgroundColor: t.background },
  content:           { padding: 24, paddingTop: 60, paddingBottom: 48 },
  centered:          { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.background, padding: 32 },

  backBtn:           { marginBottom: 24 },
  backBtnCentered:   { marginTop: 16 },
  backText:          { color: t.accent, fontWeight: '700', fontSize: 16 },

  avatarSection:     { alignItems: 'center', marginBottom: 32 },
  avatar:            { width: 88, height: 88, borderRadius: 44, marginBottom: 12, backgroundColor: t.border },
  avatarPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: t.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarInitials:    { fontSize: 32, fontWeight: '900', color: '#fff' },
  username:          { fontSize: 22, fontWeight: '900', color: t.textTitle, marginBottom: 12 },

  statsRow:          { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statItem:          { alignItems: 'center', paddingHorizontal: 20 },
  statCount:         { fontSize: 18, fontWeight: '900', color: t.textPrimary },
  statLabel:         { fontSize: 12, color: t.textMuted, marginTop: 2 },
  statDivider:       { width: 1, height: 28, backgroundColor: t.border },

  bio:               { fontSize: 14, color: t.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 280, marginBottom: 16 },

  followBtn:         { backgroundColor: t.accent, paddingHorizontal: 32, paddingVertical: 10, borderRadius: 100, minWidth: 120, alignItems: 'center' },
  followBtnText:     { color: '#fff', fontWeight: '700', fontSize: 15 },
  unfollowBtn:       { borderWidth: 1.5, borderColor: t.accent, paddingHorizontal: 32, paddingVertical: 10, borderRadius: 100, minWidth: 120, alignItems: 'center' },
  unfollowBtnText:   { color: t.accent, fontWeight: '700', fontSize: 15 },

  sectionLabel:      { fontSize: 12, fontWeight: '800', color: t.textMuted, letterSpacing: 1, marginBottom: 12 },
  groupSection:      { marginBottom: 20 },
  groupLabel:        { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  card:              { backgroundColor: t.surface, borderRadius: 20, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  row:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14 },
  rowBorder:         { borderBottomWidth: 1, borderBottomColor: t.border },
  plantName:         { fontSize: 15, fontWeight: '700', color: t.textPrimary, flex: 1 },
  rating:            { fontSize: 13, color: t.accent },
  emptyCard:         { backgroundColor: t.surface, borderRadius: 20, padding: 24, alignItems: 'center' },
  emptyText:         { color: t.textMuted, fontSize: 15 },
  errorText:         { fontSize: 16, color: t.textSecondary, textAlign: 'center', marginBottom: 8 },
});
