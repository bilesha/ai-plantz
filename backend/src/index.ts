import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  console.error("FATAL: GEMINI_API_KEY environment variable is required");
  process.exit(1);
}

const app = express();

app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 5000;

// --- Provider clients ---

const geminiModel = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({
  model: "gemini-2.0-flash",
});

const groqClient = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

// OpenAI-compatible provider config
const OPENAI_COMPAT_PROVIDERS = {
  deepseek: {
    baseURL: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    apiKey: process.env.DEEPSEEK_API_KEY ?? null,
  },
  qwen: {
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    apiKey: process.env.QWEN_API_KEY ?? null,
  },
  moonshot: {
    baseURL: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-8k",
    apiKey: process.env.MOONSHOT_API_KEY ?? null,
  },
} as const;

type Provider = "gemini" | "groq" | "deepseek" | "qwen" | "moonshot";

const VALID_PROVIDERS = new Set<string>(["gemini", "groq", "deepseek", "qwen", "moonshot"]);

// --- Rate limiter ---

const plantTipsLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// --- Routes ---

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// --- Shared prompt ---

const PLANT_TIPS_PROMPT = (plantName: string) => `
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

// --- Provider fetch functions ---

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} request timed out`)), ms)
    ),
  ]);
}

async function fetchFromGemini(plantName: string): Promise<string> {
  const result = await withTimeout(
    geminiModel.generateContent(PLANT_TIPS_PROMPT(plantName)),
    10_000,
    "Gemini"
  );
  return result.response.text();
}

async function fetchFromGroq(plantName: string): Promise<string> {
  if (!groqClient) throw new Error("GROQ_API_KEY is not configured");
  const completion = await withTimeout(
    groqClient.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: PLANT_TIPS_PROMPT(plantName) }],
      response_format: { type: "json_object" },
    }),
    10_000,
    "Groq"
  );
  return completion.choices[0]?.message?.content ?? "";
}

async function fetchFromOpenAICompatible(
  plantName: string,
  provider: keyof typeof OPENAI_COMPAT_PROVIDERS
): Promise<string> {
  const { baseURL, model, apiKey } = OPENAI_COMPAT_PROVIDERS[provider];
  if (!apiKey) throw new Error(`${provider.toUpperCase()}_API_KEY is not configured`);

  const fetchCall = fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: PLANT_TIPS_PROMPT(plantName) }],
      response_format: { type: "json_object" },
    }),
  }).then(async (r) => {
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      throw new Error(`${provider} API error ${r.status}: ${body}`);
    }
    const data = (await r.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content ?? "";
  });

  return withTimeout(fetchCall, 10_000, provider);
}

// --- Plant tips endpoint ---

app.post("/api/plant-tips", plantTipsLimiter, async (req, res) => {
  const { plantName, aiProvider = "gemini" } = req.body;

  if (!plantName || typeof plantName !== "string" || plantName.trim().length === 0) {
    return res.status(400).json({ error: "plantName is required" });
  }
  if (plantName.length > 100) {
    return res.status(400).json({ error: "plantName must be 100 characters or fewer" });
  }
  if (!VALID_PROVIDERS.has(aiProvider)) {
    return res.status(400).json({
      error: `aiProvider must be one of: ${[...VALID_PROVIDERS].join(", ")}`,
    });
  }

  const provider = aiProvider as Provider;
  let responseText = "";

  try {
    if (provider === "gemini") {
      responseText = await fetchFromGemini(plantName.trim());
    } else if (provider === "groq") {
      if (!groqClient) return res.status(503).json({ error: "Groq is not configured on this server" });
      responseText = await fetchFromGroq(plantName.trim());
    } else {
      const cfg = OPENAI_COMPAT_PROVIDERS[provider];
      if (!cfg.apiKey) {
        return res.status(503).json({ error: `${provider} is not configured on this server` });
      }
      responseText = await fetchFromOpenAICompatible(plantName.trim(), provider);
    }

    responseText = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();

    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch {
      console.error(`${provider} returned unparseable JSON:`, responseText);
      return res.status(502).json({ error: "AI service returned an invalid response" });
    }

    const r = parsedResponse as Record<string, unknown>;
    if (typeof r.summary !== "string" || typeof r.details !== "object" || r.details === null) {
      console.error(`${provider} response missing expected fields:`, parsedResponse);
      return res.status(502).json({ error: "AI service returned an unexpected response shape" });
    }

    res.json(parsedResponse);
  } catch (error) {
    console.error(`${provider} API error:`, error);
    res.status(500).json({ error: "Failed to fetch data from AI service." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
