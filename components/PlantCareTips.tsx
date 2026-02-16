import { View, Text, ActivityIndicator } from "react-native";

export default function PlantCareTips({ summary, loading, error }: any) {
  if (loading) return null; // We handle loader in the button now

  if (error) {
    return (
      <View className="bg-red-50 p-4 rounded-2xl border border-red-100">
        <Text className="text-red-600 text-center font-medium">{error}</Text>
      </View>
    );
  }

  if (!summary) return null;

  return (
    <View className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
      <Text className="text-emerald-900 text-xs font-bold uppercase tracking-tighter mb-2">AI Summary</Text>
      <Text className="text-slate-800 text-lg leading-7 font-medium">
        "{summary}"
      </Text>
    </View>
  );
}