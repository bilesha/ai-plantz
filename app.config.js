import 'dotenv/config';

export default {
  expo: {
    name: "ai-plantz",
    slug: "ai-plantz",
    version: "1.0.0",
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#059669',
    },
    extra: {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY
    },
    plugins: [
      [
        "expo-notifications",
        {
          color: "#059669",
        },
      ],
    ],
  },
}; 