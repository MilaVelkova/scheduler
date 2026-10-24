import express from "express";
import cors from "cors";
import { pool, initDb } from "./db";

const app = express();
// Slots are stored without a timezone, so compare in the server's local time
function isPast(date: string, startTime: string) {
    return new Date(`${date}T${startTime}:00`) <= new Date();
}

app.use(cors());
app.use(express.json());

// Return dates/times as plain strings so the frontend doesn't deal with timezones
const SLOT_COLUMNS = `
  id,
  date::text AS date,
  to_char(start_time, 'HH24:MI') AS "startTime",
  duration_minutes AS "durationMinutes",
  booked_by_name AS "bookedByName",
  booked_at IS NOT NULL AS booked
`;

app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});

// List all slots (booked ones are included but marked, no personal data exposed)
app.get("/slots", async (_req, res) => {
    const result = await pool.query(
        `SELECT ${SLOT_COLUMNS} FROM slots ORDER BY date, start_time`
    );
    res.json(result.rows);
});

// Host creates a slot
app.post("/slots", async (req, res) => {
    const { date, startTime, durationMinutes } = req.body ?? {};

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ||
        !/^\d{2}:\d{2}$/.test(startTime ?? "") ||
        !Number.isInteger(durationMinutes) || durationMinutes <= 0) {
        return res.status(400).json({ error: "Invalid date, startTime or durationMinutes" });
    }
    if (isPast(date, startTime)) {
        return res.status(400).json({ error: "You can't publish a time that has already passed" });
    }

    try {
        const result = await pool.query(
            `INSERT INTO slots (date, start_time, duration_minutes)
       VALUES ($1, $2, $3)
       RETURNING ${SLOT_COLUMNS}`,
            [date, startTime, durationMinutes]
        );
        res.status(201).json(result.rows[0]);
    } catch (err: any) {
        if (err.code === "23505") {
            return res.status(409).json({ error: "A slot already exists at that time" });
        }
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// Someone books a slot
app.post("/slots/:id/book", async (req, res) => {
    const id = Number(req.params.id);
    const { name, email } = req.body ?? {};

    if (!Number.isInteger(id) ||
        typeof name !== "string" || !name.trim() ||
        typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ error: "Valid name and email are required" });
    }

    const found = await pool.query(
        `SELECT date::text AS date, to_char(start_time, 'HH24:MI') AS "startTime"
     FROM slots WHERE id = $1`,
        [id]
    );
    const slot = found.rows[0];
    if (!slot) {
        return res.status(404).json({ error: "Slot not found" });
    }
    if (isPast(slot.date, slot.startTime)) {
        return res.status(400).json({ error: "This time has already passed" });
    }

    // Still atomic: only succeeds if the slot is free at this exact moment
    const result = await pool.query(
        `UPDATE slots
     SET booked_by_name = $2, booked_by_email = $3, booked_at = now()
     WHERE id = $1 AND booked_at IS NULL
     RETURNING ${SLOT_COLUMNS}`,
        [id, name.trim(), email.trim()]
    );

    if (result.rowCount === 0) {
        return res.status(409).json({ error: "Sorry, this slot was just booked" });
    }

    res.json(result.rows[0]);
});

const PORT = 3000;

initDb()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Backend running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error("Could not connect to the database:", err);
        process.exit(1);
    });