# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ai-plantz** is a cross-platform botanical assistant app built with React Native/Expo and an Express.js backend. Users search for plants and receive AI-generated care tips powered by Google Gemini API.

## Commands

### Frontend (root)

```bash
npm install
npm start          # Expo dev server (interactive — choose iOS/Android/Web)
npm run android
npm run ios
npm run web
npm test           # Jest
npm lint           # expo lint
```

### Backend

```bash
cd backend
npm install
npm run dev        # nodemon hot-reload (ts-node)
npm run build      # Compiles src/ → dist/
npm run serve      # node dist/index.js
npm start          # ts-node direct (production-like)
```

Backend default port: `5000` (override with `PORT` env var).

## Architecture

**Frontend**: React Native 0.79.6 + Expo 53, Expo Router (file-based routing like Next.js), AsyncStorage for persistence, NativeWind + Tailwind for styling.

**Backend**: Single Express 5.1 TypeScript server with one endpoint — `POST /api/plant-tips` — that calls Google Gemini 1.5 Flash and returns structured JSON.

**Data flow**: all screens go through `utilities/fetchPlantTips.ts` → `POST /api/plant-tips` → Gemini → `{ summary, details: { watering, light, fertilizer } }`.

The detail screen (`PlantDetailsAiGenerated.tsx`) stores and renders only `apiData.details` (the inner object), so cards map directly to watering/light/fertilizer fields.

## Key Architectural Decisions

### Caching (client-side only)
- `plantHistory` (AsyncStorage): last 10 `PlantEntry` objects
- `cache_${plantName}` (AsyncStorage): detailed care tips per plant
- Backend is **stateless** — no server-side cache. Every uncached request costs a Gemini call.

### PlantEntry type (`app/types.ts`)
```typescript
type PlantEntry = {
  name: string;
  summary: string;        // 1-2 sentence AI summary
  details?: string;       // Full care guide (optional, fetched lazily)
  isFavorite: boolean;
  lastViewed: number;     // Unix timestamp
};
```

### Backend prompt engineering (`backend/src/index.ts`)
Gemini is prompted to return strict JSON with `summary` and `details` keys. The response handler strips markdown code fences before `JSON.parse`. If you modify the prompt, maintain this contract or update `fetchPlantTips.ts` parsing.

### Styling
Standardised on `StyleSheet.create()`. `PlantCareTips.tsx` is the only exception — it uses NativeWind `className` and stays that way until it needs animation or dynamic styles. Do not add NativeWind to new files. `SkeletonLoader.tsx` requires StyleSheet permanently because `Animated.Value` can only be passed via the `style` prop, not `className`.

## Environment Variables

**Frontend (`.env` at root)**
```
GEMINI_API_KEY=...          # Loaded via app.config.js → Constants.expoConfig.extra
EXPO_PUBLIC_API_URL=...     # Backend URL exposed to client (must have EXPO_PUBLIC_ prefix)
OPENAI_API_KEY=...          # Unused
```

**Backend (`backend/.env`)**
```
GEMINI_API_KEY=...
PORT=5000
```

## Testing

`__tests__/history.test.ts` covers `sortHistoryByDate` and `toggleFavoriteLogic` from `app/logic/historyLogic.ts`. Run a single test file: `npm test -- --testPathPattern=history`.

**Not yet covered — highest priority next:**
- `app/logic/cacheLogic.ts` (`getPlantDetailsFromCache`, `savePlantDetailsToCache`) — broken cache silently causes every detail view to re-hit Gemini
- `utilities/fetchPlantTips.ts` (`getPlantTips`) — single API path, error branches untested

## Docker

```bash
docker build -t ai-plantz .
docker run -p 19000:19000 -p 19001:19001 -p 19002:19002 ai-plantz
```

Runs `expo start --tunnel` for remote development.
