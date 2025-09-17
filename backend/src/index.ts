import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Example endpoint
app.post("/api/plant-tips", async (req, res) => {
  const { plantName } = req.body;

  if (!plantName) {
    return res.status(400).json({ error: "plantName is required" });
  }

  // TODO: Call your AI API here (OpenAI, Gemini, etc.)
  const summary = `Summary for ${plantName}`;
  const details = `Detailed care tips for ${plantName}...`;

  res.json({ summary, details });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});