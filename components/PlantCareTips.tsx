import  styles  from "../styles/PlantCareTips.styles";
import React from "react";
import { Text, View, ActivityIndicator } from "react-native";


interface PlantCareTipsProps {
  tips: string;
  loading: boolean;
  error: string | null;
}

export default function PlantCareTips({ tips, loading, error }: PlantCareTipsProps) {
  if (loading) {
    return (
      <View style={styles.wrapper}>
        <ActivityIndicator size="large" color="#2a6f2a" />
        <Text style={styles.loadingText}>Loading care tips...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.wrapper}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!tips) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.detailText}>{tips}</Text>
    </View>
  );
}