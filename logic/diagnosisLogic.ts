import { Platform } from 'react-native';

export type DiagnosisResult = {
  healthy: boolean;
  issues: string[];
  diagnosis: string;
  recommendations: string[];
};

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

export async function diagnosePlant({
  imageBase64,
  mimeType,
  plantName,
}: {
  imageBase64: string;
  mimeType: string;
  plantName?: string;
}): Promise<DiagnosisResult> {
  const response = await fetch(`${API_URL}/api/plant-diagnosis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType, plantName }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((body.error as string) ?? `Server error ${response.status}`);
  }

  return response.json() as Promise<DiagnosisResult>;
}
