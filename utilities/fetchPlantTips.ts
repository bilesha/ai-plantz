// utils/api.ts

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export async function getPlantTips(plantName: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/plant-tips`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plantName }),
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