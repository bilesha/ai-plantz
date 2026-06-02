# ai-plantz

A cross-platform botanical assistant app built with React Native/Expo. Search for any plant and get AI-generated care tips powered by Google Gemini, with watering reminders, a personal plant collection, and search history.

## Features

- **AI plant care tips** — search any plant name and receive a summary plus structured watering, light, and fertilizer guidance from Gemini 1.5 Flash
- **Plant collection** — mark plants as _Own it_, _Want it_, or _Tried it_, add personal notes, and log watering events
- **Watering reminders** — schedule push notifications at 3, 7, 14, or 30-day intervals (iOS and Android)
- **Search history** — last 10 searches persisted locally, with favourite toggling
- **Client-side caching** — plant details and Wikipedia thumbnail images are cached in AsyncStorage to avoid redundant API calls
- **Auth** — Supabase email/password authentication with session-gated navigation

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React Native 0.79.6, Expo 53, Expo Router (file-based) |
| Styling | NativeWind + Tailwind CSS, `StyleSheet.create()` with theme factory |
| Backend | Express 5.1, TypeScript, ts-node |
| AI | Google Gemini 1.5 Flash via `@google/generative-ai` |
| Auth & DB | Supabase |
| Persistence | AsyncStorage (client-side only) |

## Prerequisites

- Node.js 18+
- An [Expo Go](https://expo.dev/go) app on your device, or a configured Android/iOS emulator
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)
- A [Supabase](https://supabase.com) project

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd ai-plantz
npm install
cd backend && npm install && cd ..
```

### 2. Configure environment variables

**Frontend** — create `.env` at the project root:

```env
EXPO_PUBLIC_API_URL=http://localhost:5000
```

**Backend** — create `backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
PORT=5000
ALLOWED_ORIGIN=http://localhost:8081
```

### 3. Start the backend

```bash
cd backend
npm run dev
```

The server starts on `http://localhost:5000`. Verify it with `GET /health`.

### 4. Start the frontend

```bash
npm start          # Expo dev server — scan QR code with Expo Go, or press a/i/w
npm run android    # Android emulator
npm run ios        # iOS simulator
npm run web        # Browser
```

## Project Structure

```
ai-plantz/
├── app/
│   ├── _layout.tsx          # Root layout, notification channel setup
│   ├── index.tsx            # Home / search screen
│   └── screens/
│       ├── PlantDetailsAiGenerated.tsx   # AI tips, reminders, collection
│       ├── history.tsx      # Search history
│       ├── collection.tsx   # Personal plant collection
│       ├── settings.tsx
│       ├── auth.tsx         # Login / sign-up
│       └── username.tsx     # Username setup
├── backend/
│   └── src/index.ts         # Express server — /health, /api/plant-tips
├── components/              # Shared UI components (SkeletonLoader, etc.)
├── constants/               # theme.ts, plants.ts (suggestions & random picks)
├── logic/                   # Pure business logic (no UI imports)
│   ├── cacheLogic.ts
│   ├── historyLogic.ts
│   ├── reminderLogic.ts
│   ├── collectionLogic.ts
│   └── wateringLogic.ts
├── utilities/               # API/network helpers
│   ├── fetchPlantTips.ts
│   ├── fetchPlantImage.ts
│   └── storage.ts
├── types.ts                 # Shared TypeScript types
└── __tests__/               # Jest test suite
```

## Backend API

### `GET /health`

Returns `{ "status": "ok" }`. Used by load balancers and uptime monitors.

### `POST /api/plant-tips`

Rate-limited to 10 requests per IP per minute.

**Request body:**
```json
{ "plantName": "Monstera Deliciosa" }
```

**Success response (200):**
```json
{
  "summary": "A brief, engaging one-sentence care summary.",
  "details": {
    "watering": "...",
    "light": "...",
    "fertilizer": "..."
  }
}
```

**Error responses:** `400` invalid input · `429` rate limited · `500` AI service error · `502` unparseable AI response

## Running Tests

```bash
npm test                                          # all tests
npm test -- --testPathPattern=history            # single file
```

| Test file | Coverage |
|---|---|
| `history.test.ts` | `sortHistoryByDate`, `toggleFavoriteLogic` |
| `cacheLogic.test.ts` | Plant detail cache, image cache three-state logic |
| `fetchPlantTips.test.ts` | `getPlantTips` — happy path, server errors, network errors |
| `reminderLogic.test.ts` | Schedule, cancel, and get watering reminders |

## Docker

Build and run the Expo dev server in a container (uses tunnel mode):

```bash
docker build -t ai-plantz .
docker run -p 19000:19000 -p 19001:19001 -p 19002:19002 ai-plantz
```

## Notes

- Watering reminders are **not supported on web** — the reminder UI is hidden automatically when `Platform.OS === 'web'`.
- The backend is **stateless** — every cache miss on the client triggers a Gemini API call.
- Wikipedia thumbnails are fetched client-side and cached with a three-state model: `undefined` = not fetched, `null` = no image available, string = cached URL.
