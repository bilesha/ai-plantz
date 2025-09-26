import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { getPlantTips } from "../utilities/fetchPlantTips";

type PlantDetails = string | Record<string, string>;

export default function PlantDetailsAiGenerated() {
  const { plantName } = useLocalSearchParams();
  const [details, setDetails] = useState<PlantDetails>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!plantName) return;
      setLoading(true);
      setError(null);
      try {
        const data = await getPlantTips(plantName as string);
        setDetails(data.details);
      } catch (err: any) {
        setError(err.message || "Failed to load plant details.");
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [plantName]);

  return (
    <ScrollView
      className="flex-1 bg-green-50 p-6"
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <Text className="text-3xl font-bold text-green-800 mb-4">
        {plantName}
      </Text>

      {loading && (
        <View className="my-4 items-center">
          <ActivityIndicator size="large" color="#16a34a" />
          <Text className="text-green-800 mt-2 font-medium">
            Loading plant details...
          </Text>
        </View>
      )}

      {error && (
        <View className="my-4 p-3 bg-red-100 rounded">
          <Text className="text-red-600 font-medium">{error}</Text>
        </View>
      )}

      {!loading && !error && details && (
        <View className="my-4 p-4 bg-white rounded-lg shadow">
          {typeof details === "string" ? (
            <Text className="text-gray-800 text-base leading-relaxed">
              {details}
            </Text>
          ) : (
            Object.entries(details).map(([key, value]) => (
              <View key={key} className="mb-3">
                <Text className="text-lg font-semibold capitalize text-green-700">
                  {key}
                </Text>
                <Text className="text-gray-800 text-base leading-relaxed">
                  {value}
                </Text>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}