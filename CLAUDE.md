# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ai-plantz** is a cross-platform botanical assistant app built with React Native/Expo and an Express.js backend. Users search for plants and receive AI-generated care tips powered by Google Gemini API. User data (collection, history, watering logs, profile) is persisted in Supabase for authenticated users, with AsyncStorage as an offline fallback.

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

**Frontend**: React Native 0.79.6 + Expo 53, Expo Router (file-based routing like Next.js), Supabase for auth and cloud persistence, AsyncStorage for local caching and offline fallback, NativeWind + Tailwind for styling.

**Backend**: Single Express 5.1 TypeScript server (`backend/src/index.ts`) with two endpoints — `GET /health` and `POST /api/plant-tips` — that calls Google Gemini 1.5 Flash and returns structured JSON. Rate-limited to 10 req/IP/min via `express-rate-limit`. Stateless — no database; every uncached request costs a Gemini call.

**Data flow**: All screens call `utilities/fetchPlantTips.ts` → `POST /api/plant-tips` → Gemini → `{ summary, details: { watering, light, fertilizer } }`. The detail screen (`PlantDetailsAiGenerated.tsx`) checks `cache_${plantName}` in AsyncStorage first and only calls the API on a miss.

**Auth flow**: `app/_layout.tsx` listens to `supabase.auth.onAuthStateChange` and redirects unauthenticated users to `/screens/auth`. On `SIGNED_IN` it also calls `migrateLocalCollectionToSupabase()` to move any pre-login local collection data to the cloud.

## Key Architectural Decisions

### Persistence

Three layers, each with a distinct purpose:

| Layer | What lives here |
|---|---|
| **Supabase** (authenticated users) | `plant_history`, `plant_collection`, `watering_log`, `profiles` |
| **AsyncStorage** (fallback / always-local) | `plantHistory`, `plantCollection`, `wateringLog_*` when unauthenticated; `cache_*`, `image_*`, `reminder_*`, `seen_welcome` always |
| **AsyncStorage migration flags** | `collection_migrated_v1` — prevents re-running the one-time data migration |

**The pattern in all three logic/storage modules**: `getUserId()` checks the local Supabase session (no network call). If authenticated, reads come from Supabase and writes are fire-and-forget (dispatched without `await`) so callers can update UI state optimistically before the network round-trip completes. If unauthenticated, everything falls back to the corresponding AsyncStorage key.

### Supabase tables

All tables have RLS enabled with `auth.uid() = user_id` (or `id` for `profiles`).

| Table | Key columns | Managed by |
|---|---|---|
| `plant_collection` | `user_id`, `plant_name`, `summary`, `details` (jsonb), `status`, `rating`, `notes` | `logic/collectionLogic.ts` |
| `plant_history` | `user_id`, `plant_name`, `summary`, `details` (jsonb), `is_favorite`, `last_viewed` | `utilities/storage.ts` |
| `watering_log` | `user_id`, `plant_name`, `watered_at` | `logic/wateringLogic.ts` |
| `profiles` | `id` (= auth user id), `username`, `bio`, `avatar_url`, `updated_at` | `app/screens/profile.tsx` |

### AsyncStorage keys (always local — never synced to Supabase)

| Key pattern | Value | Purpose |
|---|---|---|
| `cache_${plantName}` | `PlantDetails` JSON | AI care tips cache (regeneratable) |
| `image_${plantName}` | URL string or `__no_image__` | Wikipedia thumbnail cache |
| `reminder_${plantName}` | `{ id, intervalDays }` | Expo Notification ID — device-specific |
| `seen_welcome` | `"1"` | Onboarding tour dismissed flag |

**Image cache has three states**: `undefined` = not yet fetched, `null` = fetched but no image exists (sentinel to skip re-fetch), URL string = cached hit. This three-way distinction lives in `logic/cacheLogic.ts:getPlantImageFromCache`.

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
  details?: PlantDetails;
  isFavorite: boolean;
  lastViewed: number;       // Unix timestamp
};

type OwnershipStatus = 'own' | 'want' | 'tried';

type CollectionEntry = {
  name: string;
  summary: string;
  details?: PlantDetails;
  addedAt: number;          // Unix timestamp
  status: OwnershipStatus;
  rating?: number;          // 1–5
  notes?: string;
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
EXPO_PUBLIC_API_URL=...             # Backend URL exposed to client (must have EXPO_PUBLIC_ prefix)
EXPO_PUBLIC_SUPABASE_URL=...        # Supabase project URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=...   # Supabase anon/public key
GEMINI_API_KEY=...                  # Loaded via app.config.js → Constants.expoConfig.extra (unused client-side)
OPENAI_API_KEY=...                  # Unused
```

**Backend (`backend/.env`)**
```
GEMINI_API_KEY=...
PORT=5000
ALLOWED_ORIGIN=...          # CORS origin (defaults to http://localhost:8081)
```

## File Layout (non-obvious)

- `lib/supabase.ts` — Supabase client (auth storage uses AsyncStorage; imported by logic and screens)
- `logic/` — pure business logic (no UI imports):
  - `cacheLogic.ts` — AsyncStorage-backed plant details + image cache
  - `historyLogic.ts` — pure functions: `sortHistoryByDate`, `toggleFavoriteLogic`, `removeHistoryItem`
  - `reminderLogic.ts` — Expo Notifications scheduling; uses AsyncStorage for notification IDs
  - `collectionLogic.ts` — Supabase `plant_collection` CRUD; exports `migrateLocalCollectionToSupabase()`
  - `wateringLogic.ts` — Supabase `watering_log` insert/query; `logWatering` is fire-and-forget
- `utilities/` — API/network helpers:
  - `fetchPlantTips.ts` — calls backend `/api/plant-tips`
  - `fetchPlantImage.ts` — queries Wikipedia REST API for thumbnails
  - `storage.ts` — Supabase `plant_history` CRUD; exports `getHistory`, `savePlant`, `deleteHistoryItem`, `clearHistory`, `setFavorite`
- `app/screens/` — all route screens:
  - `auth.tsx` — login / signup
  - `username.tsx` — post-signup username setup (saves to `auth.users` metadata)
  - `profile.tsx` — edit profile (username, bio, avatar URL); saves to `profiles` table
  - `history.tsx` — search history with favourites filter
  - `collection.tsx` — plant collection with status filter (own / want / tried)
  - `PlantDetailsAiGenerated.tsx` — care tips, watering log, collection management, reminders
  - `settings.tsx` — active reminders, "Edit Profile" link, "Log out" button, "Clear all data"
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
| `fetchPlantImage.test.ts` | Wikipedia image fetch — success, no image, network error |
| `reminderLogic.test.ts` | `scheduleWateringReminder`, `cancelWateringReminder`, `getWateringReminder`; mocks `expo-notifications` and `react-native` Platform |

The Supabase-backed modules (`collectionLogic`, `wateringLogic`, `storage`) are not unit-tested — they require a live Supabase connection. AsyncStorage is mocked in all tests via `@react-native-async-storage/async-storage/jest/async-storage-mock`. Always `AsyncStorage.clear()` in `beforeEach` to prevent test bleed.

## Docker

```bash
docker build -t ai-plantz .
docker run -p 19000:19000 -p 19001:19001 -p 19002:19002 ai-plantz
```

Runs `expo start --tunnel` for remote development.
