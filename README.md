# Scheduler

A small booking app. A host publishes time slots, and anyone can book one with their name and email. A booked slot can't be booked again, and times in the past can't be published or booked.

## Stack

- Frontend: React, TypeScript, Vite
- Backend: Node.js, Express, TypeScript, `pg` (plain SQL)
- Database: PostgreSQL 16 in Docker

## Prerequisites

- Node.js 20 or newer
- Docker Desktop (running)

## Run locally

Run each step from the project root unless it says otherwise.

### 1. Start the database

```bash
docker compose up -d
```

PostgreSQL listens on port **55432** (not 5432) to avoid clashing with a local Postgres install. The `slots` table is created automatically when the backend starts.

### 2. Start the backend

```bash
cd backend
npm install
npm run dev
```

The API runs on http://localhost:3000. Check it at http://localhost:3000/health.

### 3. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

## API

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/slots` | List all slots, booked ones are marked |
| POST | `/slots` | Create a slot: `{ "date": "2026-11-02", "startTime": "10:00", "durationMinutes": 30 }` |
| POST | `/slots/:id/book` | Book a slot: `{ "name": "Ana", "email": "ana@example.com" }` |

Error codes: `400` invalid input or a time that has passed, `404` unknown slot, `409` slot already booked or duplicate time.

## How double booking is prevented

Booking is a single atomic SQL statement:

```sql
UPDATE slots
SET booked_by_name = $2, booked_by_email = $3, booked_at = now()
WHERE id = $1 AND booked_at IS NULL
```

If two people book at the same moment, Postgres processes one first. The second update changes 0 rows and the API returns `409`. There is no read-then-write gap. A `UNIQUE (date, start_time)` constraint also stops the host from publishing the same time twice.

## Design decisions

- Plain SQL with `pg` instead of an ORM, to keep the data layer small and easy to follow.
- One time zone is assumed (server local time).
- `GET /slots` does not return guests' email addresses.
- Past times are rejected by the backend as well as the UI.

## Configuration

The database settings are in `backend/src/db.ts`. The frontend reads the API address from `VITE_API_URL` and defaults to `http://localhost:3000`.

## Stop everything

```bash
docker compose down
```

Add `-v` to also delete the database data.