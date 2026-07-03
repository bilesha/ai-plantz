export type IdentifyResult = {
  isPlant: boolean;
  plantName: string;
  scientificName: string;
  confidence: 'high' | 'medium' | 'low';
  description: string;
};

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

export async function identifyPlant({
  imageBase64,
  mimeType,
}: {
  imageBase64: string;
  mimeType: string;
}): Promise<IdentifyResult> {
  const response = await fetch(`${API_URL}/api/plant-identify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((body.error as string) ?? `Server error ${response.status}`);
  }

  return response.json() as Promise<IdentifyResult>;
}
