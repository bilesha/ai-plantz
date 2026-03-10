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

  // Create 4-5 skeleton cards to fill the screen
  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.card}>
          <Animated.View style={[styles.label, { opacity }]} />
          <Animated.View style={[styles.value, { opacity }]} />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  card: { 
    backgroundColor: 'white', 
    borderRadius: 20, 
    padding: 16, 
    marginBottom: 12, 
    elevation: 2 
  },
  label: { 
    height: 14, 
    width: '30%', 
    backgroundColor: '#e2e8f0', 
    borderRadius: 4, 
    marginBottom: 8 
  },
  value: { 
    height: 18, 
    width: '90%', 
    backgroundColor: '#f1f5f9', 
    borderRadius: 4 
  },
});