# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Rootnote** is a cross-platform botanical assistant app built with React Native/Expo and an Express.js backend. Users search for plants and receive AI-generated care tips powered by multiple AI providers (Gemini, Groq, DeepSeek, Qwen, Moonshot). User data (collection, history, watering logs, profile) is persisted in Supabase for authenticated users, with AsyncStorage as an offline fallback.

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

**Backend**: Single Express 5.1 TypeScript server (`backend/src/index.ts`) with five endpoints — `GET /health`, `POST /api/plant-tips`, `POST /api/plant-diagnosis`, `POST /api/plant-chat`, and `POST /api/plant-compare`. `/api/plant-tips` dispatches to one of five AI providers based on the `aiProvider` field. Rate-limited to 10 req/IP/min via `express-rate-limit`. Stateless — no database. When `MOCK_MODE=true`, every endpoint short-circuits and returns a fixed mock response with no AI provider call — used for free, instant, repeatable Playwright/automated test runs.

**Data flow**: All screens call `utilities/fetchPlantTips.ts` → reads `ai_provider` from AsyncStorage → `POST /api/plant-tips` with `{ plantName, aiProvider }` → chosen provider → `{ summary, details }`. The detail screen (`PlantDetailsAiGenerated.tsx`) checks `cache_${plantName}_${provider}` in AsyncStorage first and only calls the API on a miss. Cache keys are per-provider so switching providers always fetches fresh tips.

**Auth flow**: `app/_layout.tsx` wraps the app in `ThemeProvider` → `ToastProvider` → `RootLayoutInner`. `RootLayoutInner` listens to `supabase.auth.onAuthStateChange` and redirects unauthenticated users to `/screens/auth`. On `SIGNED_IN` it also calls `migrateLocalCollectionToSupabase()` to move any pre-login local collection data to the cloud.

**Navigation**: A `BottomTabBar` component renders 6 tabs (Home, Discover, Collection, History, Profile, Settings). Tab screens are wrapped in `ScreenLayout` (which renders children + BottomTabBar). Detail screens (PlantDetailsAiGenerated, publicProfile, editProfile, followersList, auth, username) are NOT wrapped in ScreenLayout and have no tab bar.

## Key Architectural Decisions

### Persistence

Three layers, each with a distinct purpose:

| Layer | What lives here |
|---|---|
| **Supabase** (authenticated users) | `plant_history`, `plant_collection`, `watering_log`, `profiles`, `follows`, `plant_photos`, `plant_chats`, `plant_listings`, `plant_death_log`, `plant_health_log`, `health_log_comments`, `plant_likes`, `plant_comments`, `notifications`, `potw_nominations`, `potw_votes`, `user_streaks`, `user_badges`, `leaderboard` |
| **AsyncStorage** (fallback / always-local) | `plantHistory`, `plantCollection`, `wateringLog_*` when unauthenticated; `cache_*`, `image_*`, `reminder_*`, `seen_welcome_v2`, `ai_provider`, `theme_preference` always |
| **AsyncStorage migration flags** | `collection_migrated_v1` — prevents re-running the one-time data migration |

**The pattern in all logic/storage modules**: `getUserId()` checks the local Supabase session (no network call). If authenticated, reads/writes go to Supabase; unauthenticated falls back to AsyncStorage. `addToCollection` returns `{ success: boolean; error?: string }` — the caller shows a toast on failure. `logWatering` returns `Promise<WateringEntry | null>` (not void) so callers can update local state.

### Supabase tables

All tables have RLS enabled with `auth.uid() = user_id` (or `id` for `profiles`).

| Table | Key columns | Managed by |
|---|---|---|
| `plant_collection` | `user_id`, `plant_name`, `summary`, `details` (jsonb), `status`, `rating`, `notes`, `photo_url`, `watering_interval_days`, `next_watering_date` | `logic/collectionLogic.ts` |
| `plant_history` | `user_id`, `plant_name`, `summary`, `details` (jsonb), `is_favorite`, `last_viewed` | `utilities/storage.ts` |
| `watering_log` | `user_id`, `plant_name`, `watered_at`, `amount_ml`, `notes` | `logic/wateringLogic.ts` |
| `profiles` | `id` (= auth user id), `username`, `bio`, `avatar_url`, `updated_at`, `latitude`, `longitude`, `location_updated_at` | `app/screens/editProfile.tsx`, `logic/locationLogic.ts` |
| `follows` | `follower_id`, `following_id`, unique constraint | `logic/followLogic.ts` |
| `plant_photos` | `user_id`, `plant_name`, `photo_url`, `caption`, `taken_at`, `is_primary` | `logic/photoLogic.ts` |
| `plant_chats` | `user_id`, `plant_name`, `role` (`user`\|`assistant`), `content`, `created_at` | `logic/chatLogic.ts` |
| `plant_listings` | `user_id`, `plant_name`, `listing_type` (`trade`\|`gift`\|`sell`), `price`, `description`, `is_active` | `logic/listingLogic.ts` |
| `plant_death_log` | `user_id`, `plant_name`, `cause`, `notes`, `died_at`, `owned_since` | `logic/deathLogLogic.ts` |
| `plant_health_log` | `user_id`, `plant_name`, `note`, `logged_at` | `logic/healthLogLogic.ts` |
| `health_log_comments` | `user_id`, `health_log_id` (→ `plant_health_log.id`), `body`, `created_at` | `logic/healthLogLogic.ts` |
| `plant_likes` | `user_id`, `plant_owner_id`, `plant_name`, `created_at` | `logic/socialLogic.ts` |
| `plant_comments` | `user_id`, `plant_owner_id`, `plant_name`, `body`, `created_at` | `logic/socialLogic.ts` |
| `notifications` | `user_id`, `actor_id`, `type`, `read`, `created_at` | `logic/notificationLogic.ts` (read-only from the app — see note below) |
| `potw_nominations` | `user_id`, `plant_name`, `reason`, `week_start` (date) | `logic/potwLogic.ts` |
| `potw_votes` | `user_id`, `nomination_id` (→ `potw_nominations.id`), `week_start`; unique on `(user_id, nomination_id)` | `logic/potwLogic.ts` |
| `user_streaks` | `user_id`, `current_streak`, `longest_streak`, `last_activity_date` | `logic/gamificationLogic.ts` |
| `user_badges` | `user_id`, `badge_key`, `earned_at`; unique on `(user_id, badge_key)` | `logic/gamificationLogic.ts` |
| `leaderboard` | `user_id`, `username`, `avatar_url`, `collection_count`, `streak`, `badge_count`, `score`, `updated_at` | `logic/gamificationLogic.ts` |

**`notifications` is never inserted into by app code** — `notificationLogic.ts` only reads and updates (`getNotifications`, `markAllRead`, `getUnreadCount`). Rows must be populated by a Supabase trigger/function on `follows`/`plant_likes`/`plant_comments` inserts (not present in this repo). The `notifications.tsx` screen and the bell badge will stay empty until that trigger exists.

Required Supabase policies beyond the defaults:

Full RLS policy and table-creation SQL lives in the Supabase dashboard / migrations — not duplicated here since the table reference above already covers the schema.

Required Supabase RPC functions:

RPC function definitions (`get_trending_plants`, `delete_user`) live in Supabase — see dashboard.

### AsyncStorage keys (always local — never synced to Supabase)

| Key pattern | Value | Purpose |
|---|---|---|
| `cache_${plantName}_${provider}` | `PlantDetails` JSON | AI care tips cache, keyed per provider |
| `image_${plantName}` | URL string or `__no_image__` | Wikipedia thumbnail cache |
| `reminder_${plantName}` | `{ id, intervalDays }` | Expo Notification ID — device-specific |
| `seen_welcome_v2` | `"1"` | Onboarding tour dismissed flag (v2 = 4-step tour) |
| `ai_provider` | provider id string | Selected AI provider (default: `"gemini"`) |
| `theme_preference` | `"light"` \| `"dark"` \| `"auto"` | User's theme preference (default: `"auto"`) |
| `wateringLog_${plantName}` | `WateringEntry[]` JSON | Watering log for unauthenticated users (backward compat: was `number[]`) |

**Image cache has three states**: `undefined` = not yet fetched, `null` = fetched but no image exists (sentinel to skip re-fetch), URL string = cached hit. This three-way distinction lives in `logic/cacheLogic.ts:getPlantImageFromCache`.

### Types (`types.ts` at root)

```typescript
type PlantDetails = {
  watering: string;
  light: string;
  fertilizer: string;
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

type HealthLogEntry = {
  id: string;
  note: string;
  logged_at: string;
};

type HealthLogComment = {
  id: string;
  user_id: string;
  health_log_id: string;
  body: string;
  created_at: string;
  username: string | null;
  avatar_url: string | null;
};

type CollectionEntry = {
  name: string;
  summary: string;
  details?: PlantDetails;
  addedAt: number;          // Unix timestamp
  status: OwnershipStatus;
  rating?: number;          // 1–5
  notes?: string;
  photo_url?: string;
  next_watering_date?: string;      // ISO date string from plant_collection
  watering_interval_days?: number;  // days between waterings
};

// From wateringLogic.ts
type WateringEntry = {
  id: string;
  watered_at: string;   // ISO date string
  amount_ml?: number;
  notes?: string;
};

type WateringInterval = {
  intervalDays: number | null;
  nextWateringDate: string | null;  // ISO date string
};
```

### AI provider system

The backend accepts `aiProvider` in the `/api/plant-tips` request body. Valid values: `gemini`, `groq`, `deepseek`, `qwen`, `moonshot`. Each maps to a separate API key env var. Returns 503 if the selected provider's key is not configured; 400 for an unrecognised provider string.

`fetchPlantTips.ts` reads `ai_provider` from AsyncStorage before every request and includes it as `aiProvider`. The settings screen (`app/screens/settings.tsx`) lets users pick their provider; preference is stored under the `ai_provider` key.

`PlantDetailsAiGenerated.tsx` also reads `ai_provider` from AsyncStorage and passes it to cache read/write calls so each provider's tips are cached independently.

### Gamification system (`logic/gamificationLogic.ts`)

Three Supabase tables power the gamification layer: `user_streaks`, `user_badges`, and `leaderboard`.

- `recordActivity()` — increments the current streak for today; skips if already recorded today, resets to 1 if last activity was not yesterday. No-op for unauthenticated users.
- `getStreakData()` → `StreakData` — returns `current_streak`, `longest_streak`, `last_activity_date`.
- `checkAndAwardBadges(ctx)` — upserts earned badges based on context flags: `collectionCount`, `hasHealthLog`, `hasPhoto`, `hasDiagnosis`, `hasListing`, plus streak thresholds from `user_streaks`. Uses `ignoreDuplicates: true` to avoid double-awarding.
- `getBadges(userId?)` → `EarnedBadge[]` — reads all earned badges for a user (defaults to current user).
- `updateLeaderboard()` — upserts the `leaderboard` row with current counts (score = `collectionCount×10 + streak×5 + badgeCount×20`).

`ALL_BADGES` constant (exported from `gamificationLogic.ts`) is the single source of truth for badge definitions (`key`, `emoji`, `name`, `description`). Both the awarding logic and the `BadgesSection` component read from it.

**Wiring in `PlantDetailsAiGenerated.tsx`**: `runGamification(ctx)` is a local async helper that calls `recordActivity()` → `checkAndAwardBadges(ctx)` → `updateLeaderboard()` (fire-and-forget, errors swallowed). It is triggered after successful `addToCollection` (passes `collectionCount`), after photo upload (passes `hasPhoto: true`), after diagnosis (passes `hasDiagnosis: true`), and after creating a marketplace listing (passes `hasListing: true`).

**Components**: `StreakBadge` (`components/StreakBadge.tsx`) — compact streak display (calls `getStreakData` on mount). `BadgesSection` (`components/BadgesSection.tsx`) — grid of all badge definitions; earned ones are highlighted (calls `getBadges` on mount). Both used on the profile screen.

### Anthropic API (watering suggestions)

`suggestWateringInterval(plantName)` in `logic/wateringLogic.ts` calls the Anthropic API **directly from the client** via `fetch` (not the Node.js SDK, which is incompatible with React Native). Uses model `claude-haiku-4-5-20251001`, `max_tokens: 100`, prompt: `"How many days between waterings for a ${plantName}? Reply with a single integer only, no other text."` — parses as integer; falls back to `7` if parsing fails or the key is missing. Key sourced from `EXPO_PUBLIC_ANTHROPIC_API_KEY`.

### Watering feature (`logic/wateringLogic.ts` + `components/WateringSection.tsx`)

`wateringLogic.ts` exports:
- `getWateringLog(plantName)` → `WateringEntry[]` — fetches last 20 entries ordered by `watered_at desc`; AsyncStorage fallback for unauthenticated users with backward-compat conversion from old `number[]` format
- `logWatering(plantName, amountMl?, notes?, wateredAt?)` → `Promise<WateringEntry | null>` — inserts row; then fire-and-forgets an update to `plant_collection.next_watering_date` if `watering_interval_days` is set
- `deleteWateringEntry(id)` — fire-and-forget delete
- `setWateringInterval(plantName, days)` — updates `plant_collection.watering_interval_days` and recalculates `next_watering_date` to `now() + days`
- `getWateringInterval(plantName)` → `WateringInterval` — reads both fields from `plant_collection`
- `suggestWateringInterval(plantName)` → `Promise<number>` — Anthropic Haiku call, returns 7 on any failure

`WateringSection` component (`components/WateringSection.tsx`) props: `{ plantName: string, isOwner: boolean }`. Renders inside `PlantDetailsAiGenerated` below the social section. Shows: schedule row (interval or "No schedule set") + "Set Schedule" button (isOwner); next watering date with color coding (red = overdue, amber = due today, green = future); "Log Watering" button (isOwner); history list with show-all toggle and per-entry delete (isOwner). Two modals: Set Schedule (custom days input + ✨ AI Suggest button) and Log Watering (date YYYY-MM-DD, amount ml, notes). No `Alert.alert` — uses `useToast()`.

`collection.tsx` shows a 💧 "Water due" badge on any card where `next_watering_date` is today or in the past.

### Toast system (`context/ToastContext.tsx`)

`ToastProvider` wraps the app in `_layout.tsx` (inside `ThemeProvider`). Renders an absolutely-positioned animated pill at `bottom: 90` (clears the tab bar). Colors: success `#059669`, error `#ef4444`, info `theme.accent`. Uses `FadeInDown`/`FadeOutDown` from `react-native-reanimated`. `toastKey` counter forces remount for back-to-back toasts. Auto-dismisses after 3000 ms.

Usage pattern: `const { showToast } = useToast();` then `showToast('message', 'success' | 'error' | 'info')`.

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

Detail screens (no ScreenLayout): `PlantDetailsAiGenerated.tsx`, `publicProfile.tsx`, `publicPlantDetail.tsx`, `editProfile.tsx`, `followersList.tsx`, `compare.tsx`, `leaderboard.tsx`, `feed.tsx`, `deathLog.tsx`, `notifications.tsx`, `auth.tsx`, `username.tsx`

All tab-screen scroll content should use `paddingBottom: 80` to clear the tab bar.

### Web compatibility

`Alert.alert` does not work on web. Any confirmation dialog must branch on `Platform.OS === 'web'` and use `window.confirm` on web, `Alert.alert` on native. See `settings.tsx` for the established pattern (`handleLogout`, `handleClearAllData`, `handleDeleteAccount`).

Watering history date input uses `TextInput` (not a native date picker) so it works on web. Watering reminders are hidden on web entirely (`Platform.OS !== 'web'` guard in `PlantDetailsAiGenerated.tsx`).

### Backend prompt engineering (`backend/src/index.ts`)

All providers are prompted to return strict JSON with `summary` and `details` keys (11 fields total). The response handler strips markdown code fences before `JSON.parse`. Unparseable JSON → 502; missing expected fields → 502; provider not configured → 503; invalid provider → 400; any other error → 500. If you modify the prompt, maintain this contract or update `fetchPlantTips.ts` parsing.

### Notifications

Android notification channel `watering-reminders` is registered in `app/_layout.tsx`. Watering reminders are not supported on web — `reminderLogic.ts` throws and `PlantDetailsAiGenerated.tsx` hides the reminder UI when `Platform.OS === 'web'`. Reminder options are 3, 7, 14, or 30 days (configurable in the `REMINDER_OPTIONS` constant at the top of `PlantDetailsAiGenerated.tsx`).

The `performLogout()` function in `settings.tsx` cancels all scheduled notifications (native only), clears AsyncStorage, then calls `supabase.auth.signOut()`. The `onAuthStateChange` listener in `_layout.tsx` handles the redirect automatically.

## Environment Variables

**Frontend (`.env` at root)**
```
EXPO_PUBLIC_API_URL=...                 # Backend URL exposed to client (must have EXPO_PUBLIC_ prefix)
EXPO_PUBLIC_SUPABASE_URL=...            # Supabase project URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=...       # Supabase anon/public key
EXPO_PUBLIC_ANTHROPIC_API_KEY=...       # Optional — powers AI watering interval suggestions (Haiku)
EXPO_PUBLIC_OPENWEATHER_API_KEY=...     # Optional — powers weather-aware seasonal advice (logic/locationLogic.ts); getCurrentWeather returns null without it
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
MOCK_MODE=...                # Optional — "true" disables all AI provider calls; every AI endpoint returns a fixed mock response (used for automated test runs)
```

## File Layout (non-obvious)

- `lib/supabase.ts` — Supabase client (auth storage uses AsyncStorage; imported by logic and screens)
- `context/ThemeContext.tsx` — `ThemeProvider`, `useThemePreference()` hook, `ThemePreference` type; persists preference to AsyncStorage under `theme_preference`
- `context/ToastContext.tsx` — `ToastProvider`, `useToast()` hook; global animated pill toast at `bottom: 90`; types: `'success' | 'error' | 'info'`
- `components/BottomTabBar.tsx` — 6-tab navigation bar; uses `useSegments()` for active detection
- `components/ScreenLayout.tsx` — wraps tab screens with BottomTabBar; do NOT use on detail screens
- `components/WateringSection.tsx` — self-contained watering UI: schedule, log watering modal, history; props `{ plantName, isOwner }`
- `components/PlantSocialSection.tsx` — likes and comments; props `{ plantOwnerUserId, plantName, currentUserId }`
- `components/PlantPhotoGallery.tsx` — photo carousel with upload, delete, set-primary; props `{ plantName, isOwner, onPhotoUploaded? }`; wraps `photoLogic.ts`
- `components/PlantDiagnosisButton.tsx` — image picker + diagnosis call; displays `DiagnosisResult` in a modal; props `{ plantName, onDiagnosed? }`
- `components/PlantChatSection.tsx` — persistent chat thread per plant (user ↔ AI); loads history via `chatLogic.ts`, sends messages to backend `/api/plant-chat`; props `{ plantName }`
- `components/BadgesSection.tsx` — renders all badges from `ALL_BADGES`; earned ones are highlighted; calls `getBadges` on mount; props `{ userId? }`
- `components/StreakBadge.tsx` — compact streak display (flame icon + count); calls `getStreakData` on mount
- `components/HealthLogSection.tsx` — health status log for a plant; props `{ plantName, isOwner }`
- `components/SeasonalAdviceSection.tsx` — displays `SeasonalAdvice` based on current season and location; props `{ plantDetails? }`
- `components/FeedItem.tsx` — renders a single `FeedItem` row in the social feed
- `logic/` — pure business logic (no UI imports):
  - `cacheLogic.ts` — AsyncStorage-backed plant details + image cache; all functions take `(plantName, provider)` as args
  - `historyLogic.ts` — pure functions: `sortHistoryByDate`, `toggleFavoriteLogic`, `removeHistoryItem`
  - `reminderLogic.ts` — Expo Notifications scheduling; uses AsyncStorage for notification IDs
  - `collectionLogic.ts` — Supabase `plant_collection` CRUD; `addToCollection` returns `{ success, error? }`; exports `migrateLocalCollectionToSupabase()`, `getPublicCollection(userId)`, `uploadPlantPhoto()`
  - `wateringLogic.ts` — `getWateringLog`, `logWatering` (returns entry, updates next_watering_date), `deleteWateringEntry`, `setWateringInterval`, `getWateringInterval`, `suggestWateringInterval` (Anthropic Haiku direct fetch)
  - `followLogic.ts` — Supabase `follows` table CRUD: `followUser`, `unfollowUser`, `isFollowing`, `getFollowerCount`, `getFollowingCount`
  - `socialLogic.ts` — `getLikes`, `toggleLike`, `getComments`, `addComment`, `deleteComment`; wraps `plant_likes` and `plant_comments` tables
  - `profileLogic.ts` — `uploadAvatar(uri)`, `updateBio(bio)`, `getProfileStats(userId)` (follower/following/plant/likes counts)
  - `gamificationLogic.ts` — `recordActivity`, `getStreakData`, `checkAndAwardBadges`, `getBadges`, `updateLeaderboard`; exports `ALL_BADGES` and types `BadgeDef`, `StreakData`, `EarnedBadge`
  - `photoLogic.ts` — `getPlantPhotos(plantName, userId?)`, `uploadPlantPhoto(plantName, uri, caption?)`, `deletePhoto(id, photoUrl)`, `setPrimaryPhoto(id, plantName, photoUrl)`; uploads to Supabase Storage bucket `plant-photos`; auto-sets first upload as primary and back-fills `plant_collection.photo_url`
  - `chatLogic.ts` — `getPlantChat(plantName)`, `saveChatMessage(plantName, role, content)`, `clearPlantChat(plantName)`; wraps `plant_chats` table; authenticated only
  - `diagnosisLogic.ts` — `diagnosePlant({ imageBase64, mimeType, plantName? })` → `DiagnosisResult`; calls backend `/api/plant-diagnosis`
  - `compareLogic.ts` — `comparePlants(plantA, plantB)` → `CompareResult`; calls backend `/api/plant-compare`; defaults provider to `gemini` except when `ai_provider` is `groq`
  - `listingLogic.ts` — `getMyListings`, `getMyListingForPlant`, `getListingsForUser`, `getActiveListings`, `createListing`, `deleteListing`, `toggleListing`; wraps `plant_listings` table
  - `deathLogLogic.ts` — `getDeathLog`, `addDeathEntry(plantName, cause?, notes?, ownedSince?)`, `deleteDeathEntry(id)`; wraps `plant_death_log` table; authenticated only
  - `healthLogLogic.ts` — `getHealthLog`, `addHealthEntry`, `getRecentHealthLogCounts`, `getAllHealthLogs`, `deleteHealthEntry`; wraps `plant_health_log` table (AsyncStorage fallback for unauthenticated users); plus `getHealthLogComments`, `addHealthLogComment`, `deleteHealthLogComment` wrapping `health_log_comments` (authenticated only)
  - `feedLogic.ts` — `getFeed(limitCount?)` → `FeedItem[]`; `formatActivityText(item)` — reads follow activity for the social feed
  - `notificationLogic.ts` — `getNotifications`, `markAllRead`, `getUnreadCount`; reads/updates the `notifications` table only — nothing in this codebase inserts rows (see note in Supabase tables above)
  - `locationLogic.ts` — `requestAndSaveLocation` (writes `profiles.latitude`/`longitude`/`location_updated_at`), `getSavedLocation`; `getCurrentWeather(lat, lon)` (OpenWeatherMap, needs `EXPO_PUBLIC_OPENWEATHER_API_KEY`, returns `null` without it), `getHemisphere(lat)`, `getCurrentSeason(lat)`
  - `seasonalAdviceLogic.ts` — `getSeasonalAdvice(plantDetails?)` — combines location + weather + current season to return `SeasonalAdvice`; `getSeasonEmoji(season)`
  - `potwLogic.ts` — `getCurrentNominations`, `nominatePlant`, `voteForNomination`, `getUserNominationThisWeek`; wraps Plant of the Week feature
- `utilities/` — API/network helpers:
  - `fetchPlantTips.ts` — reads `ai_provider` from AsyncStorage, calls backend `/api/plant-tips` with `{ plantName, aiProvider }`
  - `fetchPlantImage.ts` — queries Wikipedia REST API for thumbnails
  - `storage.ts` — Supabase `plant_history` CRUD; exports `getHistory`, `savePlant`, `deleteHistoryItem`, `clearHistory`, `setFavorite`
- `app/screens/` — all route screens:
  - `auth.tsx` — login / signup
  - `username.tsx` — post-signup username setup (saves to `auth.users` metadata)
  - `profile.tsx` — **view screen**: shows avatar, username, email, follower/following/plants stats, bio, Edit Profile button; collection grouped by status; uses ScreenLayout + useFocusEffect to refresh after edit; tapping follower/following counts navigates to `followersList`
  - `editProfile.tsx` — **edit screen**: TextInputs for username/bio/avatar URL, handleSave with validation; detail screen (no ScreenLayout, no tab bar)
  - `followersList.tsx` — followers or following list; params `{ userId, type: 'followers'|'following', username }`; two-step fetch (follow rows → profiles); optimistic follow toggle with rollback
  - `history.tsx` — search history with favourites filter; rich empty states with nav buttons to home
  - `collection.tsx` — plant collection with status filter (own / want / tried) and sort; 💧 overdue badge; rich empty state
  - `PlantDetailsAiGenerated.tsx` — care tips, collection management (status picker → "Save" → gamification), photo gallery (`PlantPhotoGallery`), diagnosis (`PlantDiagnosisButton`), chat (`PlantChatSection`), health log (`HealthLogSection`), seasonal advice (`SeasonalAdviceSection`), push reminders, marketplace listing modal, "Mark as Dead" modal, social section (`PlantSocialSection`), watering section (`WateringSection`); reads `ai_provider` from AsyncStorage for per-provider cache and provider badge; calls `runGamification()` on collection add, photo upload, diagnosis, and listing create
  - `settings.tsx` — profile quick-access card; APPEARANCE (light/dark/auto theme); REMINDERS; AI PROVIDER; ACCOUNT (Edit Profile, Log out, Delete Account); DATA (Clear Cache, Export Collection CSV, Clear all data); ABOUT; web-only back button
  - `discover.tsx` — Trending Plants horizontal scroll (via `get_trending_plants` RPC); Suggested Users section; Following Activity feed; Marketplace preview (`getActiveListings`); Plant of the Week nominations + voting (`potwLogic.ts`); debounced username search; navigates to publicProfile or PlantDetailsAiGenerated
  - `publicProfile.tsx` — public view of another user's profile and collection; follow/unfollow button
  - `compare.tsx` — side-by-side plant comparison; two text inputs → calls `compareLogic.comparePlants`; shows summary, category rows (label / plantA value / plantB value), and a verdict; "Compare again" / "Try again" resets the form
  - `leaderboard.tsx` — ranked list from `leaderboard` Supabase table; shows avatar, username, score, collection count, streak, badge count; own row is highlighted
  - `feed.tsx` — following activity feed using `feedLogic.getFeed`; renders `FeedItem` rows
  - `deathLog.tsx` — "plant graveyard"; lists `plant_death_log` entries; "Add" modal with cause, notes, owned-since
  - `notifications.tsx` — in-app notification list; marks all read on mount via `notificationLogic`
  - `publicPlantDetail.tsx` — read-only care tips view for a plant on another user's public profile
- `constants/` — static data and theme: `plants.ts` (PLANT_SUGGESTIONS, RANDOM_PLANTS), `theme.ts`
- `styles/` — separated StyleSheet files for larger screens
## Testing

All test files are in `__tests__/`. Run a single file: `npm test -- --testPathPattern=<name>`.

| File | What it covers |
|---|---|
| `history.test.ts` | `sortHistoryByDate`, `toggleFavoriteLogic` |
| `cacheLogic.test.ts` | `getPlantDetailsFromCache`, `savePlantDetailsToCache`, image cache three-state logic, per-provider cache isolation |
| `fetchPlantTips.test.ts` | `getPlantTips` — happy path, server errors, network errors; verifies `aiProvider` field is sent; mocks AsyncStorage and `expo/virtual/env` |
| `fetchPlantImage.test.ts` | Wikipedia image fetch — success, no image, network error |
| `reminderLogic.test.ts` | `scheduleWateringReminder`, `cancelWateringReminder`, `getWateringReminder`; mocks `expo-notifications` and `react-native` Platform |
| `utils.test.ts` | `csvField` CSV escaping (null, commas, newlines, quote-escaping); `dailyPlantHash` determinism and bounds |
| `collectionLogic.test.ts` | `getCollectionStats`, `getCollectionEntry`, `getPublicCollection`; mocks Supabase and AsyncStorage |
| `healthLogLogic.test.ts` | `getRecentHealthLogCounts`, `getAllHealthLogs`, `addHealthEntry`; authenticated and unauthenticated paths |
| `wateringLogic.test.ts` | `formatRelativeDate` (pure, Date.now pinned); `getWateringLog`, `logWatering`, `getWateringInterval` (Supabase + AsyncStorage fallback); `suggestWateringInterval` (fetch mock + `expo/virtual/env`) |
| `followLogic.test.ts` | `isFollowing`, `getFollowerCount`, `getFollowingCount`, `followUser`, `unfollowUser`; authenticated and unauthenticated paths |
| `socialLogic.test.ts` | `getLikes`, `toggleLike`, `getComments`, `addComment`; multi-table queries use `mockReturnValueOnce` per call |
| `profileLogic.test.ts` | `updateBio` (throws on unauth/error, resolves on success); `getProfileStats` (four parallel count queries); `uploadAvatar` not tested |
| `gamificationLogic.test.ts` | `recordActivity` (new streak, increment, reset, idempotent today); `checkAndAwardBadges` (badge conditions); `getStreakData`; `getBadges`; `updateLeaderboard` |
| `photoLogic.test.ts` | `getPlantPhotos`, `uploadPlantPhoto` (primary auto-set, collection back-fill), `deletePhoto`, `setPrimaryPhoto` |
| `chatLogic.test.ts` | `getPlantChat`, `saveChatMessage`, `clearPlantChat`; authenticated and unauthenticated paths |
| `diagnosisLogic.test.ts` | `diagnosePlant` — happy path, server error, network error |
| `compareLogic.test.ts` | `comparePlants` — happy path, provider selection, server error |
| `compare.test.tsx` | `CompareScreen` rendering, input → compare → result display, error state, "Compare again" / "Try again" reset |
| `StreakBadge.test.tsx` | `StreakBadge` renders streak count; loading and zero states |
| `BadgesSection.test.tsx` | `BadgesSection` renders all badge definitions; earned badges are visually distinct |
| `leaderboard.test.tsx` | `LeaderboardScreen` renders ranked rows; own row highlighted |
| `PlantPhotoGallery.test.tsx` | Gallery load, photo upload trigger, delete confirmation |
| `PlantDiagnosisButton.test.tsx` | Image picker flow, diagnosis result display, error handling |
| `PlantChatSection.test.tsx` | Chat load, send message, clear chat |
| `PlantDetailsGamification.test.tsx` | `recordActivity`, `checkAndAwardBadges`, `updateLeaderboard` called after successful `addToCollection`; not called on failure |

### Mock patterns used across Supabase test files

All Supabase-backed tests share a `mockQuery` / `makeChain` helper: a chainable object whose methods return `this`, making arbitrary call chains work without extra setup. The chain is awaitable via a custom `then` property so `await supabase.from(...)...` resolves to a controlled `{ data, error, count }` result. `single()` and `maybeSingle()` are separate jest mocks on the chain that can be overridden per test.

**`jest.resetAllMocks()` wipes AsyncStorage implementations.** After a reset, `AsyncStorage.getItem` returns `undefined` rather than reading the in-memory store. Tests that need to simulate stored data should mock `getItem` directly: `(AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(stored))`. Tests that need to verify a write happened should assert on `AsyncStorage.setItem` calls rather than reading back from storage.

**`expo/virtual/env` mock**: babel-preset-expo rewrites `process.env.EXPO_PUBLIC_*` reads at module level into imports from this virtual ESM module. Any test file for a module that reads such a variable must declare `jest.mock('expo/virtual/env', () => ({ env: process.env }))` before all other mocks. Using `process.env` (not a literal object) means `jest.isolateModules` + setting `process.env.EXPO_PUBLIC_*` before re-requiring the module controls what value the module captures on load.

**socialLogic multi-table pattern**: functions like `getLikes`, `getComments`, and `addComment` call `supabase.from()` 2–3 times with different table names. These tests use `mockFrom.mockReturnValueOnce(chain1).mockReturnValueOnce(chain2)` rather than a shared `mockReturnValue`, so each `from()` call gets an independent chain with its own result.

AsyncStorage is mocked via `@react-native-async-storage/async-storage/jest/async-storage-mock` in all tests that need it.

