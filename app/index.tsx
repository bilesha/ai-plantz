import { useState } from "react";
import { Button, ScrollView, Text, TextInput, View } from "react-native";
import { fetchPlantCareTips } from "../api/geminiai";
import PlantCareTips from "../components/PlantCareTips";
import { RANDOM_PLANTS } from "../constants/plants";
import { styles } from "../styles/index.styles";
import { useRouter } from "expo-router";


export default function Index() {
  const [plant, setPlant] = useState("");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  const handleGetTips = async () => {
    setLoading(true);
    setError(null);
    setSummary("");
    setDetails("");
    try {
      const tips = await fetchPlantCareTips(plant); // returns { summary, details }
      setSummary(tips.summary);
      setDetails(tips.details);
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleShowMore = () => {
    try {
      router.push({
        pathname: "/screens/PlantDetailsAiGenerated",
        params: {
          plantName: plant,
          details: encodeURIComponent(details),
        },
      });
    } catch (error) {
      console.error("Navigation error:", error);
    }
  };
  
  const handleRandomPlant = () => {
    const randomPlant = RANDOM_PLANTS[Math.floor(Math.random() * RANDOM_PLANTS.length)];
    setPlant(randomPlant);
    setError(null);
    setSummary("");
    setDetails("");
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

      <View style={styles.buttonSpacing}>
        <Button title="Get Care Tips" onPress={handleGetTips} disabled={!plant || loading} />
      </View>

      <View style={styles.buttonSpacing}>
        <Button title="Random Plant" onPress={handleRandomPlant} disabled={loading} />
      </View>

      <PlantCareTips tips={summary} loading={loading} error={error} />

      {summary && (
        <View style={styles.buttonSpacing}>
          <Button title="Show More" onPress={handleShowMore} />
        </View>
      )}
    </ScrollView>
  );
}
