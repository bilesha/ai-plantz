import Constants from 'expo-constants';

const OPENAI_API_KEY = Constants.expoConfig?.extra?.OPENAI_API_KEY;

export async function fetchPlantCareTips(plantName: string): Promise<string> {
  console.log("🔍 Starting API call for plant:", plantName);
  console.log("🔑 OPENAI_API_KEY:", OPENAI_API_KEY ? "Loaded" : "Missing");

  if (!OPENAI_API_KEY) {
    console.error("❌ OpenAI API key is missing!");
    throw new Error("OpenAI API key is missing!");
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `Give me detailed care tips for the plant named ${plantName}.`,
          },
        ],
        temperature: 0.7,
      }),
    });
    console.log("📡 Response status:", response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("🚨 API Error Response:", errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const data = await response.json();
    console.log("✅ Response Data:", data);

    return data.choices[0].message.content;
  } catch (error) {
    console.error("🔥 Error during fetchPlantCareTips:", error);
    throw error;
  }
}