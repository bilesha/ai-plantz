import AsyncStorage from '@react-native-async-storage/async-storage';

export type CompareCategory = {
  label: string;
  plantA: string;
  plantB: string;
};

export type CompareResult = {
  summary: string;
  categories: CompareCategory[];
  verdict: string;
};

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

export async function comparePlants(plantA: string, plantB: string): Promise<CompareResult> {
  const stored = await AsyncStorage.getItem('ai_provider');
  const aiProvider = stored === 'groq' ? 'groq' : 'gemini';

  const response = await fetch(`${API_URL}/api/plant-compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plantA, plantB, aiProvider }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((body.error as string) ?? `Server error ${response.status}`);
  }

  return response.json() as Promise<CompareResult>;
}
