import { useRouter } from 'expo-router';
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
import { getNotifications, markAllRead, type NotificationItem } from '../../logic/notificationLogic';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const data = await getNotifications();
      setItems(data);
      setLoading(false);
      await markAllRead();
    })();
  }, []);

  return (
    <View style={s.container}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Notifications</Text>
        <View style={s.topBarSpacer} />
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : items.length === 0 ? (
        <View style={s.centered}>
          <Text style={s.emptyIcon}>🔔</Text>
          <Text style={s.emptyTitle}>No notifications yet</Text>
          <Text style={s.emptyBody}>When someone follows you, it'll show up here.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={s.listContent}
          renderItem={({ item }) => (
            <View style={s.row}>
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={s.avatar} />
              ) : (
                <View style={s.avatarPlaceholder}>
                  <Text style={s.avatarEmoji}>🪴</Text>
                </View>
              )}
              <View style={s.rowText}>
                <Text style={s.rowMessage}>
                  <Text style={s.rowUsername}>{item.username ?? 'Someone'}</Text>
                  <Text>{' started following you'}</Text>
                </Text>
                <Text style={s.rowTime}>{relativeTime(item.created_at)}</Text>
              </View>
              {!item.read && <View style={s.unreadDot} />}
            </View>
          )}
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container:       { flex: 1, backgroundColor: t.background },
  topBar:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, backgroundColor: t.surface, borderBottomWidth: 1, borderBottomColor: t.border },
  backBtn:         { paddingRight: 12 },
  backText:        { color: t.accent, fontWeight: '700', fontSize: 16 },
  title:           { flex: 1, fontSize: 18, fontWeight: '800', color: t.textTitle, textAlign: 'center' },
  topBarSpacer:    { width: 60 },
  centered:        { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon:       { fontSize: 48, marginBottom: 12 },
  emptyTitle:      { fontSize: 18, fontWeight: '800', color: t.textTitle, marginBottom: 8 },
  emptyBody:       { fontSize: 14, color: t.textSecondary, textAlign: 'center', lineHeight: 20 },
  listContent:     { paddingBottom: 40 },
  row:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: t.surface },
  avatar:          { width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: t.border },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: t.surfaceGreenSubtle, justifyContent: 'center', alignItems: 'center' },
  avatarEmoji:     { fontSize: 20 },
  rowText:         { flex: 1 },
  rowMessage:      { fontSize: 15, color: t.textPrimary, lineHeight: 20, marginBottom: 3 },
  rowUsername:     { fontWeight: '700', color: t.textPrimary },
  rowTime:         { fontSize: 12, color: t.textMuted },
  unreadDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: t.accent, marginLeft: 10 },
  separator:       { height: 1, backgroundColor: t.border, marginLeft: 76 },
});
