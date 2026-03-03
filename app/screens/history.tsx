import { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

// 1. Keep this import (use 'import type' since it's a .tsx file)
import type { PlantEntry } from "../types"; 

export default function HistoryScreen() {
  const router = useRouter();
  // 2. DELETE the "type PlantEntry = { ... }" block that was here!
  // This removes the "conflicts with local declaration" error.

  const [history, setHistory] = useState<PlantEntry[]>([]);

  useEffect(() => {
    const loadHistory = async () => {
      // 3. Make sure you use the NEW key "plantHistory"
      const stored = await AsyncStorage.getItem("plantHistory");
      if (stored) setHistory(JSON.parse(stored));
    };
    loadHistory();
  }, []);

  const renderItem = ({ item }: { item: PlantEntry }) => (
    <TouchableOpacity 
      style={s.card}
      onPress={() => router.push({ 
        pathname: "/screens/PlantDetailsAiGenerated", 
        params: { plantName: item.name } 
      })}
    >
      <View style={s.cardContent}>
        <View style={s.textContainer}>
          <Text style={s.plantName}>{item.name}</Text>
          <Text numberOfLines={2} style={s.summaryText}>{item.summary}</Text>
        </View>
        {item.isFavorite && <Text style={s.favIcon}>⭐</Text>}
      </View>
      <Text style={s.dateText}>
        Viewed {new Date(item.lastViewed).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  const toggleFavorite = async (plantName: string) => {
  // Map through history and flip the favorite status for the matching name
  const updatedHistory = history.map((item) => {
    if (item.name === plantName) {
      return { ...item, isFavorite: !item.isFavorite };
    }
    return item;
  });

  // Update the local state so the UI changes immediately
  setHistory(updatedHistory);

  // Save the updated list to AsyncStorage
  await AsyncStorage.setItem("plantHistory", JSON.stringify(updatedHistory));
};

  return (
    <View style={s.container}>
      <Text style={s.title}>Search History</Text>
      
      {history.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyText}>No plants searched yet! 🪴</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.name}
          renderItem={renderItem}
          contentContainerStyle={s.listPadding}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", paddingHorizontal: 20, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: "900", color: "#064e3b", marginBottom: 20 },
  listPadding: { paddingBottom: 40 },
  card: { 
    backgroundColor: "white", 
    padding: 16, 
    borderRadius: 20, 
    marginBottom: 12, 
    elevation: 2, 
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 3 
  },
  cardContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  textContainer: { flex: 1, marginRight: 10 },
  plantName: { fontSize: 18, fontWeight: "700", color: "#1e293b", marginBottom: 4 },
  summaryText: { fontSize: 14, color: "#64748b", lineHeight: 20 },
  favIcon: { fontSize: 18 },
  dateText: { fontSize: 11, color: "#94a3b8", marginTop: 10, fontWeight: "600", textTransform: "uppercase" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "#94a3b8", fontSize: 16 }
});