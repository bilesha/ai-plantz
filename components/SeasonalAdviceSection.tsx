import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, type Theme } from '../constants/theme';
import { getSeasonalAdvice, getSeasonEmoji, type SeasonalAdvice } from '../logic/seasonalAdviceLogic';
import type { PlantDetails } from '../types';

type Props = {
  plantDetails?: PlantDetails | null;
};

const SEASON_LABEL: Record<string, string> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
};

export default function SeasonalAdviceSection({ plantDetails }: Props) {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const router = useRouter();

  const [advice, setAdvice] = useState<SeasonalAdvice | null | undefined>(undefined);

  useEffect(() => {
    getSeasonalAdvice(plantDetails ?? undefined).then(setAdvice);
  }, []);

  if (advice === undefined) return null;

  if (advice === null) {
    return (
      <View testID="seasonal-advice-section" style={s.nudgeCard}>
        <Text style={s.nudgeText}>
          {'📍 Add your location in '}
          <Text
            style={s.nudgeLink}
            onPress={() => router.push('/screens/settings')}
          >
            Settings
          </Text>
          {' for seasonal care tips'}
        </Text>
      </View>
    );
  }

  const emoji = getSeasonEmoji(advice.season);
  const label = SEASON_LABEL[advice.season] ?? advice.season;
  const hemisphereLabel = advice.hemisphere === 'southern' ? '🌏 Southern Hemisphere' : '🌍 Northern Hemisphere';

  return (
    <View testID="seasonal-advice-section" style={s.card}>
      <View style={s.headerRow}>
        <View>
          <Text style={s.title}>{emoji} {label} Care Tips</Text>
          <Text style={s.subtitle}>Based on your location</Text>
        </View>
        <View style={s.hemispherePill}>
          <Text style={s.hemispherePillText}>{hemisphereLabel}</Text>
        </View>
      </View>

      {advice.weather && (
        <Text style={s.weatherRow}>
          {`🌡️ ${Math.round(advice.weather.temp)}°C · 💧 ${advice.weather.humidity}% · ${advice.weather.description.charAt(0).toUpperCase()}${advice.weather.description.slice(1)}`}
        </Text>
      )}

      <View style={s.adviceList}>
        {advice.advice.map((item, i) => (
          <View key={i} style={s.adviceRow}>
            <Text style={s.checkmark}>✓</Text>
            <Text style={s.adviceText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  nudgeCard:    { marginTop: 8, marginBottom: 8, backgroundColor: t.surface, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14, borderWidth: 1, borderColor: t.border },
  nudgeText:    { fontSize: 14, color: t.textMuted, lineHeight: 20 },
  nudgeLink:    { color: t.accent, fontWeight: '700' },

  card:         { marginTop: 8, marginBottom: 8, backgroundColor: t.background, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: t.border },
  headerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 },
  title:        { fontSize: 16, fontWeight: '800', color: t.textTitle },
  subtitle:     { fontSize: 12, color: t.textMuted, marginTop: 2 },

  hemispherePill:     { backgroundColor: t.surfaceGreenSubtle, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: t.accentMid, flexShrink: 1 },
  hemispherePillText: { fontSize: 11, fontWeight: '700', color: t.accentDark },

  weatherRow:   { fontSize: 13, color: t.textMuted, marginBottom: 14 },

  adviceList:   { gap: 10 },
  adviceRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkmark:    { fontSize: 14, color: t.accent, fontWeight: '700', marginTop: 1 },
  adviceText:   { flex: 1, fontSize: 14, color: t.textBody, lineHeight: 20 },
});
