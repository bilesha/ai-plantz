import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  View,
  TouchableOpacity,
} from "react-native";
// Let's use the robust utility function we created
import { getPlantTips } from "./utilities/fetchPlantTips";
import PlantCareTips from "../components/PlantCareTips";
import { RANDOM_PLANTS } from "../constants/plants";

export default function Index() {
  const router = useRouter();
  const [plant, setPlant] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetTips = async () => {
    if (!plant.trim()) return;
    setLoading(true);
    setError(null);
    setSummary("");
    try {
      // The API call returns { summary, details }, but we only need the summary here.
      const tips = await getPlantTips(plant);
      setSummary(tips.summary);
    } catch (err: any) {
      setError(err.message || "Failed to fetch tips");
    } finally {
      setLoading(false);
    }
  };

  const handleShowMore = () => {
    // Only pass the plant name. The details screen will fetch its own data.
    router.push({
      pathname: "/screens/PlantDetailsAiGenerated",
      params: { plantName: plant },
    });
  };

  const handleRandomPlant = () => {
    const randomPlant =
      RANDOM_PLANTS[Math.floor(Math.random() * RANDOM_PLANTS.length)];
    setPlant(randomPlant);
    setError(null);
    setSummary("");
  };

  return (
    <ScrollView
      className="flex-1 bg-green-50"
      contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }}
    >
      <Text className="text-3xl font-bold text-center mb-6 text-green-800">
        🌿 AI Plant Assistant
      </Text>

      <TextInput
        placeholder="Enter plant name (e.g., Monstera)"
        className="border border-green-300 rounded-lg px-4 py-3 mb-4 bg-white"
        value={plant}
        onChangeText={setPlant}
      />

      <View className="flex-row justify-between mb-4">
        <TouchableOpacity
          onPress={handleGetTips}
          disabled={!plant || loading}
          className={`flex-1 mr-2 py-3 rounded-lg ${
            !plant || loading ? "bg-green-200" : "bg-green-600"
          }`}
        >
          <Text className="text-center text-white font-semibold">
            Get Care Tips
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleRandomPlant}
          disabled={loading}
          className={`flex-1 ml-2 py-3 rounded-lg ${
            loading ? "bg-green-200" : "bg-green-500"
          }`}
        >
          <Text className="text-center text-white font-semibold">
            Random Plant
          </Text>
        </TouchableOpacity>
      </View>

      {/* The PlantCareTips component now handles showing the summary, loading, or error */}
      <PlantCareTips summary={summary} loading={loading} error={error} />

      {/* The "Show More" button appears only when we have a summary */}
      {summary && !loading && (
        <View className="mt-4">
          <TouchableOpacity
            onPress={handleShowMore}
            className="bg-green-500 py-3 rounded-lg"
          >
            <Text className="text-white text-center font-semibold">
              Show More Details
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}