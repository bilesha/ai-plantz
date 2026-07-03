import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";

dotenv.config();

const MOCK_MODE = process.env.MOCK_MODE === "true";

if (MOCK_MODE) {
  console.log("[mock] Mock mode enabled — AI calls disabled");
} else if (!process.env.GEMINI_API_KEY) {
  console.error("FATAL: GEMINI_API_KEY environment variable is required");
  process.exit(1);
}

const MOCK_PLANT_SEARCH_RESPONSE = {
  results: [
    { id: 1, commonName: "Mock Fern", scientificName: "Filicum mockus", imageUrl: null },
    { id: 2, commonName: "Test Succulent", scientificName: "Succula testus", imageUrl: null },
    { id: 3, commonName: null, scientificName: "Plantae fictus", imageUrl: null },
  ],
};

const MOCK_DIAGNOSIS_RESPONSE = {
  healthy: false,
  issues: ["Yellowing leaves", "Brown leaf tips"],
  diagnosis:
    "The plant shows signs of overwatering combined with low humidity. The yellowing is likely caused by root saturation, while brown tips indicate moisture stress from dry air.",
  recommendations: [
    "Allow the soil to dry out completely before next watering.",
    "Increase ambient humidity with a pebble tray or misting.",
    "Check roots for rot and trim any that are brown and mushy.",
    "Move to a spot with better air circulation.",
  ],
};

const MOCK_RESPONSE = {
  summary:
    "Mock Plant is a hardy, low-maintenance plant perfect for beginners. It thrives in a variety of conditions and requires minimal care.",
  details: {
    watering: "Water once a week, allowing soil to dry out between waterings.",
    light: "Tolerates low to bright indirect light.",
    fertilizer: "Feed monthly during growing season with a balanced liquid fertilizer.",
    careLevel: "easy",
    funFact:
      "Mock Plant is used in automated tests to ensure the app works correctly without hitting real AI providers.",
    toxicity: "Non-toxic to humans and pets.",
    seasonalCare: "Reduce watering in winter. Resume normal schedule in spring.",
    compatibility: "Gets along well with all other plants.",
    pairingPlants: "Pairs well with Test Fern and Dummy Succulent.",
    propagation: "Propagate by division in spring.",
    troubleshooting:
      "If leaves turn yellow, reduce watering. If growth is slow, increase light.",
  },
};

const app = express();

app.use(cors());
// 10mb limit: /api/plant-diagnosis receives base64-encoded photos in the JSON body
app.use(express.json({ limit: "10mb" }));

const PORT = Number(process.env.PORT) || 5000;

// --- Provider clients ---

const geminiModel = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "").getGenerativeModel({
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
  - "summary": A short, engaging, one-sentence summary of the plant.
  - "details": An object with the following fields:
    - "watering": Specific watering instructions.
    - "light": Light requirements.
    - "fertilizer": Fertilizer recommendations.
    - "careLevel": Exactly one of: "easy", "medium", or "hard".
    - "funFact": One interesting or surprising fact about the plant.
    - "toxicity": Whether it is safe or toxic, e.g. "Safe for pets and children" or "Toxic to cats and dogs".
    - "seasonalCare": How care changes between seasons.
    - "compatibility": How suitable this plant is for beginners versus experienced growers.
    - "pairingPlants": Plants that grow or look well alongside this one.
    - "propagation": How to propagate the plant.
    - "troubleshooting": Common problems and how to fix them (e.g. yellow leaves, drooping, root rot).

  Example response format:
  {
    "summary": "The Snake Plant is a resilient succulent that thrives on neglect.",
    "details": {
      "watering": "Water every 2-8 weeks, allowing the soil to dry out completely between waterings.",
      "light": "Prefers bright, indirect light but can tolerate low light conditions.",
      "fertilizer": "Feed with a balanced houseplant fertilizer once or twice during spring and summer.",
      "careLevel": "easy",
      "funFact": "Snake Plants release oxygen at night, making them a popular choice for bedrooms.",
      "toxicity": "Toxic to cats and dogs if ingested.",
      "seasonalCare": "Reduce watering significantly in winter; avoid cold drafts below 10°C.",
      "compatibility": "Ideal for beginners — tolerates neglect, low light, and irregular watering.",
      "pairingPlants": "Pairs well with Pothos, ZZ Plant, and Peace Lily in low-light arrangements.",
      "propagation": "Propagate by dividing the root ball or by placing leaf cuttings in water or soil.",
      "troubleshooting": "Yellow leaves usually mean overwatering. Brown tips indicate low humidity or fluoride in tap water."
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

app.post(
  "/api/plant-tips",
  (req, res, next) => {
    if (MOCK_MODE) return res.json(MOCK_RESPONSE);
    next();
  },
  plantTipsLimiter,
  async (req, res) => {
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

// --- Plant diagnosis endpoint ---

const DIAGNOSIS_PROMPT = (plantName?: string) => `
You are a plant health expert. Examine the provided image of ${plantName ? `a "${plantName}"` : "a plant"} and identify any visible health problems such as disease, pests, overwatering, underwatering, sunburn, nutrient deficiency, or physical damage.

Respond with a JSON object ONLY — no markdown, no extra text.
{
  "healthy": boolean,
  "issues": string[],
  "diagnosis": string,
  "recommendations": string[]
}

- "healthy": true if the plant looks healthy with no visible problems.
- "issues": short labels for each problem found (e.g. "Yellowing leaves", "Root rot", "Spider mites"). Empty array if healthy.
- "diagnosis": 2–4 sentences explaining what is wrong and likely causes.
- "recommendations": 3–5 actionable steps to treat the problem. Empty array if healthy.
`;

app.post(
  "/api/plant-diagnosis",
  (req, res, next) => {
    if (MOCK_MODE) return res.json(MOCK_DIAGNOSIS_RESPONSE);
    next();
  },
  plantTipsLimiter,
  async (req, res) => {
    const { imageBase64, mimeType, plantName } = req.body as {
      imageBase64?: string;
      mimeType?: string;
      plantName?: string;
    };

    if (!imageBase64 || typeof imageBase64 !== "string" || imageBase64.length === 0) {
      return res.status(400).json({ error: "imageBase64 is required" });
    }
    if (!mimeType || typeof mimeType !== "string") {
      return res.status(400).json({ error: "mimeType is required" });
    }

    try {
      const result = await withTimeout(
        geminiModel.generateContent([
          { inlineData: { data: imageBase64, mimeType } },
          { text: DIAGNOSIS_PROMPT(plantName?.trim()) },
        ]),
        20_000,
        "Gemini diagnosis"
      );

      let responseText = result.response.text().replace(/```json/gi, "").replace(/```/g, "").trim();

      let parsedResponse: unknown;
      try {
        parsedResponse = JSON.parse(responseText);
      } catch {
        console.error("Gemini diagnosis returned unparseable JSON:", responseText);
        return res.status(502).json({ error: "AI service returned an invalid response" });
      }

      const r = parsedResponse as Record<string, unknown>;
      if (
        typeof r.healthy !== "boolean" ||
        !Array.isArray(r.issues) ||
        typeof r.diagnosis !== "string" ||
        !Array.isArray(r.recommendations)
      ) {
        console.error("Gemini diagnosis response missing expected fields:", parsedResponse);
        return res.status(502).json({ error: "AI service returned an unexpected response shape" });
      }

      res.json(parsedResponse);
    } catch (error) {
      console.error("Gemini diagnosis error:", error);
      res.status(500).json({ error: "Failed to diagnose plant from image." });
    }
  }
);

// --- Plant identification endpoint ---

const MOCK_IDENTIFY_RESPONSE = {
  isPlant: true,
  plantName: "Mock Monstera",
  scientificName: "Monstera fictus",
  confidence: "high",
  description:
    "Identified by its large fenestrated leaves. Mock Monstera is used in automated tests to ensure identification works without calling real AI providers.",
};

const IDENTIFY_PROMPT = `
You are a botanist. Identify the plant in the provided image.

Respond with a JSON object ONLY — no markdown, no extra text.
{
  "isPlant": boolean,
  "plantName": string,
  "scientificName": string,
  "confidence": "high" | "medium" | "low",
  "description": string
}

- "isPlant": false if the image does not clearly contain a plant.
- "plantName": the most common English name (e.g. "Snake Plant"). Empty string if isPlant is false.
- "scientificName": binomial name (e.g. "Dracaena trifasciata"). Empty string if unknown.
- "confidence": how certain you are of the identification.
- "description": 1-2 sentences naming the visual features that led to the identification, or why it could not be identified.
`;

app.post(
  "/api/plant-identify",
  (req, res, next) => {
    if (MOCK_MODE) return res.json(MOCK_IDENTIFY_RESPONSE);
    next();
  },
  plantTipsLimiter,
  async (req, res) => {
    const { imageBase64, mimeType } = req.body as {
      imageBase64?: string;
      mimeType?: string;
    };

    if (!imageBase64 || typeof imageBase64 !== "string" || imageBase64.length === 0) {
      return res.status(400).json({ error: "imageBase64 is required" });
    }
    if (!mimeType || typeof mimeType !== "string") {
      return res.status(400).json({ error: "mimeType is required" });
    }

    try {
      const result = await withTimeout(
        geminiModel.generateContent([
          { inlineData: { data: imageBase64, mimeType } },
          { text: IDENTIFY_PROMPT },
        ]),
        20_000,
        "Gemini identify"
      );

      const responseText = result.response.text().replace(/```json/gi, "").replace(/```/g, "").trim();

      let parsedResponse: unknown;
      try {
        parsedResponse = JSON.parse(responseText);
      } catch {
        console.error("Gemini identify returned unparseable JSON:", responseText);
        return res.status(502).json({ error: "AI service returned an invalid response" });
      }

      const r = parsedResponse as Record<string, unknown>;
      if (
        typeof r.isPlant !== "boolean" ||
        typeof r.plantName !== "string" ||
        typeof r.scientificName !== "string" ||
        typeof r.confidence !== "string" ||
        typeof r.description !== "string"
      ) {
        console.error("Gemini identify response missing expected fields:", parsedResponse);
        return res.status(502).json({ error: "AI service returned an unexpected response shape" });
      }

      res.json(parsedResponse);
    } catch (error) {
      console.error("Gemini identify error:", error);
      res.status(500).json({ error: "Failed to identify plant from image." });
    }
  }
);

// --- Plant chat endpoint ---

const MOCK_CHAT_RESPONSE = {
  reply: "Your plant looks great! Make sure to water it when the top inch of soil feels dry, and keep it in bright indirect light for best results.",
};

const CHAT_SYSTEM_PROMPT = (plantName: string) =>
  `You are a plant care expert. The user is asking about their plant: ${plantName}. Give helpful, concise advice.`;

type ChatRole = "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string };

const VALID_CHAT_PROVIDERS = new Set<string>(["gemini", "groq"]);

app.post(
  "/api/plant-chat",
  (req, res, next) => {
    if (MOCK_MODE) return res.json(MOCK_CHAT_RESPONSE);
    next();
  },
  plantTipsLimiter,
  async (req, res) => {
    const { plantName, messages, aiProvider = "gemini" } = req.body as {
      plantName?: string;
      messages?: ChatMessage[];
      aiProvider?: string;
    };

    if (!plantName || typeof plantName !== "string" || plantName.trim().length === 0) {
      return res.status(400).json({ error: "plantName is required" });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required and must not be empty" });
    }
    if (!VALID_CHAT_PROVIDERS.has(aiProvider)) {
      return res.status(400).json({ error: "aiProvider must be 'gemini' or 'groq' for chat" });
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "user") {
      return res.status(400).json({ error: "Last message must be from the user" });
    }

    try {
      let reply = "";

      if (aiProvider === "gemini") {
        const history = messages.slice(0, -1).map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

        const chat = geminiModel.startChat({
          systemInstruction: CHAT_SYSTEM_PROMPT(plantName.trim()),
          history,
        });

        const result = await withTimeout(
          chat.sendMessage(lastMessage.content),
          15_000,
          "Gemini chat"
        );
        reply = result.response.text().trim();
      } else {
        if (!groqClient) {
          return res.status(503).json({ error: "Groq is not configured on this server" });
        }
        const groqMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
          { role: "system", content: CHAT_SYSTEM_PROMPT(plantName.trim()) },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ];
        const completion = await withTimeout(
          groqClient.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: groqMessages,
          }),
          15_000,
          "Groq chat"
        );
        reply = completion.choices[0]?.message?.content?.trim() ?? "";
      }

      if (!reply) {
        return res.status(502).json({ error: "AI service returned an empty response" });
      }

      res.json({ reply });
    } catch (error) {
      console.error("Plant chat error:", error);
      res.status(500).json({ error: "Failed to get chat response from AI service." });
    }
  }
);

// --- Plant compare endpoint ---

const MOCK_COMPARE_RESPONSE = {
  summary: "Both plants are popular houseplants, but they suit different growers. The Pothos is the ultimate beginner plant, while the Fiddle Leaf Fig rewards experienced gardeners with stunning foliage.",
  categories: [
    { label: "Watering",    plantA: "Water every 1–2 weeks, tolerates dry spells",      plantB: "Water every 7 days, do not let soil dry out fully" },
    { label: "Light",       plantA: "Low to bright indirect light",                       plantB: "Bright indirect light only — hates being moved" },
    { label: "Care Level",  plantA: "Easy",                                               plantB: "Hard" },
    { label: "Toxicity",    plantA: "Toxic to pets if ingested",                          plantB: "Toxic to cats and dogs" },
    { label: "Best For",    plantA: "Beginners",                                          plantB: "Experienced growers" },
    { label: "Growth Speed",plantA: "Fast — can grow several feet per year",              plantB: "Slow indoors without ideal conditions" },
    { label: "Fun Difference", plantA: "Nearly impossible to kill",                       plantB: "Notoriously dramatic — drops leaves from stress" },
  ],
  verdict: "Go with Pothos if you want something forgiving and low-effort. Choose Fiddle Leaf Fig if you're ready for a challenge and want a striking statement piece.",
};

const COMPARE_PROMPT = (plantA: string, plantB: string) => `
You are a plant care expert. Compare "${plantA}" and "${plantB}" across these categories: Watering, Light, Care Level, Toxicity, Best For (beginner or expert), Growth Speed, and one Fun Difference.

Respond with a JSON object ONLY — no markdown, no extra text.
{
  "summary": "string",
  "categories": [
    { "label": "string", "plantA": "string", "plantB": "string" }
  ],
  "verdict": "string"
}

- "summary": 2 sentences summarising the key difference between the two plants.
- "categories": exactly 7 objects, one per category listed above, with concise values for each plant.
- "verdict": 1–2 sentences recommending which plant suits which type of grower.
`;

app.post(
  "/api/plant-compare",
  (req, res, next) => {
    if (MOCK_MODE) return res.json(MOCK_COMPARE_RESPONSE);
    next();
  },
  plantTipsLimiter,
  async (req, res) => {
    const { plantA, plantB, aiProvider = "gemini" } = req.body as {
      plantA?: string;
      plantB?: string;
      aiProvider?: string;
    };

    if (!plantA || typeof plantA !== "string" || plantA.trim().length === 0) {
      return res.status(400).json({ error: "plantA is required" });
    }
    if (!plantB || typeof plantB !== "string" || plantB.trim().length === 0) {
      return res.status(400).json({ error: "plantB is required" });
    }
    if (plantA.length > 100 || plantB.length > 100) {
      return res.status(400).json({ error: "Plant names must be 100 characters or fewer" });
    }
    if (!VALID_CHAT_PROVIDERS.has(aiProvider)) {
      return res.status(400).json({ error: "aiProvider must be 'gemini' or 'groq' for compare" });
    }

    try {
      let responseText = "";

      if (aiProvider === "gemini") {
        const result = await withTimeout(
          geminiModel.generateContent(COMPARE_PROMPT(plantA.trim(), plantB.trim())),
          15_000,
          "Gemini compare"
        );
        responseText = result.response.text();
      } else {
        if (!groqClient) {
          return res.status(503).json({ error: "Groq is not configured on this server" });
        }
        const completion = await withTimeout(
          groqClient.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: COMPARE_PROMPT(plantA.trim(), plantB.trim()) }],
            response_format: { type: "json_object" },
          }),
          15_000,
          "Groq compare"
        );
        responseText = completion.choices[0]?.message?.content ?? "";
      }

      responseText = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();

      let parsedResponse: unknown;
      try {
        parsedResponse = JSON.parse(responseText);
      } catch {
        console.error("Plant compare returned unparseable JSON:", responseText);
        return res.status(502).json({ error: "AI service returned an invalid response" });
      }

      const r = parsedResponse as Record<string, unknown>;
      if (
        typeof r.summary !== "string" ||
        !Array.isArray(r.categories) ||
        typeof r.verdict !== "string"
      ) {
        console.error("Plant compare response missing expected fields:", parsedResponse);
        return res.status(502).json({ error: "AI service returned an unexpected response shape" });
      }

      res.json(parsedResponse);
    } catch (error) {
      console.error("Plant compare error:", error);
      res.status(500).json({ error: "Failed to compare plants." });
    }
  }
);

// --- Plant search endpoint (Trefle) ---

type TreflePlant = {
  id: number;
  common_name: string | null;
  scientific_name: string;
  image_url: string | null;
};

app.get(
  "/api/plant-search",
  (req, res, next) => {
    if (MOCK_MODE) return res.json(MOCK_PLANT_SEARCH_RESPONSE);
    next();
  },
  plantTipsLimiter,
  async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) {
      return res.status(400).json({ error: "q query parameter is required" });
    }

    const trefleKey = process.env.TREFLE_API_KEY;
    if (!trefleKey) {
      return res.status(503).json({ error: "Plant search is not configured on this server" });
    }

    try {
      const url = `https://trefle.io/api/v1/plants/search?token=${trefleKey}&q=${encodeURIComponent(q)}`;

      const trefleData = await withTimeout(
        fetch(url).then(async (r) => {
          if (!r.ok) {
            const body = await r.text().catch(() => "");
            throw new Error(`Trefle API error ${r.status}: ${body}`);
          }
          const json = (await r.json()) as { data?: TreflePlant[] };
          return json.data ?? [];
        }),
        10_000,
        "Trefle"
      );

      const results = trefleData.map((p) => ({
        id: p.id,
        commonName: p.common_name,
        scientificName: p.scientific_name,
        imageUrl: p.image_url,
      }));

      res.json({ results });
    } catch (error) {
      console.error("Trefle search error:", error);
      res.status(502).json({ error: "Failed to fetch plant data from search service." });
    }
  }
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
