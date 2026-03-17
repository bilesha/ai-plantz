import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Initialize the Google Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.post("/api/plant-tips", async (req, res) => {
  const { plantName } = req.body;

  if (!plantName) {
    return res.status(400).json({ error: "plantName is required" });
  }

  try {
    // This is a "prompt engineering" technique to get reliable JSON output
    const prompt = `
      Provide plant care information for a "${plantName}".
      Respond with a JSON object ONLY. Do not include any text, notes, or markdown formatting before or after the JSON.
      The JSON object must have two keys: "summary" and "details".
      - "summary": A short, engaging, one-sentence summary of care tips.
      - "details": An object containing specific care instructions for "watering", "light", and "fertilizer".
      
      Example response format:
      {
        "summary": "The Snake Plant is a resilient succulent that thrives on neglect.",
        "details": {
          "watering": "Water every 2-8 weeks, allowing the soil to dry out completely between waterings.",
          "light": "Prefers bright, indirect light but can tolerate low light conditions.",
          "fertilizer": "Does not require much fertilizer, but you can feed it a balanced houseplant fertilizer once or twice during the spring and summer."
        }
      }
    `;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text();

    // The AI response should be a clean JSON string, but sometimes includes markdown code blocks
    responseText = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
    
    const parsedResponse = JSON.parse(responseText);

    res.json(parsedResponse);
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    res.status(500).json({ error: "Failed to fetch data from AI service." });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});