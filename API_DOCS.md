# Sprayed Dashboard — API Documentation

## Overview

The Sprayed Dashboard runs an HTTP API server inside the Electron main process on **port 8002**. It accepts data pushes from external sources (e.g., AI Assistants) and serves data to the dashboard UI.

| Property | Value |
|---|---|
| **Base URL** | `http://localhost:8002` |
| **Network URL** | `http://<your-computer-name>:8002` |
| **Bind Address** | `0.0.0.0` (accepts connections from any interface) |
| **Content-Type** | `application/json` |
| **Max Body Size** | 16 KB |

---

## Authentication

| Endpoint | Auth Required |
|---|---|
| `GET` | No |
| `POST` | Yes (`x-api-key` header) |
| `DELETE` | Yes (`x-api-key` header) |

- API key is loaded from the `API_KEY` variable in `.env` via `dotenv`
- In **dev mode** (`--dev` flag), authentication is bypassed
- Key comparison uses `crypto.timingSafeEqual()` to prevent timing attacks
- Generate a new key:
  ```bash
  node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
  ```

---

## Endpoints

### 1. P2P Metrics

#### `GET /api/p2p-metrics`

Get all P2P metrics sorted by date ascending.

**Auth:** Not required

**Response `200 OK`:**
```json
[
  {
    "id": 1,
    "date": "2026-05-18",
    "month": "2026-05",
    "daily_value": 150,
    "created_at": "2026-05-18T10:30:00.000Z"
  }
]
```

---

#### `POST /api/p2p-metrics`

Push a new P2P data point.

**Auth:** Required (`x-api-key` header)

**Request Body:**
```json
{
  "date": "2026-05-18",
  "p2p_value": 150
}
```

**Response `201 Created`:**
```json
{
  "success": true,
  "id": 1,
  "message": "P2P metric saved successfully"
}
```

**Response `409 Conflict` (duplicate date):**
```json
{
  "error": "Duplicate entry for date \"2026-05-18\". A record already exists in p2p_metrics."
}
```

---

#### `DELETE /api/p2p-metrics`

Delete P2P records by date, ID, or truncate all records.

**Auth:** Required (`x-api-key` header)

**Query Parameters** (choose one):

| Parameter | Description |
|---|---|
| `?date=YYYY-MM-DD` | Delete record for a specific date |
| `?id=N` | Delete record by ID (takes priority if both `date` and `id` provided) |
| `?truncate=true&confirm=yes` | Delete **all** records (requires `confirm=yes`) |

**Response `200 OK` (delete by date):**
```json
{
  "success": true,
  "message": "Deleted record from P2P metric for date \"2026-05-18\""
}
```

**Response `200 OK` (truncate):**
```json
{
  "success": true,
  "message": "Truncated P2P metric — all records deleted"
}
```

**Response `404 Not Found`:**
```json
{
  "error": "No record found in p2p_metrics for date \"2026-05-18\""
}
```

**Response `400 Bad Request` (missing confirm):**
```json
{
  "error": "Missing or invalid confirm parameter. Use ?truncate=true&confirm=yes to proceed."
}
```

---

### 2. Seedling Metrics

#### `GET /api/seedling-metrics`

Get all Seedling metrics sorted by date ascending.

**Auth:** Not required

**Response `200 OK`:**
```json
[
  {
    "id": 1,
    "date": "2026-05-19",
    "month": "2026-05",
    "daily_value": 120,
    "created_at": "2026-05-19T11:00:00.000Z"
  }
]
```

---

#### `POST /api/seedling-metrics`

Push a new Seedling data point.

**Auth:** Required (`x-api-key` header)

**Request Body:**
```json
{
  "date": "2026-05-19",
  "seedling_value": 120
}
```

**Response `201 Created`:**
```json
{
  "success": true,
  "id": 1,
  "message": "Seedling metric saved successfully"
}
```

**Response `409 Conflict` (duplicate date):**
```json
{
  "error": "Duplicate entry for date \"2026-05-19\". A record already exists in seedling_metrics."
}
```

---

#### `DELETE /api/seedling-metrics`

Delete Seedling records by date, ID, or truncate all records.

**Auth:** Required (`x-api-key` header)

**Query Parameters** (same as P2P):

| Parameter | Description |
|---|---|
| `?date=YYYY-MM-DD` | Delete record for a specific date |
| `?id=N` | Delete record by ID |
| `?truncate=true&confirm=yes` | Delete **all** records |

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Deleted record from Seedling metric for date \"2026-05-19\""
}
```

---

## HTTP Status Codes

| Status | Code | When |
|---|---|---|
| `200` | OK | GET success, DELETE success |
| `201` | Created | POST success |
| `400` | Bad Request | Missing field, invalid date format, negative value, empty body, invalid JSON, missing query param |
| `401` | Unauthorized | Missing or wrong `x-api-key` header |
| `404` | Not Found | Unknown route, DELETE target not found |
| `405` | Method Not Allowed | Wrong HTTP method (e.g., PUT on a GET/POST/DELETE route) |
| `409` | Conflict | Duplicate date — record already exists for that date |
| `413` | Payload Too Large | Body exceeds 16 KB |
| `500` | Internal Server Error | Database or server failure |

---

## Validation Rules

| Rule | Detail |
|---|---|
| **Date format** | Must be `YYYY-MM-DD` (regex + calendar validation) |
| **Value** | Must be a non-negative finite number |
| **Body size** | Maximum 16 KB |
| **Duplicate dates** | Rejected with `409` (UNIQUE constraint on `date` column) |
| **Truncate safety** | Requires `?confirm=yes` — returns `400` without it |

---

## Database Schema

Both tables share the same schema:

```sql
CREATE TABLE p2p_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  month TEXT NOT NULL,
  daily_value REAL NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE seedling_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  month TEXT NOT NULL,
  daily_value REAL NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER | Auto-incrementing primary key |
| `date` | TEXT | Record date in `YYYY-MM-DD` format (UNIQUE) |
| `month` | TEXT | Cached year-month in `YYYY-MM` format |
| `daily_value` | REAL | Numeric value recorded for this date (≥ 0) |
| `created_at` | DATETIME | ISO-8601 timestamp of insertion |

---

## Example Requests (PowerShell)

### Push P2P Data
```powershell
Invoke-RestMethod -Uri http://localhost:8002/api/p2p-metrics `
  -Method POST `
  -Headers @{"Content-Type"="application/json"; "x-api-key"="<your-api-key>"} `
  -Body '{"date":"2026-05-18","p2p_value":150}'
```

### Push Seedling Data
```powershell
Invoke-RestMethod -Uri http://localhost:8002/api/seedling-metrics `
  -Method POST `
  -Headers @{"Content-Type"="application/json"; "x-api-key"="<your-api-key>"} `
  -Body '{"date":"2026-05-19","seedling_value":120}'
```

### Delete by Date
```powershell
Invoke-RestMethod -Uri "http://localhost:8002/api/p2p-metrics?date=2026-05-18" `
  -Method DELETE `
  -Headers @{"x-api-key"="<your-api-key>"}
```

### Delete by ID
```powershell
Invoke-RestMethod -Uri "http://localhost:8002/api/seedling-metrics?id=42" `
  -Method DELETE `
  -Headers @{"x-api-key"="<your-api-key>"}
```

### Truncate All Records
```powershell
Invoke-RestMethod -Uri "http://localhost:8002/api/p2p-metrics?truncate=true&confirm=yes" `
  -Method DELETE `
  -Headers @{"x-api-key"="<your-api-key>"}
```

### Get All Metrics
```powershell
Invoke-RestMethod -Uri http://localhost:8002/api/p2p-metrics -Method GET
```

---

## Notes

- `month` is auto-derived from `date` if not provided in the POST body
- `created_at` is set automatically by SQLite (`CURRENT_TIMESTAMP`)
- The API server binds to `0.0.0.0`, so it accepts connections from any network interface
- When a POST succeeds, the dashboard UI refreshes immediately via IPC push (plus a 30s polling fallback)
