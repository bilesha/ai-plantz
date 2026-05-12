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
npm test -- --testPathPattern=history   # run a single test file
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

**Backend**: Single Express 5.1 TypeScript server (`backend/src/index.ts`) with two endpoints — `GET /health` and `POST /api/plant-tips` — that calls Google Gemini 1.5 Flash and returns structured JSON. Rate-limited to 10 req/IP/min via `express-rate-limit`.

**Data flow**: All screens call `utilities/fetchPlantTips.ts` → `POST /api/plant-tips` → Gemini → `{ summary, details: { watering, light, fertilizer } }`. The detail screen (`PlantDetailsAiGenerated.tsx`) checks the `cache_${plantName}` AsyncStorage key first and only calls the API on a cache miss.

## Key Architectural Decisions

### Caching (client-side only, AsyncStorage)

| Key pattern | Value | Purpose |
|---|---|---|
| `plantHistory` | `PlantEntry[]` (max 10) | Recent search history |
| `cache_${plantName}` | `PlantDetails` JSON | Detailed care tips per plant |
| `image_${plantName}` | URL string or `__no_image__` | Wikipedia thumbnail per plant |
| `reminder_${plantName}` | `{ id, intervalDays }` | Scheduled notification metadata |
| `seen_welcome` | `"1"` | Whether the welcome card has been dismissed |

The backend is **stateless** — every uncached request costs a Gemini call.

**Image cache has three states**: `undefined` = not yet fetched (go fetch), `null` = fetched but Wikipedia returned no image (skip), URL string = cached hit. This three-way distinction lives in `logic/cacheLogic.ts:getPlantImageFromCache`.

### Types (`types.ts` at root)

```typescript
type PlantDetails = {
  watering: string;
  light: string;
  fertilizer: string;
};

type PlantEntry = {
  name: string;
  summary: string;
  details?: PlantDetails;   // structured object, not a string
  isFavorite: boolean;
  lastViewed: number;       // Unix timestamp
};
```

### Theme system (`constants/theme.ts`)

All screens use `useTheme()` (reads `useColorScheme()`) to get a typed `Theme` token object. The pattern in every screen is:

```typescript
const theme = useTheme();
const s = useMemo(() => styles(theme), [theme]);
// ...
const styles = (t: Theme) => StyleSheet.create({ ... });
```

### Styling

Standardised on `StyleSheet.create()` with the theme factory pattern above. `PlantCareTips.tsx` is the only exception — it uses NativeWind `className`. Do not add NativeWind to new files. `SkeletonLoader.tsx` requires `StyleSheet` permanently because `Animated.Value` can only be passed via the `style` prop.

### Backend prompt engineering (`backend/src/index.ts`)

Gemini is prompted to return strict JSON with `summary` and `details` keys. The response handler strips markdown code fences before `JSON.parse`. Gemini returning unparseable JSON → 502; missing expected fields → 502; any other error → 500. If you modify the prompt, maintain this contract or update `fetchPlantTips.ts` parsing.

### Notifications

Android notification channel `watering-reminders` is registered in `app/_layout.tsx`. Watering reminders are not supported on web — `reminderLogic.ts` throws and `PlantDetailsAiGenerated.tsx` hides the reminder UI when `Platform.OS === 'web'`. Reminder options are 3, 7, 14, or 30 days (configurable in the `REMINDER_OPTIONS` constant at the top of `PlantDetailsAiGenerated.tsx`).

## Environment Variables

**Frontend (`.env` at root)**
```
EXPO_PUBLIC_API_URL=...     # Backend URL exposed to client (must have EXPO_PUBLIC_ prefix)
GEMINI_API_KEY=...          # Loaded via app.config.js → Constants.expoConfig.extra (unused client-side)
OPENAI_API_KEY=...          # Unused
```

**Backend (`backend/.env`)**
```
GEMINI_API_KEY=...
PORT=5000
ALLOWED_ORIGIN=...          # CORS origin (defaults to http://localhost:8081)
```

## File Layout (non-obvious)

- `logic/` — pure business logic (no UI imports): `cacheLogic.ts`, `historyLogic.ts`, `reminderLogic.ts`
- `utilities/` — API/network helpers: `fetchPlantTips.ts`, `fetchPlantImage.ts`, `storage.ts`
- `constants/` — static data and theme: `plants.ts` (PLANT_SUGGESTIONS, RANDOM_PLANTS), `theme.ts`
- `styles/` — separated StyleSheet files for larger screens
- `api/openai.ts`, `api/qwenai.ts` — unused/experimental, not wired into the app

## Testing

All test files are in `__tests__/`. Run a single file: `npm test -- --testPathPattern=<name>`.

| File | What it covers |
|---|---|
| `history.test.ts` | `sortHistoryByDate`, `toggleFavoriteLogic` |
| `cacheLogic.test.ts` | `getPlantDetailsFromCache`, `savePlantDetailsToCache`, image cache three-state logic |
| `fetchPlantTips.test.ts` | `getPlantTips` — happy path, server errors, network errors; mocks `expo/virtual/env` to inject `EXPO_PUBLIC_API_URL` |
| `reminderLogic.test.ts` | `scheduleWateringReminder`, `cancelWateringReminder`, `getWateringReminder`; mocks `expo-notifications` and `react-native` Platform |

AsyncStorage is mocked in tests via `@react-native-async-storage/async-storage/jest/async-storage-mock`. Always `AsyncStorage.clear()` in `beforeEach` to prevent test bleed.

## Docker

```bash
docker build -t ai-plantz .
docker run -p 19000:19000 -p 19001:19001 -p 19002:19002 ai-plantz
```

Runs `expo start --tunnel` for remote development.
