import { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useTheme } from "../constants/theme";

type Props = {
  summary: string;
  loading: boolean;
  error: string | null;
};

export default function PlantCareTips({ summary, loading, error }: Props) {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (summary) {
      fadeAnim.setValue(0);
      slideAnim.setValue(12);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [summary]);

  if (loading) return null;

  if (error) {
    return (
      <Animated.View style={s.errorBox}>
        <Text style={s.errorText}>{error}</Text>
      </Animated.View>
    );
  }

  if (!summary) return null;

  return (
    <Animated.View style={[s.summaryBox, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={s.label}>AI Summary</Text>
      <Text style={s.summaryText}>"{summary}"</Text>
    </Animated.View>
  );
}

const styles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  errorBox:    { backgroundColor: t.errorBg, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: t.errorBorder },
  errorText:   { color: t.errorText, textAlign: 'center', fontWeight: '500' },
  summaryBox:  { backgroundColor: t.surfaceGreen, padding: 24, borderRadius: 24, borderWidth: 1, borderColor: t.borderGreen },
  label:       { color: t.textTitle, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  summaryText: { color: t.textPrimary, fontSize: 18, lineHeight: 28, fontWeight: '500' },
});
