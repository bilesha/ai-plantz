import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';

export const CardSkeleton = () => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // 3 cards to match the 3 actual fields (watering, light, fertilizer)
  return (
    <View style={styles.container}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.card}>
          <Animated.View style={[styles.label, { opacity }]} />
          <Animated.View style={[styles.valueLine1, { opacity }]} />
          <Animated.View style={[styles.valueLine2, { opacity }]} />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 4 },
  // Mirrors real card style so the skeleton→content transition has no layout shift
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 5,
    borderLeftColor: '#d1fae5',
  },
  label: {
    height: 12,
    width: '30%',
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginBottom: 12,
  },
  // Two lines so the skeleton fills roughly the same height as real multi-line text
  valueLine1: {
    height: 16,
    width: '90%',
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginBottom: 8,
  },
  valueLine2: {
    height: 16,
    width: '65%',
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
  },
});
