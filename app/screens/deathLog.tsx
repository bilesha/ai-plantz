import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme, type Theme } from '../../constants/theme';
import { useToast } from '../../context/ToastContext';
import { deleteDeathEntry, getDeathLog, type PlantDeathEntry } from '../../logic/deathLogLogic';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatOwnership(ownedSince: string, diedAt: string): string {
  const days = Math.round((new Date(diedAt).getTime() - new Date(ownedSince).getTime()) / 86400000);
  if (days < 1) return 'less than a day';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  const months = Math.round(days / 30.5);
  if (months === 1) return '1 month';
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} year${years > 1 ? 's' : ''}`;
  return `${years}y ${rem}m`;
}

export default function DeathLogScreen() {
  const router = useRouter();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const { showToast } = useToast();

  const [entries, setEntries] = useState<PlantDeathEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDeathLog()
      .then(setEntries)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = (id: string, plantName: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    deleteDeathEntry(id);
    showToast(`${plantName} removed from death log`, 'success');
  };

  return (
    <ScrollView
      testID="death-log-screen"
      style={s.container}
      contentContainerStyle={s.content}
    >
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/screens/settings')}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.title}>Death Log ☠️</Text>

      {loading ? (
        <ActivityIndicator color={theme.accent} style={s.loader} />
      ) : entries.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🌿</Text>
          <Text style={s.emptyText}>No losses yet — long may your plants live</Text>
        </View>
      ) : (
        entries.map(entry => (
          <View key={entry.id} style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.plantName}>{entry.plant_name}</Text>
              <TouchableOpacity
                onPress={() => handleDelete(entry.id, entry.plant_name)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={s.deleteBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.dateText}>Died {formatDate(entry.died_at)}</Text>

            <View style={s.causePill}>
              <Text style={s.causeText}>{entry.cause || 'Unknown cause'}</Text>
            </View>

            {entry.notes ? (
              <Text style={s.notesText}>{entry.notes}</Text>
            ) : null}

            {entry.owned_since ? (
              <Text style={s.ownedText}>
                Owned for {formatOwnership(entry.owned_since, entry.died_at)}
              </Text>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.background },
  content:   { padding: 24, paddingTop: 60, paddingBottom: 80 },
  topBar:    { marginBottom: 20 },
  backText:  { color: t.accent, fontWeight: '700', fontSize: 16 },
  title:     { fontSize: 28, fontWeight: '900', color: t.textTitle, marginBottom: 24 },
  loader:    { marginTop: 48 },

  empty:     { alignItems: 'center', marginTop: 64 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 16, color: t.textMuted, textAlign: 'center', lineHeight: 24 },

  card:       { backgroundColor: t.surface, borderRadius: 20, padding: 18, marginBottom: 14, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  plantName:  { fontSize: 18, fontWeight: '800', color: t.textPrimary, flex: 1 },
  deleteBtn:  { fontSize: 15, color: t.textMuted, paddingLeft: 12 },

  dateText:   { fontSize: 13, color: t.textMuted, marginBottom: 10 },

  causePill:  { alignSelf: 'flex-start', backgroundColor: t.background, borderWidth: 1, borderColor: t.border, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 10 },
  causeText:  { fontSize: 13, color: t.textSecondary, fontWeight: '600' },

  notesText:  { fontSize: 14, color: t.textBody, lineHeight: 20, marginBottom: 8 },
  ownedText:  { fontSize: 12, color: t.textMuted, fontStyle: 'italic' },
});
