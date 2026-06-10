import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme, type Theme } from '../constants/theme';
import { ALL_BADGES, getBadges, type EarnedBadge } from '../logic/gamificationLogic';

type Props = {
  userId?: string;
};

export default function BadgesSection({ userId }: Props) {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

  const [earned, setEarned] = useState<EarnedBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBadges(userId).then(setEarned).catch(() => {}).finally(() => setLoading(false));
  }, [userId]);

  const earnedMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of earned) m.set(b.badge_key, b.earned_at);
    return m;
  }, [earned]);

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>BADGES</Text>

      {loading ? (
        <ActivityIndicator size="small" color={theme.accent} style={{ marginVertical: 12 }} />
      ) : (
        <View style={s.grid}>
          {ALL_BADGES.map(badge => {
            const earnedAt = earnedMap.get(badge.key);
            const isEarned = !!earnedAt;
            return (
              <View key={badge.key} style={[s.badgeCard, !isEarned && s.badgeCardLocked]}>
                <Text style={[s.badgeEmoji, !isEarned && s.badgeEmojiLocked]}>
                  {isEarned ? badge.emoji : '🔒'}
                </Text>
                <Text style={[s.badgeName, !isEarned && s.badgeNameLocked]} numberOfLines={1}>
                  {badge.name}
                </Text>
                <Text style={s.badgeDesc} numberOfLines={2}>{badge.description}</Text>
                {isEarned && earnedAt && (
                  <Text style={s.earnedDate}>
                    {new Date(earnedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container: { marginTop: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: t.textMuted, letterSpacing: 1, marginBottom: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  badgeCard: {
    width: '47%',
    backgroundColor: t.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: t.borderGreen,
    alignItems: 'center',
    gap: 4,
  },
  badgeCardLocked: {
    backgroundColor: t.background,
    borderColor: t.border,
    opacity: 0.55,
  },

  badgeEmoji:       { fontSize: 28 },
  badgeEmojiLocked: { opacity: 0.4 },

  badgeName:       { fontSize: 13, fontWeight: '800', color: t.textTitle, textAlign: 'center' },
  badgeNameLocked: { color: t.textMuted },

  badgeDesc:  { fontSize: 11, color: t.textMuted, textAlign: 'center', lineHeight: 15 },
  earnedDate: { fontSize: 11, color: t.accent, fontWeight: '700', marginTop: 2 },
});
