import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export async function getPlantTips(plantName: string) {
  try {
    const aiProvider = (await AsyncStorage.getItem('ai_provider')) ?? 'gemini';

    const response = await fetch(`${API_BASE_URL}/api/plant-tips`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plantName, aiProvider }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error("API error:", err);
    throw err;
  }
}
