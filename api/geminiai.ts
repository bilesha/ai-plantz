import Constants from 'expo-constants';

const GEMINI_API_KEY = Constants.expoConfig?.extra?.GEMINI_API_KEY;

console.log("🔑 GEMINI_API_KEY:", GEMINI_API_KEY ? "Loaded" : "Missing");

export async function fetchPlantCareTips(plantName: string): Promise<{ summary: string; details: string }> {
  try {
    console.log("🔍 Starting API call for plant:", plantName);
    console.log("🔑 GEMINI_API_KEY:", GEMINI_API_KEY ? "Loaded" : "Missing");

    if (!GEMINI_API_KEY) {
      throw new Error("Gemini API key is missing!");
    }

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
                text: `Give me detailed care tips for the plant named ${plantName}. Start with a short 1–2 sentence summary, then provide bullet-pointed care instructions.`,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini API.";

    const [summary, ...rest] = text.split("\n\n");
    const details = rest.join("\n\n").trim();

    return { summary: summary.trim(), details };
  } catch (error) {
    console.error("🔥 Error during fetchPlantCareTips:", error);
    throw error;
  }
}