import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";

type Props = {
  summary: string;
  loading: boolean;
  error: string | null;
};

export default function PlantCareTips({ summary, loading, error }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade the summary card in each time a new summary arrives
  useEffect(() => {
    if (summary) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
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
    <Animated.View style={[s.summaryBox, { opacity: fadeAnim }]}>
      <Text style={s.label}>AI Summary</Text>
      <Text style={s.summaryText}>"{summary}"</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  errorBox: {
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  errorText: { color: '#dc2626', textAlign: 'center', fontWeight: '500' },
  summaryBox: {
    backgroundColor: '#ecfdf5',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  label: {
    color: '#064e3b',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  summaryText: { color: '#1e293b', fontSize: 18, lineHeight: 28, fontWeight: '500' },
});
