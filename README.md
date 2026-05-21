# Sprayed Dashboard

A monitoring dashboard for tracking tree spraying data (P2P and Seedling), built with **Next.js 16 + Electron 42 + SQLite**. Displayed as 1 of 4 dashboards on a TV at 1920×1080 fullscreen.

**GitHub**: https://github.com/hamizahwahab/sprayed-dashboard

## Quick Start

```bash
# Install dependencies
npm install

# Run in development (Next.js + Electron fullscreen)
npm run electron:dev

# Run on custom port (for side-by-side with another dashboard)
npm run electron:dev:3001

# Build static export
npm run build

# Package portable .exe
npm run electron:build
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ HTTP Server  │  │ SQLite (sql) │  │ IPC Handlers  │  │
│  │  port 8002   │  │  sprayed.db  │  │  + Channels   │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                 │                   │          │
│         └─────────────────┼───────────────────┘          │
│                           │ contextBridge                │
└───────────────────────────┼──────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────┐
│              Next.js Renderer (Electron)                  │
│                           │                               │
│  ┌──────────────┐  ┌──────┴───────┐  ┌────────────────┐  │
│  │  page.tsx    │──│ chartUtils   │  │ AreaChartCard  │  │
│  │  (Dashboard) │  │ (pure utils) │  │ (Recharts)     │  │
│  └──────────────┘  └──────────────┘  └────────────────┘  │
│         │                                                  │
│         └── FooterSummary ── api.ts ── types/index.ts     │
└──────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.6 (App Router, static export) |
| Charts | Recharts 3.8.1 (Area charts) |
| Database | SQLite via sql.js 1.14.1 |
| Desktop | Electron 42 |
| Packaging | electron-builder 26 (portable .exe) |
| Styling | Tailwind CSS v4 + custom CSS classes |
| Testing | Jest 30 + ts-jest (12 tests) |

## Layout

```
┌──────────────────────────┬──────────────────────────┐
│  DAILY P2P SPRAYED       │  DAILY SEEDLING SPRAYED  │
│  [Area - Green]          │  [Area - Green]          │
│  31-day backward window  │  31-day backward window  │
│  Label: every 3rd day    │  Label: every 3rd day    │
│  (from SQLite DB)        │  (from SQLite DB)        │
├──────────────────────────┼──────────────────────────┤
│  MONTHLY P2P SPRAYED     │  MONTHLY SEEDLING SPRAYED│
│  [Area - Green]          │  [Area - Green]          │
│  12-month rolling window │  12-month rolling window │
│  (from SQLite DB)        │  (from SQLite DB)        │
├──────────┬───────────────┼──────────┬───────────────┤
│AVG DAILY │ AVG MONTH     │AVG DAILY │ AVG MONTH     │
│  (P2P)   │   (P2P)       │(Seedling)│ (Seedling)    │
└──────────┴───────────────┴──────────┴───────────────┘
```

## API Endpoints (Port 8002)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/p2p-metrics` | Get all P2P metrics | No |
| POST | `/api/p2p-metrics` | Push new P2P data point | x-api-key |
| DELETE | `/api/p2p-metrics?date=...` or `?id=N` | Delete a P2P record | x-api-key |
| DELETE | `/api/p2p-metrics?truncate=true&confirm=yes` | Wipe all P2P records | x-api-key |
| GET | `/api/seedling-metrics` | Get all Seedling metrics | No |
| POST | `/api/seedling-metrics` | Push new Seedling data point | x-api-key |
| DELETE | `/api/seedling-metrics?date=...` or `?id=N` | Delete a Seedling record | x-api-key |
| DELETE | `/api/seedling-metrics?truncate=true&confirm=yes` | Wipe all Seedling records | x-api-key |

### POST Payload

```json
{ "date": "2026-05-18", "p2p_value": 150 }
```

```json
{ "date": "2026-05-19", "seedling_value": 120 }
```

## Configuration

### API Key

Create a `.env` file in the project root:

```
API_KEY=your-secret-api-key-here
```

Generate a random key:
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

In dev mode (`--dev` flag), API key check is skipped.

### Custom Port

```bash
# Change Electron's Next.js dev server port
npm run electron:dev:3001

# Change API server port
HTTP_PORT=9000 npm run electron:dev
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Next.js dev server (port 3000) |
| `npm run build` | Static export to `out/` |
| `npm run lint` | ESLint on `src/` |
| `npm run test` | Jest test suite |
| `npm run electron:dev` | Dev server + Electron fullscreen |
| `npm run electron:dev:3001` | Dev server + Electron on port 3001 |
| `npm run electron:build` | Build + package portable `.exe` |
| `npm run electron:start` | Run Electron in production mode |
