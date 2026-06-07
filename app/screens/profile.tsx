import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
import ScreenLayout from '../../components/ScreenLayout';
import { supabase } from '../../lib/supabase';
import { getFollowerCount, getFollowingCount } from '../../logic/followLogic';
import { getCollection } from '../../logic/collectionLogic';
import { getUnreadCount } from '../../logic/notificationLogic';
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

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

  const [email, setEmail]             = useState('');
  const [profile, setProfile]         = useState<ProfileData | null>(null);
  const [collection, setCollection]   = useState<CollectionEntry[]>([]);
  const [followerCount, setFollowerCount]   = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [avatarError, setAvatarError] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/screens/auth'); return; }

      setEmail(user.email ?? '');

      const [profileRes, collectionData, followers, following, unread] = await Promise.all([
        supabase.from('profiles').select('username, bio, avatar_url').eq('id', user.id).maybeSingle(),
        getCollection(),
        getFollowerCount(user.id),
        getFollowingCount(user.id),
        getUnreadCount(),
      ]);

      if (profileRes.error) throw profileRes.error;
      setProfile(profileRes.data ?? { username: null, bio: null, avatar_url: null });
      setCollection(collectionData);
      setFollowerCount(followers);
      setFollowingCount(following);
      setUnreadCount(unread);
      setAvatarError(false);
    } catch {
      setError('Could not load profile.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadProfile(); }, []));

  const displayName = profile?.username || email;
  const showImage   = !avatarError && !!profile?.avatar_url?.startsWith('http');

  if (loading) {
    return (
      <ScreenLayout>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </ScreenLayout>
    );
  }

  if (error) {
    return (
      <ScreenLayout>
        <View style={s.centered}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadProfile} style={s.retryBtn}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.headerRow}>
        <Text style={s.title}>Profile</Text>
        <TouchableOpacity
          style={s.bellBtn}
          onPress={() => router.push('/screens/notifications')}
        >
          <Text style={s.bellIcon}>🔔</Text>
          {unreadCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

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

        <Text style={s.username}>{profile?.username || 'Plant Lover'}</Text>
        <Text style={s.emailLabel}>{email}</Text>

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
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statCount}>{collection.length}</Text>
            <Text style={s.statLabel}>Plants</Text>
          </View>
        </View>

        {profile?.bio ? <Text style={s.bio}>{profile.bio}</Text> : null}

        <TouchableOpacity
          style={s.editBtn}
          onPress={() => router.push('/screens/editProfile')}
          activeOpacity={0.85}
        >
          <Text style={s.editBtnText}>Edit Profile</Text>
        </TouchableOpacity>
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
    </ScreenLayout>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container:         { flex: 1, backgroundColor: t.background },
  content:           { padding: 24, paddingTop: 60, paddingBottom: 80 },
  centered:          { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.background, padding: 32 },

  headerRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  title:             { fontSize: 28, fontWeight: '900', color: t.textTitle },
  bellBtn:           { padding: 6 },
  bellIcon:          { fontSize: 22 },
  badge:             { position: 'absolute', top: 0, right: 0, backgroundColor: '#ef4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText:         { color: '#fff', fontSize: 10, fontWeight: '800' },

  avatarSection:     { alignItems: 'center', marginBottom: 32 },
  avatar:            { width: 88, height: 88, borderRadius: 44, marginBottom: 12, backgroundColor: t.border },
  avatarPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: t.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarInitials:    { fontSize: 32, fontWeight: '900', color: '#fff' },
  username:          { fontSize: 22, fontWeight: '900', color: t.textTitle, marginBottom: 4 },
  emailLabel:        { fontSize: 14, color: t.textMuted, marginBottom: 12 },

  statsRow:          { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statItem:          { alignItems: 'center', paddingHorizontal: 20 },
  statCount:         { fontSize: 18, fontWeight: '900', color: t.textPrimary },
  statLabel:         { fontSize: 12, color: t.textMuted, marginTop: 2 },
  statDivider:       { width: 1, height: 28, backgroundColor: t.border },

  bio:               { fontSize: 14, color: t.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 280, marginBottom: 16 },

  editBtn:           { backgroundColor: t.accent, paddingHorizontal: 32, paddingVertical: 10, borderRadius: 100, minWidth: 160, alignItems: 'center', marginTop: 8 },
  editBtnText:       { color: '#fff', fontWeight: '700', fontSize: 15 },

  errorText:         { fontSize: 16, color: t.textSecondary, textAlign: 'center', marginBottom: 8 },
  retryBtn:          { marginTop: 16 },
  retryText:         { color: t.accent, fontWeight: '700', fontSize: 16 },

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
});
