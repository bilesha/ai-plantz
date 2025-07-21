import { useState } from "react";
import { ActivityIndicator, Button, ScrollView, Text, TextInput, View } from "react-native";
import { styles } from "../styles/index.styles"; //
import { RANDOM_PLANTS } from "../constants/plants";
import {fetchPlantCareTips} from "../api/geminiai"

console.log("✅ App loaded!");

export default function Index() {
  const [plant, setPlant] = useState("");
  const [tips, setTips] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetTips = async () => {
    setLoading(true);
    setError(null);
    setTips("");
    try {
      const careTips = await fetchPlantCareTips(plant);
      setTips(careTips);
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleRandomPlant = () => {
    const randomIndex = Math.floor(Math.random() * RANDOM_PLANTS.length);
    const randomPlant = RANDOM_PLANTS[randomIndex];
    setPlant(randomPlant);
    setTips("");
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🌿 AI Plant Assistant</Text>
      <TextInput
        placeholder="Enter plant name (e.g., Monstera)"
        style={styles.input}
        value={plant}
        onChangeText={setPlant}
      />
      <View style ={styles.buttonSpacing}>
        <Button title="Get Care Tips" onPress={handleGetTips} disabled={!plant} />
      </View>
      
      <View style ={styles.buttonSpacing}>
        <Button title="Random Plant" onPress={handleRandomPlant}/>
      </View>

      {/* Loading spinner */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      )}

      {/* Error message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Tips text */}
      {tips ? <Text style={styles.tips}>{tips}</Text> : null}
    </ScrollView>
  );
}

