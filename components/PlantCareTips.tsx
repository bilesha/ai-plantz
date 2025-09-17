import { View, Text, ActivityIndicator } from "react-native";

interface PlantCareTipsProps {
  summary: string;
  loading: boolean;
  error: string | null;
}

export default function PlantCareTips({ summary, loading, error }: PlantCareTipsProps) {
  if (loading) {
    return (
      <View className="my-4 items-center">
        <ActivityIndicator size="large" color="#16a34a" />
        <Text className="text-green-800 mt-2 font-medium">Loading care tips...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="my-4 p-3 bg-red-100 rounded">
        <Text className="text-red-600 font-medium">{error}</Text>
      </View>
    );
  }

  if (!summary) return null;

  return (
    <View className="my-4 p-4 bg-white rounded-lg shadow">
      <Text className="text-gray-800 text-base">{summary}</Text>
    </View>
  );
}
