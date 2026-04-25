import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../constants/theme';

export const CardSkeleton = () => {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={s.container}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={s.card}>
          <Animated.View style={[s.label, { opacity }]} />
          <Animated.View style={[s.valueLine1, { opacity }]} />
          <Animated.View style={[s.valueLine2, { opacity }]} />
        </View>
      ))}
    </View>
  );
};

const styles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  container:  { padding: 4 },
  card:       { backgroundColor: t.background, borderRadius: 24, padding: 20, marginBottom: 16, borderLeftWidth: 5, borderLeftColor: t.borderGreen },
  label:      { height: 12, width: '30%', backgroundColor: t.border, borderRadius: 4, marginBottom: 12 },
  valueLine1: { height: 16, width: '90%', backgroundColor: t.border, borderRadius: 4, marginBottom: 8 },
  valueLine2: { height: 16, width: '65%', backgroundColor: t.border, borderRadius: 4 },
});
