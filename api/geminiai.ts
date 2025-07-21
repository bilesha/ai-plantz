import Constants from 'expo-constants';

const GEMINI_API_KEY = Constants.expoConfig?.extra?.GEMINI_API_KEY;

console.log("🔑 GEMINI_API_KEY:", GEMINI_API_KEY ? "Loaded" : "Missing");

export async function fetchPlantCareTips(plantName: string): Promise<string> {
  console.log("🔍 Starting API call for plant:", plantName);
  console.log("🔑 GEMINI_API_KEY:", GEMINI_API_KEY ? "Loaded" : "Missing");

  if (!GEMINI_API_KEY) {
    console.error("❌ Gemini API key is missing!");
    throw new Error("Gemini API key is missing!");
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Give me detailed care tips for the plant named ${plantName}.`,
              },
            ],
          },
        ],
      }),
    });

    console.log("📡 Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("🚨 Gemini API Error Response:", errorText);
      throw new Error(`Gemini API error: ${errorText}`);
    }

    const data = await response.json();
    console.log("✅ Gemini Response Data:", data);

    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No tips found.";
  } catch (error) {
    console.error("🔥 Error during fetchPlantCareTips:", error);
    throw error;
  }
}