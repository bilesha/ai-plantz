# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ai-plantz** is a cross-platform botanical assistant app built with React Native/Expo and an Express.js backend. Users search for plants and receive AI-generated care tips powered by multiple AI providers (Gemini, Groq, DeepSeek, Qwen, Moonshot). User data (collection, history, watering logs, profile) is persisted in Supabase for authenticated users, with AsyncStorage as an offline fallback.

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

**Backend**: Single Express 5.1 TypeScript server (`backend/src/index.ts`) with two endpoints — `GET /health` and `POST /api/plant-tips` — that dispatches to one of five AI providers based on the `aiProvider` field in the request body. Rate-limited to 10 req/IP/min via `express-rate-limit`. Stateless — no database.

**Data flow**: All screens call `utilities/fetchPlantTips.ts` → reads `ai_provider` from AsyncStorage → `POST /api/plant-tips` with `{ plantName, aiProvider }` → chosen provider → `{ summary, details }`. The detail screen (`PlantDetailsAiGenerated.tsx`) checks `cache_${plantName}_${provider}` in AsyncStorage first and only calls the API on a miss. Cache keys are per-provider so switching providers always fetches fresh tips.

**Auth flow**: `app/_layout.tsx` wraps the app in `ThemeProvider`, then `RootLayoutInner` listens to `supabase.auth.onAuthStateChange` and redirects unauthenticated users to `/screens/auth`. On `SIGNED_IN` it also calls `migrateLocalCollectionToSupabase()` to move any pre-login local collection data to the cloud.

**Navigation**: A `BottomTabBar` component renders 6 tabs (Home, Discover, Collection, History, Profile, Settings). Tab screens are wrapped in `ScreenLayout` (which renders children + BottomTabBar). Detail screens (PlantDetailsAiGenerated, publicProfile, editProfile, auth, username) are NOT wrapped in ScreenLayout and have no tab bar.

## Key Architectural Decisions

### Persistence

Three layers, each with a distinct purpose:

| Layer | What lives here |
|---|---|
| **Supabase** (authenticated users) | `plant_history`, `plant_collection`, `watering_log`, `profiles`, `follows` |
| **AsyncStorage** (fallback / always-local) | `plantHistory`, `plantCollection`, `wateringLog_*` when unauthenticated; `cache_*`, `image_*`, `reminder_*`, `seen_welcome_v2`, `ai_provider`, `theme_preference` always |
| **AsyncStorage migration flags** | `collection_migrated_v1` — prevents re-running the one-time data migration |

**The pattern in all three logic/storage modules**: `getUserId()` checks the local Supabase session (no network call). If authenticated, reads come from Supabase. `addToCollection` is awaited and returns `{ success: boolean; error?: string }` — the caller shows a feedback banner on failure. Other write operations (`removeFromCollection`, `updateCollectionEntry`, `logWatering`) remain fire-and-forget. If unauthenticated, everything falls back to AsyncStorage.

### Supabase tables

All tables have RLS enabled with `auth.uid() = user_id` (or `id` for `profiles`).

| Table | Key columns | Managed by |
|---|---|---|
| `plant_collection` | `user_id`, `plant_name`, `summary`, `details` (jsonb), `status`, `rating`, `notes` | `logic/collectionLogic.ts` |
| `plant_history` | `user_id`, `plant_name`, `summary`, `details` (jsonb), `is_favorite`, `last_viewed` | `utilities/storage.ts` |
| `watering_log` | `user_id`, `plant_name`, `watered_at` | `logic/wateringLogic.ts` |
| `profiles` | `id` (= auth user id), `username`, `bio`, `avatar_url`, `updated_at` | `app/screens/editProfile.tsx` |
| `follows` | `follower_id`, `following_id`, unique constraint | `logic/followLogic.ts` |

Required Supabase policies beyond the defaults:
```sql
-- Allow anyone to read profiles (for discover / public profiles)
create policy "public read" on profiles for select using (true);

-- Allow anyone to read plant_collection (for public profiles + trending)
create policy "public read" on plant_collection for select using (true);

-- follows table
create table follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid references auth.users(id) on delete cascade not null,
  following_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  constraint follows_unique unique (follower_id, following_id)
);
alter table follows enable row level security;
create policy "own follows only" on follows for all using (auth.uid() = follower_id);
create policy "public read" on follows for select using (true);
```

Required Supabase RPC functions:
```sql
-- Used by discover.tsx trending section
create or replace function get_trending_plants(limit_count int default 10)
returns table(plant_name text, collection_count bigint)
language sql security definer as $$
  select plant_name, count(*) as collection_count
  from plant_collection
  group by plant_name
  order by collection_count desc
  limit limit_count;
$$;

-- Used by settings.tsx delete account
create or replace function delete_user()
returns void language plpgsql security definer as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;
```

### AsyncStorage keys (always local — never synced to Supabase)

| Key pattern | Value | Purpose |
|---|---|---|
| `cache_${plantName}_${provider}` | `PlantDetails` JSON | AI care tips cache, keyed per provider |
| `image_${plantName}` | URL string or `__no_image__` | Wikipedia thumbnail cache |
| `reminder_${plantName}` | `{ id, intervalDays }` | Expo Notification ID — device-specific |
| `seen_welcome_v2` | `"1"` | Onboarding tour dismissed flag (v2 = 4-step tour) |
| `ai_provider` | provider id string | Selected AI provider (default: `"gemini"`) |
| `theme_preference` | `"light"` \| `"dark"` \| `"auto"` | User's theme preference (default: `"auto"`) |

**Image cache has three states**: `undefined` = not yet fetched, `null` = fetched but no image exists (sentinel to skip re-fetch), URL string = cached hit. This three-way distinction lives in `logic/cacheLogic.ts:getPlantImageFromCache`.

### Types (`types.ts` at root)

```typescript
type PlantDetails = {
  watering: string;
  light: string;
  fertilizer: string;
  // optional extended fields returned by the AI
  careLevel?: 'easy' | 'medium' | 'hard';
  funFact?: string;
  toxicity?: string;
  seasonalCare?: string;
  compatibility?: string;
  pairingPlants?: string;
  propagation?: string;
  troubleshooting?: string;
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

### AI provider system

The backend accepts `aiProvider` in the `/api/plant-tips` request body. Valid values: `gemini`, `groq`, `deepseek`, `qwen`, `moonshot`. Each maps to a separate API key env var. Returns 503 if the selected provider's key is not configured; 400 for an unrecognised provider string.

`fetchPlantTips.ts` reads `ai_provider` from AsyncStorage before every request and includes it as `aiProvider`. The settings screen (`app/screens/settings.tsx`) lets users pick their provider; preference is stored under the `ai_provider` key.

`PlantDetailsAiGenerated.tsx` also reads `ai_provider` from AsyncStorage and passes it to cache read/write calls so each provider's tips are cached independently.

### Theme system (`constants/theme.ts` + `context/ThemeContext.tsx`)

Theme preference (light / dark / auto) is stored in `ThemeContext`. The provider lives in `context/ThemeContext.tsx` and loads the saved preference from AsyncStorage (`theme_preference`) on mount. `app/_layout.tsx` wraps the entire app in `ThemeProvider`.

`useTheme()` reads from `ThemeContext`: returns `lightTheme` for `'light'`, `darkTheme` for `'dark'`, or falls back to `useColorScheme()` for `'auto'`. The pattern in every screen is:

```typescript
const theme = useTheme();
const s = useMemo(() => styles(theme), [theme]);
// ...
const styles = (t: Theme) => StyleSheet.create({ ... });
```

To read/write the preference directly: `const { preference, setPreference } = useThemePreference()` from `context/ThemeContext.tsx`. Calling `setPreference` updates context state immediately (instant re-render) and persists to AsyncStorage.

### Styling

Standardised on `StyleSheet.create()` with the theme factory pattern above. `PlantCareTips.tsx` is the only exception — it uses NativeWind `className`. Do not add NativeWind to new files. `SkeletonLoader.tsx` requires `StyleSheet` permanently because `Animated.Value` can only be passed via the `style` prop.

### Navigation — BottomTabBar

`components/BottomTabBar.tsx` renders a fixed 6-tab bar: Home, Discover, Collection, History, Profile, Settings. Active tab is detected via `useSegments()` from expo-router. Tab screens must be wrapped in `components/ScreenLayout.tsx`; detail/modal screens must NOT be (they have no tab bar).

Tab screens (use ScreenLayout): `index.tsx`, `discover.tsx`, `collection.tsx`, `history.tsx`, `profile.tsx`, `settings.tsx`

Detail screens (no ScreenLayout): `PlantDetailsAiGenerated.tsx`, `publicProfile.tsx`, `editProfile.tsx`, `auth.tsx`, `username.tsx`

All tab-screen scroll content should use `paddingBottom: 80` to clear the tab bar.

### Web compatibility

`Alert.alert` does not work on web. Any confirmation dialog must branch on `Platform.OS === 'web'` and use `window.confirm` on web, `Alert.alert` on native. See `settings.tsx` for the established pattern (`handleLogout`, `handleClearAllData`, `handleDeleteAccount`).

### Backend prompt engineering (`backend/src/index.ts`)

All providers are prompted to return strict JSON with `summary` and `details` keys (11 fields total). The response handler strips markdown code fences before `JSON.parse`. Unparseable JSON → 502; missing expected fields → 502; provider not configured → 503; invalid provider → 400; any other error → 500. If you modify the prompt, maintain this contract or update `fetchPlantTips.ts` parsing.

### Notifications

Android notification channel `watering-reminders` is registered in `app/_layout.tsx`. Watering reminders are not supported on web — `reminderLogic.ts` throws and `PlantDetailsAiGenerated.tsx` hides the reminder UI when `Platform.OS === 'web'`. Reminder options are 3, 7, 14, or 30 days (configurable in the `REMINDER_OPTIONS` constant at the top of `PlantDetailsAiGenerated.tsx`).

The `performLogout()` function in `settings.tsx` cancels all scheduled notifications (native only), clears AsyncStorage, then calls `supabase.auth.signOut()`. The `onAuthStateChange` listener in `_layout.tsx` handles the redirect automatically.

## Environment Variables

**Frontend (`.env` at root)**
```
EXPO_PUBLIC_API_URL=...             # Backend URL exposed to client (must have EXPO_PUBLIC_ prefix)
EXPO_PUBLIC_SUPABASE_URL=...        # Supabase project URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=...   # Supabase anon/public key
```

**Backend (`backend/.env`)**
```
GEMINI_API_KEY=...
GROQ_API_KEY=...
DEEPSEEK_API_KEY=...
QWEN_API_KEY=...
MOONSHOT_API_KEY=...
PORT=5000
ALLOWED_ORIGIN=...          # CORS origin (defaults to http://localhost:8081)
```

## File Layout (non-obvious)

- `lib/supabase.ts` — Supabase client (auth storage uses AsyncStorage; imported by logic and screens)
- `context/ThemeContext.tsx` — `ThemeProvider`, `useThemePreference()` hook, `ThemePreference` type; persists preference to AsyncStorage under `theme_preference`
- `components/BottomTabBar.tsx` — 6-tab navigation bar; uses `useSegments()` for active detection
- `components/ScreenLayout.tsx` — wraps tab screens with BottomTabBar; do NOT use on detail screens
- `logic/` — pure business logic (no UI imports):
  - `cacheLogic.ts` — AsyncStorage-backed plant details + image cache; all functions take `(plantName, provider)` as args
  - `historyLogic.ts` — pure functions: `sortHistoryByDate`, `toggleFavoriteLogic`, `removeHistoryItem`
  - `reminderLogic.ts` — Expo Notifications scheduling; uses AsyncStorage for notification IDs
  - `collectionLogic.ts` — Supabase `plant_collection` CRUD; `addToCollection` returns `{ success, error? }`; exports `migrateLocalCollectionToSupabase()`, `getPublicCollection(userId)`
  - `wateringLogic.ts` — Supabase `watering_log` insert/query; `logWatering` is fire-and-forget
  - `followLogic.ts` — Supabase `follows` table CRUD: `followUser`, `unfollowUser`, `isFollowing`, `getFollowerCount`, `getFollowingCount`
- `utilities/` — API/network helpers:
  - `fetchPlantTips.ts` — reads `ai_provider` from AsyncStorage, calls backend `/api/plant-tips` with `{ plantName, aiProvider }`
  - `fetchPlantImage.ts` — queries Wikipedia REST API for thumbnails
  - `storage.ts` — Supabase `plant_history` CRUD; exports `getHistory`, `savePlant`, `deleteHistoryItem`, `clearHistory`, `setFavorite`
- `app/screens/` — all route screens:
  - `auth.tsx` — login / signup
  - `username.tsx` — post-signup username setup (saves to `auth.users` metadata)
  - `profile.tsx` — **view screen**: shows avatar, username, email, follower/following/plants stats, bio, Edit Profile button; collection grouped by status; uses ScreenLayout + useFocusEffect to refresh after edit
  - `editProfile.tsx` — **edit screen**: TextInputs for username/bio/avatar URL, handleSave with validation; detail screen (no ScreenLayout, no tab bar); navigated to from profile.tsx and settings.tsx
  - `history.tsx` — search history with favourites filter; rich empty states with nav buttons to home
  - `collection.tsx` — plant collection with status filter (own / want / tried); rich empty state with nav button to home
  - `PlantDetailsAiGenerated.tsx` — care tips, watering log, collection management, reminders; reads `ai_provider` from AsyncStorage for per-provider cache and provider badge; shows green/red save feedback banner (auto-dismisses after 4 s)
  - `settings.tsx` — profile quick-access card; APPEARANCE (light/dark/auto theme); REMINDERS; AI PROVIDER; ACCOUNT (Edit Profile, Log out, Delete Account); DATA (Clear Cache, Export Collection CSV, Clear all data); ABOUT; web-only back button
  - `discover.tsx` — Trending Plants horizontal scroll (via `get_trending_plants` RPC); Following Activity feed (recent collection adds from followed users); debounced username search; navigates to publicProfile or PlantDetailsAiGenerated
  - `publicProfile.tsx` — public view of another user's profile and collection; follow/unfollow button
- `constants/` — static data and theme: `plants.ts` (PLANT_SUGGESTIONS, RANDOM_PLANTS), `theme.ts`
- `styles/` — separated StyleSheet files for larger screens
- `api/openai.ts`, `api/qwenai.ts` — unused/experimental, not wired into the app

## Testing

All test files are in `__tests__/`. Run a single file: `npm test -- --testPathPattern=<name>`.

| File | What it covers |
|---|---|
| `history.test.ts` | `sortHistoryByDate`, `toggleFavoriteLogic` |
| `cacheLogic.test.ts` | `getPlantDetailsFromCache`, `savePlantDetailsToCache`, image cache three-state logic, per-provider cache isolation |
| `fetchPlantTips.test.ts` | `getPlantTips` — happy path, server errors, network errors; verifies `aiProvider` field is sent; mocks AsyncStorage and `expo/virtual/env` |
| `fetchPlantImage.test.ts` | Wikipedia image fetch — success, no image, network error |
| `reminderLogic.test.ts` | `scheduleWateringReminder`, `cancelWateringReminder`, `getWateringReminder`; mocks `expo-notifications` and `react-native` Platform |

The Supabase-backed modules (`collectionLogic`, `wateringLogic`, `storage`, `followLogic`) are not unit-tested — they require a live Supabase connection. AsyncStorage is mocked in all tests via `@react-native-async-storage/async-storage/jest/async-storage-mock`. Always `AsyncStorage.clear()` in `beforeEach` to prevent test bleed.

## Docker

```bash
docker build -t ai-plantz .
docker run -p 19000:19000 -p 19001:19001 -p 19002:19002 ai-plantz
```

Runs `expo start --tunnel` for remote development.
