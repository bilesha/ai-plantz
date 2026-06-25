const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export type PlantSearchResult = {
  id: number;
  commonName: string | null;
  scientificName: string;
  imageUrl: string | null;
};

export async function searchPlants(query: string): Promise<{ results: PlantSearchResult[] }> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/plant-search?q=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error("API error:", err);
    throw err;
  }
}
