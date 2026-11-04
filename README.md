# MedTrack - Medication & Health Stock Tracking Web App

A clean, modern, single-page web application for tracking medication inventory, monitoring low-stock thresholds with reorder alerts, and managing weekly dosette / pill box packing checklists.

Built with **Node.js**, **Express**, **SQLite** (`better-sqlite3`), and an **AngularJS** single-page frontend.

---

## Features

1. **Medication Inventory Tracking**
   - Track medication names, dosages (e.g. `20 mg`, `100 mcg/puff`), forms (`tablet`, `capsule`, `inhaler`, `liquid`, `nasal spray`, `drops`, `patch`, `injection`, `other`), current stock counts, pack sizes, and daily scheduling instructions.
   - Set custom reorder thresholds per medication with visual progress bars indicating safety levels (green = healthy, amber = near threshold, red = at or below threshold).
   - Quick one-click stock adjustments:
     - `-1 Dose`: deduct 1 unit immediately from inventory.
     - `+ Pack`: instantly add full prescription pack count.
     - `± Custom`: enter exact positive or negative quantity adjustments with audit notes.

2. **Reorder Alerts & Header Summary**
   - Header summary dashboard displaying total medications, items requiring pharmacy reorder, and total dosette box items.
   - Prominent alert section at the top of the inventory view spotlighting all items currently at or below their reorder threshold with direct one-click `+ Restock` buttons.
   - Filter items quickly by All, Low Stock Only, or Dosette Only, or use live search across names, dosages, and forms.

3. **Weekly Pill Box / Dosette Checklist Mode**
   - Flag medications as "Dosette / Weekly Box" items and assign them to specific compartment times:
     - Morning
     - Noon
     - Evening
     - Bedtime
   - Dedicated interactive packing view organized by days of the week (Monday through Sunday) and compartment times.
   - Interactive checkboxes allowing you to check off medicines as you fill your pill organizer compartments. State persists across page refreshes via browser `localStorage`.
   - "Pack Week (-7 Days Stock)" action: automatically deducts one week of required doses across all dosette items directly from inventory.
   - Quick action to reset all weekly checkmarks when starting a fresh week.

4. **Modern Dark-Mode UI**
   - Slate / dark-mode theme designed for high contrast and readability.
   - Full responsive layout with accessible modals, toast notifications, and clear visual status indicators.

---

## Project Structure

```text
├── data/                    # SQLite database storage (medications.db)
├── public/                  # AngularJS Single-Page Frontend
│   ├── css/
│   │   └── style.css        # Clean dark-mode UI stylesheet
│   ├── js/
│   │   ├── angular.min.js   # Local AngularJS library (1.8.2)
│   │   └── app.js           # AngularJS application controller & logic
│   └── index.html           # Single-page interface & template
├── server/
│   ├── app.js               # Express application and REST API endpoints
│   ├── db.js                # SQLite database setup, migrations & sample seeds
│   └── index.js             # HTTP server entry point
├── test/
│   └── api.test.js          # Supertest & Mocha test suite
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm

### Installation
Clone the repository and install dependencies:
```bash
npm install
```

### Running the Application
Start the server in production mode:
```bash
npm start
```
Or start in development mode with automatic restarts:
```bash
npm run dev
```

Open your browser and navigate to:
```
http://localhost:3000
```

---

## Testing

Run the automated backend test suite (Mocha + Supertest):
```bash
npm test
```

The tests cover:
- Database initialization and pre-seeded medication data
- Stats calculation (`/api/stats`)
- Full CRUD lifecycle on medication items
- Threshold edge cases and low-stock filters
- Dose deduction (`-1 Dose`) and pack addition (`+ Pack`)
- Negative stock protection (stock cannot go below 0)
- Weekly dosette batch deduction (`/api/dosette/pack-week`)

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stats` | Returns inventory summary (`total`, `lowStock`, `dosetteCount`) |
| `GET` | `/api/medications` | Lists medications. Supports `?q=`, `?lowStockOnly=true`, `?dosetteOnly=true` |
| `GET` | `/api/medications/:id` | Returns single medication details |
| `POST` | `/api/medications` | Creates a new medication |
| `PUT` | `/api/medications/:id` | Updates medication details and dosette settings |
| `DELETE` | `/api/medications/:id` | Deletes a medication and logs |
| `POST` | `/api/medications/:id/adjust-stock` | Adjusts stock (`{ type: 'dose'|'pack'|'custom', amount, note }`) |
| `POST` | `/api/dosette/pack-week` | Deducts 7 days of scheduled dosette doses from inventory |

---

## Database Schema

### `medications`
- `id` (INTEGER PRIMARY KEY)
- `name` (TEXT NOT NULL)
- `dosage` (TEXT NOT NULL)
- `form` (TEXT NOT NULL)
- `current_stock` (INTEGER NOT NULL DEFAULT 0)
- `reorder_threshold` (INTEGER NOT NULL DEFAULT 5)
- `pack_size` (INTEGER NOT NULL DEFAULT 30)
- `schedule_notes` (TEXT)
- `instructions` (TEXT)
- `is_dosette` (INTEGER DEFAULT 0)
- `dosette_morning` (INTEGER DEFAULT 0)
- `dosette_noon` (INTEGER DEFAULT 0)
- `dosette_evening` (INTEGER DEFAULT 0)
- `dosette_bedtime` (INTEGER DEFAULT 0)
- `created_at`, `updated_at` (DATETIME)

### `stock_logs`
- `id` (INTEGER PRIMARY KEY)
- `medication_id` (INTEGER FOREIGN KEY)
- `change_amount` (INTEGER)
- `previous_stock` (INTEGER)
- `new_stock` (INTEGER)
- `action_type` (TEXT)
- `note` (TEXT)
- `created_at` (DATETIME)
