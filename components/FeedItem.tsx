import { useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, type Theme } from '../constants/theme';
import { formatActivityText, PLANT_ACTIVITY_TYPES, type FeedItem } from '../logic/feedLogic';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

type Props = { item: FeedItem };

export default function FeedItemRow({ item }: Props) {
  const router = useRouter();
  const theme  = useTheme();
  const s      = useMemo(() => styles(theme), [theme]);

  const isPlantActivity = PLANT_ACTIVITY_TYPES.includes(item.type);
  const isTappable =
    (item.type === 'follow' && !!item.target_user_id) ||
    (isPlantActivity && !!item.plant_name && !!item.plant_owner_id);

  const handlePress = () => {
    if (item.type === 'follow' && item.target_user_id) {
      router.push({
        pathname: '/screens/publicProfile',
        params: { userId: item.target_user_id },
      });
    } else if (isPlantActivity && item.plant_name && item.plant_owner_id) {
      router.push({
        pathname: '/screens/publicPlantDetail',
        params: {
          plantOwnerUserId: item.plant_owner_id,
          plantName: item.plant_name,
        },
      });
    }
  };

  return (
    <TouchableOpacity
      style={s.row}
      onPress={handlePress}
      disabled={!isTappable}
      activeOpacity={isTappable ? 0.7 : 1}
    >
      {item.avatar_url ? (
        <Image source={{ uri: item.avatar_url }} style={s.avatar} />
      ) : (
        <View style={s.avatarPlaceholder}>
          <Text style={s.avatarEmoji}>🪴</Text>
        </View>
      )}
      <View style={s.textArea}>
        <Text style={s.activityText} numberOfLines={2}>{formatActivityText(item)}</Text>
        <Text style={s.timeText}>{relativeTime(item.created_at)}</Text>
      </View>
      {isTappable && <Text style={s.chevron}>›</Text>}
    </TouchableOpacity>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  row:               { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  avatar:            { width: 36, height: 36, borderRadius: 18, backgroundColor: t.border, flexShrink: 0 },
  avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.surfaceGreenSubtle, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarEmoji:       { fontSize: 16 },
  textArea:          { flex: 1 },
  activityText:      { fontSize: 14, color: t.textSecondary, lineHeight: 19 },
  timeText:          { fontSize: 12, color: t.textMuted, marginTop: 2 },
  chevron:           { fontSize: 20, color: t.textMuted, marginLeft: 4 },
});
