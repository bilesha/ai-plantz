import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

// 1. Fail fast at startup if the API key is missing rather than crashing on the
//    first request with a cryptic message.
if (!process.env.GEMINI_API_KEY) {
  console.error("FATAL: GEMINI_API_KEY environment variable is required");
  process.exit(1);
}

const app = express();

// 7. Restrict CORS to the known frontend origin in production.
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || "http://localhost:8081" }));
app.use(express.json());

const PORT = process.env.PORT || 5000;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// 1. Rate limit: 10 requests per IP per minute to protect against Gemini bill abuse.
const plantTipsLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// Health check — used by load balancers and uptime monitors.
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/plant-tips", plantTipsLimiter, async (req, res) => {
  const { plantName } = req.body;

  // 3. Validate plantName type, presence, and length before it reaches Gemini.
  if (!plantName || typeof plantName !== "string" || plantName.trim().length === 0) {
    return res.status(400).json({ error: "plantName is required" });
  }
  if (plantName.length > 100) {
    return res.status(400).json({ error: "plantName must be 100 characters or fewer" });
  }

  const prompt = `
    Provide plant care information for a "${plantName.trim()}".
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

  let responseText = "";

  try {
    // 4. Race the Gemini call against a 10-second timeout so a hung API call
    //    doesn't hold the connection open indefinitely.
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Gemini request timed out")), 10_000)
    );

    const result = await Promise.race([model.generateContent(prompt), timeoutPromise]);
    responseText = result.response.text();
    responseText = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();

    // 5. JSON.parse throws SyntaxError — catch it separately from API errors so
    //    we can log the raw response and return a 502 (bad gateway) instead of 500.
    let parsedResponse: any;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch {
      console.error("Gemini returned unparseable JSON:", responseText);
      return res.status(502).json({ error: "AI service returned an invalid response" });
    }

    // 6. Confirm the parsed object has the shape the client expects before sending.
    if (
      typeof parsedResponse.summary !== "string" ||
      typeof parsedResponse.details !== "object" ||
      parsedResponse.details === null
    ) {
      console.error("Gemini response missing expected fields:", parsedResponse);
      return res.status(502).json({ error: "AI service returned an unexpected response shape" });
    }

    res.json(parsedResponse);
  } catch (error) {
    // 5. Everything else (network failure, timeout, SDK error) is a 500.
    console.error("Gemini API error:", error);
    res.status(500).json({ error: "Failed to fetch data from AI service." });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
