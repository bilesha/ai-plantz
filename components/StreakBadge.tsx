import { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme, type Theme } from '../constants/theme';
import { getStreakData, type StreakData } from '../logic/gamificationLogic';

function motivationalMessage(streak: number): string {
  if (streak === 0) return 'Start your streak by doing something today!';
  if (streak < 3)   return 'Great start — keep it going!';
  if (streak < 7)   return 'You\'re building momentum!';
  if (streak < 14)  return 'Impressive dedication! 🌿';
  if (streak < 30)  return 'You\'re on fire! 🔥';
  return 'Legendary plant parent! 🏆';
}

export default function StreakBadge() {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

  const [data, setData] = useState<StreakData>({ current_streak: 0, longest_streak: 0, last_activity_date: null });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getStreakData().then(setData).catch(() => {});
  }, []);

  if (data.current_streak === 0 && data.longest_streak === 0) return null;

  return (
    <>
      <TouchableOpacity style={s.chip} onPress={() => setOpen(true)} activeOpacity={0.75}>
        <Text style={s.chipText}>🔥 {data.current_streak}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={s.card}>
            <Text style={s.cardTitle}>Activity Streak</Text>

            <View style={s.statRow}>
              <View style={s.statBox}>
                <Text style={s.statNum}>{data.current_streak}</Text>
                <Text style={s.statLabel}>Current{'\n'}streak</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statBox}>
                <Text style={s.statNum}>{data.longest_streak}</Text>
                <Text style={s.statLabel}>Longest{'\n'}streak</Text>
              </View>
            </View>

            <Text style={s.message}>{motivationalMessage(data.current_streak)}</Text>

            <TouchableOpacity style={s.closeBtn} onPress={() => setOpen(false)}>
              <Text style={s.closeBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251,146,60,0.12)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.3)',
    alignSelf: 'center',
  },
  chipText: { fontSize: 14, fontWeight: '800', color: '#ea580c' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  card: { backgroundColor: t.surface, borderRadius: 24, padding: 24, width: '100%', maxWidth: 320, alignItems: 'center' },

  cardTitle: { fontSize: 18, fontWeight: '800', color: t.textTitle, marginBottom: 20 },

  statRow: { flexDirection: 'row', alignItems: 'center', gap: 0, marginBottom: 16, width: '100%' },
  statBox:  { flex: 1, alignItems: 'center' },
  statNum:  { fontSize: 36, fontWeight: '900', color: t.accent },
  statLabel:{ fontSize: 12, color: t.textMuted, textAlign: 'center', marginTop: 4, fontWeight: '600' },
  statDivider: { width: 1, height: 48, backgroundColor: t.border, marginHorizontal: 8 },

  message: { fontSize: 14, color: t.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },

  closeBtn: { backgroundColor: t.accent, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 11, alignSelf: 'stretch', alignItems: 'center' },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
