import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
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
import { getCollection, getCollectionStats, type CollectionStats } from '../../logic/collectionLogic';
import { getDeathLog } from '../../logic/deathLogLogic';
import { getProfileStats, uploadAvatar, updateBio } from '../../logic/profileLogic';
import { getUnreadCount } from '../../logic/notificationLogic';
import StreakBadge from '../../components/StreakBadge';
import BadgesSection from '../../components/BadgesSection';
import { useToast } from '../../context/ToastContext';
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
  const { showToast } = useToast();

  const [userId, setUserId]                   = useState<string | null>(null);
  const [email, setEmail]                     = useState('');
  const [profile, setProfile]                 = useState<ProfileData | null>(null);
  const [collection, setCollection]           = useState<CollectionEntry[]>([]);
  const [followerCount, setFollowerCount]     = useState(0);
  const [followingCount, setFollowingCount]   = useState(0);
  const [likesReceived, setLikesReceived]     = useState(0);
  const [avatarError, setAvatarError]         = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState<string | null>(null);
  const [unreadCount, setUnreadCount]         = useState(0);
  const [collectionStats, setCollectionStats] = useState<CollectionStats>({ own: 0, want: 0, tried: 0 });
  const [deathCount, setDeathCount]           = useState(0);
  const [showBioModal, setShowBioModal]       = useState(false);
  const [draftBio, setDraftBio]               = useState('');

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/screens/auth'); return; }

      setEmail(user.email ?? '');
      setUserId(user.id);

      const [profileRes, collectionData, stats, unread, cStats, deaths] = await Promise.all([
        supabase.from('profiles').select('username, bio, avatar_url').eq('id', user.id).maybeSingle(),
        getCollection(),
        getProfileStats(user.id),
        getUnreadCount(),
        getCollectionStats(user.id),
        getDeathLog(),
      ]);

      if (profileRes.error) throw profileRes.error;
      setProfile(profileRes.data ?? { username: null, bio: null, avatar_url: null });
      setCollection(collectionData);
      setFollowerCount(stats.followerCount);
      setFollowingCount(stats.followingCount);
      setLikesReceived(stats.likesReceived);
      setUnreadCount(unread);
      setCollectionStats(cStats);
      setDeathCount(deaths.length);
      setAvatarError(false);
    } catch {
      setError('Could not load profile.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadProfile(); }, []));

  const handlePickAvatar = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setAvatarUploading(true);
    try {
      const url = await uploadAvatar(result.assets[0].uri);
      setProfile(prev => prev ? { ...prev, avatar_url: url } : null);
      setAvatarError(false);
      showToast('Avatar updated!', 'success');
    } catch {
      showToast('Upload failed', 'error');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSaveBio = async () => {
    try {
      await updateBio(draftBio);
      setProfile(prev => prev ? { ...prev, bio: draftBio } : null);
      setShowBioModal(false);
      showToast('Bio updated!', 'success');
    } catch {
      showToast('Could not update bio', 'error');
    }
  };

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
          <TouchableOpacity testID="profile-retry-button" onPress={loadProfile} style={s.retryBtn}>
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
            testID="profile-notifications-button"
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
          <TouchableOpacity testID="profile-avatar-button" onPress={handlePickAvatar} disabled={avatarUploading} style={s.avatarWrapper}>
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
            {avatarUploading ? (
              <View style={s.avatarOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <View style={s.avatarEditPill}>
                <View style={s.avatarEditPillInner}>
                  <Text style={s.avatarEditText}>Edit</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>

          <Text style={s.username}>{profile?.username || 'Plant Lover'}</Text>
          <Text style={s.emailLabel}>{email}</Text>
          <StreakBadge />

          <View style={s.statsRow}>
            <TouchableOpacity
              testID="profile-followers-button"
              style={s.statItem}
              onPress={() => userId && router.push({
                pathname: '/screens/followersList',
                params: { userId, type: 'followers', username: displayName },
              })}
            >
              <Text style={s.statCount}>{followerCount}</Text>
              <Text style={s.statLabel}>Followers</Text>
            </TouchableOpacity>
            <View style={s.statDivider} />
            <TouchableOpacity
              testID="profile-following-button"
              style={s.statItem}
              onPress={() => userId && router.push({
                pathname: '/screens/followersList',
                params: { userId, type: 'following', username: displayName },
              })}
            >
              <Text style={s.statCount}>{followingCount}</Text>
              <Text style={s.statLabel}>Following</Text>
            </TouchableOpacity>
            <View style={s.statDivider} />
            <View testID="profile-plants-stat" style={s.statItem}>
              <Text style={s.statCount}>{collection.length}</Text>
              <Text style={s.statLabel}>Plants</Text>
            </View>
            <View style={s.statDivider} />
            <View testID="profile-likes-stat" style={s.statItem}>
              <Text style={s.statCount}>{likesReceived}</Text>
              <Text style={s.statLabel}>Likes</Text>
            </View>
          </View>

          <View style={s.collectionStatsRow}>
            <View testID="profile-stat-owned" style={[s.collectionStatPill, { borderColor: STATUS_COLORS.own }]}>
              <Text style={[s.collectionStatNum, { color: STATUS_COLORS.own }]}>{collectionStats.own}</Text>
              <Text style={[s.collectionStatLabel, { color: STATUS_COLORS.own }]}>🌿 Owned</Text>
            </View>
            <View testID="profile-stat-wanted" style={[s.collectionStatPill, { borderColor: STATUS_COLORS.want }]}>
              <Text style={[s.collectionStatNum, { color: STATUS_COLORS.want }]}>{collectionStats.want}</Text>
              <Text style={[s.collectionStatLabel, { color: STATUS_COLORS.want }]}>✨ Wanted</Text>
            </View>
            <View testID="profile-stat-tried" style={[s.collectionStatPill, { borderColor: STATUS_COLORS.tried }]}>
              <Text style={[s.collectionStatNum, { color: STATUS_COLORS.tried }]}>{collectionStats.tried}</Text>
              <Text style={[s.collectionStatLabel, { color: STATUS_COLORS.tried }]}>🌱 Tried</Text>
            </View>
            <View testID="profile-stat-lost" style={[s.collectionStatPill, { borderColor: '#ef4444' }]}>
              <Text style={[s.collectionStatNum, { color: '#ef4444' }]}>{deathCount}</Text>
              <Text style={[s.collectionStatLabel, { color: '#ef4444' }]}>☠️ Lost</Text>
            </View>
          </View>

          {userId && <BadgesSection userId={userId} />}

          <View style={s.bioRow}>
            {profile?.bio ? <Text style={s.bio}>{profile.bio}</Text> : null}
            <TouchableOpacity testID="profile-edit-bio-button" onPress={() => { setDraftBio(profile?.bio ?? ''); setShowBioModal(true); }}>
              <Text style={s.editBioLink}>{profile?.bio ? '✏ Edit bio' : '+ Add bio'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            testID="profile-edit-profile-button"
            style={s.editBtn}
            onPress={() => router.push('/screens/editProfile')}
            activeOpacity={0.85}
          >
            <Text style={s.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <Text testID="profile-collection-label" style={s.sectionLabel}>COLLECTION</Text>

        {collection.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>No plants in collection yet.</Text>
          </View>
        ) : (
          STATUS_GROUPS.map(({ status, label }) => {
            const group = collection.filter(e => e.status === status);
            if (group.length === 0) return null;
            return (
              <View key={status} testID={`profile-collection-group-${status}`} style={s.groupSection}>
                <Text style={[s.groupLabel, { color: STATUS_COLORS[status] }]}>
                  {label.toUpperCase()} · {group.length}
                </Text>
                <View style={s.card}>
                  {group.map((entry, i) => (
                    <View
                      key={entry.name}
                      testID={`profile-plant-row-${entry.name}`}
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

      <Modal testID="profile-bio-modal" visible={showBioModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Edit Bio</Text>
            <TextInput
              testID="profile-bio-input"
              style={s.bioInput}
              value={draftBio}
              onChangeText={t => setDraftBio(t.slice(0, 150))}
              multiline
              maxLength={150}
              placeholder="Tell people about yourself..."
              placeholderTextColor={theme.textMuted}
              autoFocus
            />
            <Text style={s.charCounter}>{draftBio.length}/150</Text>
            <View style={s.modalBtns}>
              <TouchableOpacity testID="profile-bio-modal-cancel" style={s.modalCancel} onPress={() => setShowBioModal(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="profile-bio-modal-save" style={s.modalSave} onPress={handleSaveBio}>
                <Text style={s.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container:          { flex: 1, backgroundColor: t.background },
  content:            { padding: 24, paddingTop: 60, paddingBottom: 80 },
  centered:           { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.background, padding: 32 },

  headerRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  title:              { fontSize: 28, fontWeight: '900', color: t.textTitle },
  bellBtn:            { padding: 6 },
  bellIcon:           { fontSize: 22 },
  badge:              { position: 'absolute', top: 0, right: 0, backgroundColor: '#ef4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText:          { color: '#fff', fontSize: 10, fontWeight: '800' },

  avatarSection:      { alignItems: 'center', marginBottom: 32 },
  avatarWrapper:      { width: 88, height: 88, borderRadius: 44, marginBottom: 20 },
  avatar:             { width: 88, height: 88, borderRadius: 44, backgroundColor: t.border },
  avatarPlaceholder:  { width: 88, height: 88, borderRadius: 44, backgroundColor: t.accent, justifyContent: 'center', alignItems: 'center' },
  avatarInitials:     { fontSize: 32, fontWeight: '900', color: '#fff' },
  avatarOverlay:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 44, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  avatarEditPill:     { position: 'absolute', bottom: -12, left: 0, right: 0, alignItems: 'center' },
  avatarEditPillInner:{ backgroundColor: t.accent, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100 },
  avatarEditText:     { color: '#fff', fontSize: 11, fontWeight: '700' },

  username:           { fontSize: 22, fontWeight: '900', color: t.textTitle, marginBottom: 4 },
  emailLabel:         { fontSize: 14, color: t.textMuted, marginBottom: 12 },

  statsRow:           { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statItem:           { alignItems: 'center', paddingHorizontal: 14 },
  statCount:          { fontSize: 18, fontWeight: '900', color: t.textPrimary },
  statLabel:          { fontSize: 12, color: t.textMuted, marginTop: 2 },
  statDivider:        { width: 1, height: 28, backgroundColor: t.border },

  collectionStatsRow:  { flexDirection: 'row', gap: 8, marginBottom: 16, marginTop: 4 },
  collectionStatPill:  { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 16, borderWidth: 1.5, backgroundColor: t.surface },
  collectionStatNum:   { fontSize: 18, fontWeight: '900' },
  collectionStatLabel: { fontSize: 11, fontWeight: '700', marginTop: 2 },

  bioRow:             { alignItems: 'center', marginBottom: 8 },
  bio:                { fontSize: 14, color: t.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 280, marginBottom: 6 },
  editBioLink:        { fontSize: 13, color: t.accent, fontWeight: '600' },

  editBtn:            { backgroundColor: t.accent, paddingHorizontal: 32, paddingVertical: 10, borderRadius: 100, minWidth: 160, alignItems: 'center', marginTop: 12 },
  editBtnText:        { color: '#fff', fontWeight: '700', fontSize: 15 },

  errorText:          { fontSize: 16, color: t.textSecondary, textAlign: 'center', marginBottom: 8 },
  retryBtn:           { marginTop: 16 },
  retryText:          { color: t.accent, fontWeight: '700', fontSize: 16 },

  sectionLabel:       { fontSize: 12, fontWeight: '800', color: t.textMuted, letterSpacing: 1, marginBottom: 12 },
  groupSection:       { marginBottom: 20 },
  groupLabel:         { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  card:               { backgroundColor: t.surface, borderRadius: 20, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  row:                { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14 },
  rowBorder:          { borderBottomWidth: 1, borderBottomColor: t.border },
  plantName:          { fontSize: 15, fontWeight: '700', color: t.textPrimary, flex: 1 },
  rating:             { fontSize: 13, color: t.accent },
  emptyCard:          { backgroundColor: t.surface, borderRadius: 20, padding: 24, alignItems: 'center' },
  emptyText:          { color: t.textMuted, fontSize: 15 },

  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard:          { backgroundColor: t.surface, borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 },
  modalTitle:         { fontSize: 18, fontWeight: '800', color: t.textTitle, marginBottom: 16 },
  bioInput:           { backgroundColor: t.background, borderWidth: 1.5, borderColor: t.border, borderRadius: 14, padding: 14, fontSize: 15, color: t.textPrimary, minHeight: 100, textAlignVertical: 'top', marginBottom: 8 },
  charCounter:        { fontSize: 12, color: t.textMuted, textAlign: 'right', marginBottom: 16 },
  modalBtns:          { flexDirection: 'row', gap: 12 },
  modalCancel:        { flex: 1, paddingVertical: 12, borderRadius: 100, borderWidth: 1.5, borderColor: t.border, alignItems: 'center' },
  modalCancelText:    { color: t.textSecondary, fontWeight: '700', fontSize: 15 },
  modalSave:          { flex: 1, paddingVertical: 12, borderRadius: 100, backgroundColor: t.accent, alignItems: 'center' },
  modalSaveText:      { color: '#fff', fontWeight: '700', fontSize: 15 },
});
