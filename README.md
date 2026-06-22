# rootnote

A cross-platform botanical assistant app built with React Native/Expo. Search for any plant and get AI-generated care tips powered by five selectable AI providers, with a watering scheduler, plant photo gallery, AI diagnosis, persistent plant chat, gamification (streaks, badges, leaderboard), social features, a marketplace, and full cloud sync via Supabase.

## Features

- **AI plant care tips** — search any plant and get a summary plus 11 structured care fields (watering, light, fertilizer, care level, toxicity, fun fact, seasonal care, compatibility, propagation, pairing plants, troubleshooting)
- **Multi-provider AI** — switch between Gemini, Groq, DeepSeek, Qwen, and Moonshot in Settings; each provider's tips are cached independently
- **Plant collection** — mark plants as _Own it_, _Want it_, or _Tried it_; add ratings (1–5 stars), personal notes, and a full photo gallery
- **Multiple photos** — upload, caption, delete, and set a primary photo per plant; primary syncs back to the collection card thumbnail
- **AI plant diagnosis** — pick a photo and get an AI health assessment (issues, diagnosis, recommendations) via the backend
- **Plant chat** — persistent per-plant AI chat history stored in Supabase; continue conversations across sessions
- **Plant comparison** — compare any two plants side-by-side: summary, category rows (light, water, care level, etc.), and a verdict
- **Watering tracker** — set a watering schedule (days interval), log each watering with date, amount (ml), and notes, view history, and delete entries; the collection screen shows a 💧 badge on any plant that is due or overdue
- **AI watering suggestions** — tap "AI Suggest" in the schedule modal to get a recommended interval for your specific plant from Claude Haiku
- **Watering reminders** — schedule push notifications at 3, 7, 14, or 30-day intervals (iOS and Android; hidden on web)
- **Gamification** — earn badges (First Plant, Collector, Green Thumb, Photographer, Plant Doctor, Social Butterfly, streak badges), track daily activity streaks, and climb the global leaderboard (score = collection×10 + streak×5 + badges×20)
- **Seasonal advice** — care tips adapted to the user's current season and local weather (location-aware via `EXPO_PUBLIC_OPENWEATHER_API_KEY`)
- **Health log** — track plant health status over time with a per-plant log, with comments on each entry
- **Marketplace** — list plants for trade, gift, or sale; browse active listings; previewed on Discover
- **Plant of the Week** — nominate a plant and vote on others' nominations each week; ranked by vote count on Discover
- **Death log** — record plants that have died with cause and notes (plant graveyard)
- **Social** — like and comment on plants, follow other users, view follower/following lists, see a following activity feed, and view public profiles
- **Discover** — trending plants (by collection count), suggested users to follow, debounced username search, following activity feed, marketplace preview, Plant of the Week nominations
- **Notifications** — in-app notification list and unread badge (rows are populated by a Supabase trigger on social activity, not by the app itself)
- **Search history** — full browsing history with favourite toggling, search, and rich empty states
- **Light / dark / auto theme** — persisted preference via ThemeContext + AsyncStorage
- **Cloud sync** — all data stored in Supabase with RLS; unauthenticated users fall back to AsyncStorage
- **Export** — export collection as CSV from Settings

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React Native 0.79.6, Expo 53, Expo Router (file-based) |
| Styling | `StyleSheet.create()` with theme factory pattern; NativeWind on `PlantCareTips.tsx` only |
| Backend | Express 5.1, TypeScript, ts-node |
| AI (care tips, diagnosis, chat, compare) | Gemini, Groq, DeepSeek, Qwen, Moonshot — dispatched by backend |
| AI (watering suggestions) | Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) via direct fetch from client |
| Auth & DB | Supabase (PostgreSQL + RLS + Storage) |
| Local cache | AsyncStorage |

## Prerequisites

- Node.js 18+
- [Expo Go](https://expo.dev/go) or a configured Android/iOS emulator
- A [Supabase](https://supabase.com) project
- API keys for at least one AI provider (Gemini recommended for the backend)
- An [Anthropic API key](https://console.anthropic.com) for AI watering suggestions (optional — falls back to 7 days)
- An [OpenWeatherMap API key](https://openweathermap.org/api) for weather-aware seasonal advice (optional — feature is skipped without it)

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd rootnote
npm install
cd backend && npm install && cd ..
```

### 2. Configure environment variables

**Frontend** — create `.env` at the project root:

```env
EXPO_PUBLIC_API_URL=http://localhost:5000
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_ANTHROPIC_API_KEY=your_anthropic_key   # optional — powers AI watering suggestions
EXPO_PUBLIC_OPENWEATHER_API_KEY=your_openweather_key  # optional — powers weather-aware seasonal advice
```

**Backend** — create `backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_key          # optional
DEEPSEEK_API_KEY=your_deepseek_key  # optional
QWEN_API_KEY=your_qwen_key          # optional
MOONSHOT_API_KEY=your_moonshot_key  # optional
PORT=5000
ALLOWED_ORIGIN=http://localhost:8081
MOCK_MODE=false              # set to true to disable AI calls and return fixed mock responses (see Mock mode below)
```

### 3. Set up Supabase

Run the following in the Supabase SQL editor:

```sql
-- Core tables (if not already created)
create table plant_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plant_name text not null,
  summary text not null,
  details jsonb,
  is_favorite boolean default false,
  last_viewed timestamptz default now()
);

create table plant_collection (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plant_name text not null,
  summary text not null,
  details jsonb,
  added_at timestamptz default now(),
  status text not null check (status in ('own','want','tried')) default 'own',
  rating integer check (rating between 1 and 5),
  notes text,
  photo_url text,
  watering_interval_days integer,
  next_watering_date timestamptz,
  constraint plant_collection_user_plant_unique unique (user_id, plant_name)
);

create table watering_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plant_name text not null,
  watered_at timestamptz not null default now(),
  amount_ml integer,
  notes text
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  bio text,
  avatar_url text,
  updated_at timestamptz default now()
);

create table follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid references auth.users(id) on delete cascade not null,
  following_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  constraint follows_unique unique (follower_id, following_id)
);

-- RLS
alter table plant_history enable row level security;
alter table plant_collection enable row level security;
alter table watering_log enable row level security;
alter table profiles enable row level security;
alter table follows enable row level security;

create policy "own rows only" on plant_history for all using (auth.uid() = user_id);
create policy "own rows only" on plant_collection for all using (auth.uid() = user_id);
create policy "own rows only" on watering_log for all using (auth.uid() = user_id);
create policy "own rows only" on profiles for all using (auth.uid() = id);
create policy "own follows only" on follows for all using (auth.uid() = follower_id);

-- Public read policies
create policy "public read" on profiles for select using (true);
create policy "public read" on plant_collection for select using (true);
create policy "public read" on follows for select using (true);

-- RPCs
create or replace function get_trending_plants(limit_count int default 10)
returns table(plant_name text, collection_count bigint)
language sql security definer as $$
  select plant_name, count(*) as collection_count
  from plant_collection
  group by plant_name
  order by collection_count desc
  limit limit_count;
$$;

create or replace function delete_user()
returns void language plpgsql security definer as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;
```

Also create the gamification, photo, chat, listing, and death log tables:

```sql
-- Gamification
create table user_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_activity_date date
);
alter table user_streaks enable row level security;
create policy "own rows only" on user_streaks for all using (auth.uid() = user_id);

create table user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  badge_key text not null,
  earned_at timestamptz default now(),
  constraint user_badges_unique unique (user_id, badge_key)
);
alter table user_badges enable row level security;
create policy "own rows only" on user_badges for all using (auth.uid() = user_id);
create policy "public read" on user_badges for select using (true);

create table leaderboard (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_url text,
  collection_count integer default 0,
  streak integer default 0,
  badge_count integer default 0,
  score integer default 0,
  updated_at timestamptz default now()
);
alter table leaderboard enable row level security;
create policy "own rows only" on leaderboard for all using (auth.uid() = user_id);
create policy "public read" on leaderboard for select using (true);

-- Photos
create table plant_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plant_name text not null,
  photo_url text not null,
  caption text,
  taken_at timestamptz default now(),
  is_primary boolean default false
);
alter table plant_photos enable row level security;
create policy "own rows only" on plant_photos for all using (auth.uid() = user_id);
create policy "public read" on plant_photos for select using (true);

-- Chat
create table plant_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plant_name text not null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz default now()
);
alter table plant_chats enable row level security;
create policy "own rows only" on plant_chats for all using (auth.uid() = user_id);

-- Marketplace
create table plant_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plant_name text not null,
  listing_type text not null check (listing_type in ('trade','gift','sell')),
  price integer,
  description text,
  is_active boolean default true,
  created_at timestamptz default now()
);
alter table plant_listings enable row level security;
create policy "own rows only" on plant_listings for all using (auth.uid() = user_id);
create policy "public read" on plant_listings for select using (true);

-- Death log
create table plant_death_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plant_name text not null,
  cause text,
  notes text,
  died_at timestamptz default now(),
  owned_since timestamptz
);
alter table plant_death_log enable row level security;
create policy "own rows only" on plant_death_log for all using (auth.uid() = user_id);
```

Also create the health log, social, notifications, and Plant of the Week tables:

```sql
-- Health log (column is singular `note`, not `status`/`notes`)
create table plant_health_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plant_name text not null,
  note text not null,
  logged_at timestamptz default now()
);
alter table plant_health_log enable row level security;
create policy "own rows only" on plant_health_log for all using (auth.uid() = user_id);

create table health_log_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  health_log_id uuid references plant_health_log(id) on delete cascade not null,
  body text not null,
  created_at timestamptz default now()
);
alter table health_log_comments enable row level security;
create policy "own rows only" on health_log_comments for all using (auth.uid() = user_id);
create policy "public read" on health_log_comments for select using (true);

-- Social: likes + comments
create table plant_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plant_owner_id uuid references auth.users(id) on delete cascade not null,
  plant_name text not null,
  created_at timestamptz default now(),
  constraint plant_likes_unique unique (user_id, plant_owner_id, plant_name)
);
alter table plant_likes enable row level security;
create policy "own rows only" on plant_likes for all using (auth.uid() = user_id);
create policy "public read" on plant_likes for select using (true);

create table plant_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plant_owner_id uuid references auth.users(id) on delete cascade not null,
  plant_name text not null,
  body text not null,
  created_at timestamptz default now()
);
alter table plant_comments enable row level security;
create policy "own rows only" on plant_comments for all using (auth.uid() = user_id);
create policy "public read" on plant_comments for select using (true);

-- In-app notifications — rows must be inserted by a trigger/function on follows/likes/comments
-- (not included here); without one, the notifications screen stays empty.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  actor_id uuid references auth.users(id) on delete cascade not null,
  type text not null,
  read boolean default false,
  created_at timestamptz default now()
);
alter table notifications enable row level security;
create policy "own rows only" on notifications for all using (auth.uid() = user_id);

-- Plant of the Week
create table potw_nominations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plant_name text not null,
  reason text,
  week_start date not null
);
alter table potw_nominations enable row level security;
create policy "own rows only" on potw_nominations for all using (auth.uid() = user_id);
create policy "public read" on potw_nominations for select using (true);

create table potw_votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  nomination_id uuid references potw_nominations(id) on delete cascade not null,
  week_start date not null,
  constraint potw_votes_unique unique (user_id, nomination_id)
);
alter table potw_votes enable row level security;
create policy "own rows only" on potw_votes for all using (auth.uid() = user_id);
create policy "public read" on potw_votes for select using (true);
```

If upgrading an existing database:

```sql
-- Add watering columns if missing
ALTER TABLE watering_log ADD COLUMN IF NOT EXISTS amount_ml integer;
ALTER TABLE watering_log ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE plant_collection ADD COLUMN IF NOT EXISTS watering_interval_days integer;
ALTER TABLE plant_collection ADD COLUMN IF NOT EXISTS next_watering_date timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;
```

Create two Supabase Storage buckets: `plant-photos` and `avatars` (both public).

### 4. Start the backend

```bash
cd backend
npm run dev
```

Verify with `GET /health` → `{ "status": "ok" }`.

### 5. Start the frontend

```bash
npm start          # Expo dev server — scan QR with Expo Go, or press a/i/w
npm run android
npm run ios
npm run web
```

## Local Development

### Running the full stack locally
1. Start the backend: `cd backend && npm run dev` — verify with `GET http://localhost:5000/health`
2. Start the frontend: `npm start` then press `w` for web, `a` for Android, `i` for iOS
3. Set `EXPO_PUBLIC_API_URL=http://localhost:5000` in `.env` (not the deployed Render URL)

### Recommended AI provider for local development
Use **Groq** for local development and testing — it has a generous free tier and does not rate limit aggressively. Set it in Settings or add to AsyncStorage. Avoid Gemini for repeated/automated runs.

### Mock mode for automated testing
Set `MOCK_MODE=true` in `backend/.env` to disable all AI provider calls. The `/api/plant-tips` endpoint returns a fixed realistic response instantly — no rate limits, no cold starts, free to run repeatedly. Use this for automated test runs. Set `MOCK_MODE=false` for integration tests that verify the real AI contract.

### Backend cold starts (Render free tier)
The deployed backend sleeps after inactivity. Always run the backend locally for development and testing. If using the deployed URL, hit `GET /health` first and wait for a 200 before running tests.

## Project Structure

```
rootnote/
├── app/
│   ├── _layout.tsx                       # Root layout — ThemeProvider, ToastProvider, auth listener, notification channel
│   ├── index.tsx                         # Home / search screen
│   └── screens/
│       ├── PlantDetailsAiGenerated.tsx   # Care tips, photos, diagnosis, chat, collection, gamification, watering, social
│       ├── collection.tsx                # Collection with status filter, 💧 overdue badge
│       ├── history.tsx                   # Search history with favourites filter
│       ├── discover.tsx                  # Trending plants, suggested users, activity feed, marketplace preview, Plant of the Week, user search
│       ├── profile.tsx                   # Own profile — stats, streaks, badges, collection, follow counts
│       ├── publicProfile.tsx             # Another user's public profile + follow button
│       ├── publicPlantDetail.tsx         # Read-only care tips from a public profile
│       ├── editProfile.tsx               # Edit username, bio, avatar
│       ├── followersList.tsx             # Followers / following list with follow toggles
│       ├── compare.tsx                   # Side-by-side plant comparison
│       ├── leaderboard.tsx               # Global leaderboard ranked by score
│       ├── feed.tsx                      # Following activity feed
│       ├── deathLog.tsx                  # Plant graveyard — records of deceased plants
│       ├── notifications.tsx             # In-app notification list
│       ├── settings.tsx                  # Theme, AI provider, reminders, account, data
│       ├── auth.tsx                      # Login / sign-up
│       └── username.tsx                  # Post-signup username setup
├── backend/
│   └── src/index.ts                      # Express server — /health + 4 POST endpoints
├── components/
│   ├── WateringSection.tsx               # Watering schedule, log, history
│   ├── PlantSocialSection.tsx            # Likes + comments
│   ├── PlantPhotoGallery.tsx             # Multi-photo carousel with upload/delete/primary
│   ├── PlantDiagnosisButton.tsx          # Image picker + AI health diagnosis
│   ├── PlantChatSection.tsx              # Persistent per-plant AI chat
│   ├── BadgesSection.tsx                 # Badge grid (earned vs locked)
│   ├── StreakBadge.tsx                   # Compact daily streak display
│   ├── HealthLogSection.tsx              # Plant health status log
│   ├── SeasonalAdviceSection.tsx         # Season + weather-aware care tips
│   ├── BottomTabBar.tsx                  # 6-tab navigation bar
│   ├── ScreenLayout.tsx                  # Wraps tab screens with BottomTabBar
│   ├── SkeletonLoader.tsx
│   ├── FeedItem.tsx
│   └── PlantCareTips.tsx
├── context/
│   ├── ThemeContext.tsx                  # Light/dark/auto preference, useTheme, useThemePreference
│   └── ToastContext.tsx                  # Global toast notifications, useToast
├── constants/
│   ├── theme.ts                          # lightTheme, darkTheme, Theme type
│   └── plants.ts                         # PLANT_SUGGESTIONS, RANDOM_PLANTS
├── logic/
│   ├── wateringLogic.ts                  # Watering log, schedule, AI interval suggestion
│   ├── collectionLogic.ts                # plant_collection CRUD + migration
│   ├── cacheLogic.ts                     # Per-provider AI tips cache + image cache
│   ├── historyLogic.ts                   # Sort, toggle favourite, remove history item
│   ├── reminderLogic.ts                  # Expo Notifications scheduling
│   ├── followLogic.ts                    # follows table CRUD
│   ├── socialLogic.ts                    # Likes and comments
│   ├── profileLogic.ts                   # Avatar upload, bio update, profile stats
│   ├── gamificationLogic.ts              # Streaks, badges, leaderboard
│   ├── photoLogic.ts                     # Multi-photo upload/delete/primary (Supabase Storage)
│   ├── chatLogic.ts                      # Persistent plant chat history
│   ├── diagnosisLogic.ts                 # AI plant health diagnosis
│   ├── compareLogic.ts                   # Side-by-side plant comparison
│   ├── listingLogic.ts                   # Marketplace listings
│   ├── deathLogLogic.ts                  # Plant death log
│   ├── healthLogLogic.ts                 # Health status log
│   ├── feedLogic.ts                      # Following activity feed
│   ├── notificationLogic.ts              # In-app notifications
│   ├── locationLogic.ts                  # Location + weather
│   ├── seasonalAdviceLogic.ts            # Season-aware care advice
│   └── potwLogic.ts                      # Plant of the Week nominations + voting
├── utilities/
│   ├── fetchPlantTips.ts                 # Calls backend /api/plant-tips
│   ├── fetchPlantImage.ts                # Wikipedia thumbnail fetch
│   └── storage.ts                        # plant_history CRUD
├── types.ts                              # PlantDetails, PlantEntry, CollectionEntry, OwnershipStatus
└── __tests__/                            # Jest test suite (25 test files)
```

## Backend API

When `MOCK_MODE=true` (`backend/.env`), every endpoint below except `/health` skips the AI provider call and returns a fixed mock response instantly — see [Mock mode for automated testing](#mock-mode-for-automated-testing).

### `GET /health`

Returns `{ "status": "ok" }`.

### `POST /api/plant-tips`

Rate-limited to 10 requests per IP per minute.

**Request body:**
```json
{ "plantName": "Monstera Deliciosa", "aiProvider": "gemini" }
```

`aiProvider` values: `gemini` · `groq` · `deepseek` · `qwen` · `moonshot`

**Success response (200):**
```json
{
  "summary": "...",
  "details": {
    "watering": "...", "light": "...", "fertilizer": "...",
    "careLevel": "easy|medium|hard", "funFact": "...", "toxicity": "...",
    "seasonalCare": "...", "compatibility": "...", "pairingPlants": "...",
    "propagation": "...", "troubleshooting": "..."
  }
}
```

**Error responses:** `400` invalid provider · `429` rate limited · `502` unparseable AI response · `503` provider key not configured · `500` other error

### `POST /api/plant-diagnosis`

**Request body:** `{ "imageBase64": "...", "mimeType": "image/jpeg", "plantName": "Monstera" }`

**Success response (200):** `{ "healthy": bool, "issues": [...], "diagnosis": "...", "recommendations": [...] }`

### `POST /api/plant-chat`

**Request body:** `{ "plantName": "...", "message": "...", "history": [...] }`

**Success response (200):** `{ "reply": "..." }`

### `POST /api/plant-compare`

**Request body:** `{ "plantA": "Monstera", "plantB": "Pothos", "aiProvider": "gemini" }`

**Success response (200):** `{ "summary": "...", "categories": [{ "label": "...", "plantA": "...", "plantB": "..." }], "verdict": "..." }`

## Running Tests

```bash
npm test                                    # all tests
npm test -- --testPathPattern=history      # single file
```

| Test file | Coverage |
|---|---|
| `history.test.ts` | `sortHistoryByDate`, `toggleFavoriteLogic` |
| `cacheLogic.test.ts` | Per-provider cache isolation, image three-state logic |
| `fetchPlantTips.test.ts` | `getPlantTips` — happy path, errors, `aiProvider` field |
| `fetchPlantImage.test.ts` | Wikipedia image fetch — success, no image, network error |
| `reminderLogic.test.ts` | Schedule, cancel, and get watering reminders |
| `utils.test.ts` | `csvField` CSV escaping; `dailyPlantHash` determinism and bounds |
| `collectionLogic.test.ts` | `getCollectionStats`, `getCollectionEntry`, `getPublicCollection` |
| `healthLogLogic.test.ts` | `getRecentHealthLogCounts`, `getAllHealthLogs`, `addHealthEntry` |
| `wateringLogic.test.ts` | `formatRelativeDate`; `getWateringLog`, `logWatering`, `getWateringInterval`, `suggestWateringInterval` |
| `followLogic.test.ts` | `isFollowing`, `getFollowerCount`, `getFollowingCount`, `followUser`, `unfollowUser` |
| `socialLogic.test.ts` | `getLikes`, `toggleLike`, `getComments`, `addComment` |
| `profileLogic.test.ts` | `updateBio`, `getProfileStats` |
| `gamificationLogic.test.ts` | `recordActivity`, `checkAndAwardBadges`, `getStreakData`, `getBadges`, `updateLeaderboard` |
| `photoLogic.test.ts` | `getPlantPhotos`, `uploadPlantPhoto`, `deletePhoto`, `setPrimaryPhoto` |
| `chatLogic.test.ts` | `getPlantChat`, `saveChatMessage`, `clearPlantChat` |
| `diagnosisLogic.test.ts` | `diagnosePlant` — happy path, server error, network error |
| `compareLogic.test.ts` | `comparePlants` — happy path, provider selection, server error |
| `compare.test.tsx` | `CompareScreen` — rendering, compare flow, error state, reset |
| `StreakBadge.test.tsx` | `StreakBadge` — renders streak count; loading and zero states |
| `BadgesSection.test.tsx` | `BadgesSection` — all badges rendered; earned vs locked distinction |
| `leaderboard.test.tsx` | `LeaderboardScreen` — ranked rows, own row highlighted |
| `PlantPhotoGallery.test.tsx` | Gallery load, upload trigger, delete confirmation |
| `PlantDiagnosisButton.test.tsx` | Image picker flow, diagnosis result display, error handling |
| `PlantChatSection.test.tsx` | Chat load, send message, clear chat |
| `PlantDetailsGamification.test.tsx` | Gamification wiring — `recordActivity`, `checkAndAwardBadges`, `updateLeaderboard` called/not called on collection add |

## Testing Strategy

| Layer | Tool | Purpose |
|---|---|---|
| Unit | Jest | Logic functions, pure utilities |
| E2E web | Playwright + mock mode | UI flows, navigation, rendering |
| Integration | Playwright + real AI | AI response contract, field validation |
| Mobile E2E | Appium | Native flows on device/simulator |

### Unit tests
```bash
npm test                                        # all tests (25 suites)
npm test -- --testPathPattern=wateringLogic    # single suite
```

### Playwright (web E2E)
Requires the frontend running on web and the backend running locally with `MOCK_MODE=true`.
```bash
npm run web                                    # terminal 1
cd backend && MOCK_MODE=true npm run dev       # terminal 2
npx playwright test                            # terminal 3
```

### testID convention
Every interactive element and every key output element must have a `testID` prop added at build time — not retrofitted later. On Expo web, `testID` renders as `data-testid` and is the only reliable selector strategy.

Never place `testID` on `Animated.View` — it does not render to the DOM reliably on Expo web. Use a plain `View` wrapper instead.

## Docker

```bash
docker build -t rootnote .
docker run -p 19000:19000 -p 19001:19001 -p 19002:19002 rootnote
```

## Notes

- **Watering reminders** are not supported on web — the reminder UI is hidden automatically.
- **AI watering suggestions** call Anthropic Claude Haiku directly from the client (no backend proxy). If `EXPO_PUBLIC_ANTHROPIC_API_KEY` is not set, the feature gracefully falls back to suggesting 7 days.
- **Web compatibility** — `Alert.alert` does not work on web; all confirmation dialogs branch on `Platform.OS === 'web'`. Watering history date input uses `TextInput` rather than a native date picker.
- The backend is **stateless** — every cache miss triggers an AI provider call. Cache keys are per-provider so switching providers always fetches fresh tips.
- Wikipedia thumbnails use a three-state cache: `undefined` = not fetched, `null` = no image available, string = cached URL.
- **Gamification** is wired into `PlantDetailsAiGenerated` — `recordActivity`, `checkAndAwardBadges`, and `updateLeaderboard` run fire-and-forget after adding to collection, uploading a photo, completing a diagnosis, and creating a marketplace listing.
- **Plant photos** are stored in the `plant-photos` Supabase Storage bucket. The first photo uploaded for a plant is automatically set as primary and its URL is back-filled into `plant_collection.photo_url`.
- **Notifications are read-only from the app.** `notificationLogic.ts` never inserts into the `notifications` table — rows must come from a Supabase trigger/function on `follows` / `plant_likes` / `plant_comments` inserts. Without that trigger configured, the notifications screen and unread badge stay empty.
- **Seasonal advice** falls back gracefully without location/weather data: `getCurrentWeather` returns `null` if `EXPO_PUBLIC_OPENWEATHER_API_KEY` is unset or the request fails, and `requestAndSaveLocation` returns `null` if location permission is denied.
