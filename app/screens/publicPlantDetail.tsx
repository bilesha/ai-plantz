import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { supabase } from '../../lib/supabase';
import PlantSocialSection from '../../components/PlantSocialSection';

export default function PublicPlantDetailScreen() {
  const { plantOwnerUserId, plantName, summary } = useLocalSearchParams();
  const safePlantOwnerUserId = Array.isArray(plantOwnerUserId) ? plantOwnerUserId[0] : plantOwnerUserId;
  const safePlantName        = Array.isArray(plantName)        ? plantName[0]        : plantName;
  const safeSummary          = Array.isArray(summary)          ? summary[0]          : (summary ?? '');

  const router = useRouter();
  const theme  = useTheme();
  const s      = useMemo(() => styles(theme), [theme]);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading]     = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null);
      setAuthLoading(false);
    });
  }, []);

  if (!safePlantOwnerUserId || !safePlantName) {
    return (
      <View style={s.centered}>
        <Text style={s.errorText}>Plant not found.</Text>
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

      <Text style={s.plantName}>{safePlantName}</Text>

      {safeSummary ? (
        <View style={s.summaryCard}>
          <Text style={s.summaryText}>{safeSummary}</Text>
        </View>
      ) : null}

      <View style={s.divider} />

      {authLoading ? (
        <ActivityIndicator size="small" color={theme.accent} style={s.loader} />
      ) : (
        <PlantSocialSection
          plantOwnerUserId={safePlantOwnerUserId}
          plantName={safePlantName}
          currentUserId={currentUserId}
        />
      )}
    </ScrollView>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container:      { flex: 1, backgroundColor: t.background },
  content:        { padding: 24, paddingTop: 60, paddingBottom: 48 },
  centered:       { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.background, padding: 32 },
  backBtn:        { marginBottom: 24 },
  backBtnCentered:{ marginTop: 16 },
  backText:       { color: t.accent, fontWeight: '700', fontSize: 16 },
  plantName:      { fontSize: 32, fontWeight: '900', color: t.textHeading, marginBottom: 16 },
  summaryCard:    { backgroundColor: t.surface, borderRadius: 16, padding: 16, marginBottom: 8 },
  summaryText:    { fontSize: 15, color: t.textBody, lineHeight: 22 },
  divider:        { height: 1, backgroundColor: t.border, marginVertical: 20 },
  loader:         { marginTop: 24 },
  errorText:      { fontSize: 16, color: t.textSecondary, textAlign: 'center', marginBottom: 8 },
});
