# Scheduler

A small booking app. A host publishes time slots, and anyone can book one with their name and email. A booked slot can't be booked again, and times in the past can't be published or booked.

## Stack

- Frontend: React, TypeScript, Vite
- Backend: Node.js, Express, TypeScript, `pg` (plain SQL)
- Database: PostgreSQL 16 in Docker

## Prerequisites

- Node.js 20 or newer
- Docker Desktop (running)

## What I built

A booking page for a single host:

- The host publishes time slots (date, start time, length of 15, 30, 45 or 60 minutes).
- Visitors see the slots grouped by day, pick one, and book it with their name and email.
- Booked slots are marked as taken and can't be booked again, even if two people click at the same moment.
- Times in the past can't be published or booked.
- Data is stored in PostgreSQL, so it persists after restarts.

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

## AI tools I used

- **Claude**: I used it as a pairing partner for the whole project. It helped me write the first versions of the Express endpoints and the React components, and debug environment problems on Windows (file encoding, TypeScript config, a local Postgres that was taking over the port, Git authentication).
- I read and tested each part before keeping it. I wrote and checked the SQL for booking myself, and I tested the double-booking protection by sending the same booking twice with Postman and seeing the `409` response.

## What I would improve with more time

- **Host protection**: right now anyone can publish slots because there is no login. I would add a simple host password or login and a separate host page.
- **Host view of bookings**: a protected endpoint and page showing who booked which slot, including their email.
- **Cancel and edit**: let the host delete or change a slot, and let a guest cancel their booking.
- **Time zones**: the app assumes one time zone. I would store times in UTC and show them in each visitor's time zone.
- **Email confirmation**: send the guest a confirmation email, with a short friendly message written by an LLM (for example Gemini).
- **Google Calendar**: hide slots that clash with existing calendar events.

## Live demo

https://scheduler-sable-five.vercel.app/

The backend runs on Render's free tier, so the first load after a period of inactivity can take up to a minute.