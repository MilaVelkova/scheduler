import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { getSlots, createSlot, bookSlot } from "./api";
import type { Slot } from "./api";

const DURATIONS = [15, 30, 45, 60];

function parseDate(d: string) {
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, day);
}
const pad = (n: number) => String(n).padStart(2, "0");

function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

function isPast(date: string, startTime: string) {
  return new Date(`${date}T${startTime}:00`) <= new Date();
}

function endTime(start: string, minutes: number) {
  const [h, m] = start.split(":").map(Number) as [number, number];
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

type Toast = { text: string; kind: "ok" | "error" } | null;

export default function App() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [toast, setToast] = useState<Toast>(null);

  // host form
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [creating, setCreating] = useState(false);

  // booking form
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [booking, setBooking] = useState(false);

  async function load() {
    try {
      setSlots(await getSlots());
    } catch (e) {
      setToast({ text: (e as Error).message, kind: "error" });
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // group slots by date (backend already sorts them)
  const days = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      map.set(s.date, [...(map.get(s.date) ?? []), s]);
    }
    return [...map.entries()];
  }, [slots]);

  const openCount = slots.filter((s) => !s.booked && !isPast(s.date, s.startTime)).length;

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (isPast(date, startTime)) {
      setToast({ text: "Choose a time that hasn't passed yet", kind: "error" });
      return;
    }
    setCreating(true);
    try {
      await createSlot({ date, startTime, durationMinutes: duration });
      setToast({ text: "Time published", kind: "ok" });
      setStartTime("");
      await load();
    } catch (err) {
      setToast({ text: (err as Error).message, kind: "error" });
    } finally {
      setCreating(false);
    }
  }

  async function handleBook(e: FormEvent) {
    e.preventDefault();
    if (bookingId === null) return;
    setBooking(true);
    try {
      await bookSlot(bookingId, { name, email });
      setToast({ text: "Booked. See you then!", kind: "ok" });
      setName("");
      setEmail("");
    } catch (err) {
      setToast({ text: (err as Error).message, kind: "error" });
    } finally {
      setBookingId(null);
      setBooking(false);
      await load(); // refresh so a slot someone else just took shows as taken
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <h1>Book a time</h1>
        <p>Pick a free time below and leave your name and email. Taken times are crossed out.</p>
      </header>

      <div className="layout">
        <aside className="host">
          <h2>Publish a time</h2>
          <p>Add a slot that people can book.</p>
          <form onSubmit={handleCreate}>
            <label className="field">
              <span>Date</span>
              <input type="date" min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label className="field">
              <span>Start time</span>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </label>
            <div className="field">
              <span>Length</span>
              <div className="chips">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="chip"
                    aria-pressed={duration === d}
                    onClick={() => setDuration(d)}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>
            <button className="btn block" type="submit" disabled={creating}>
              {creating ? "Publishing..." : "Publish time"}
            </button>
          </form>
        </aside>

        <section>
          <div className="slots-head">
            <h2>Available times</h2>
            <span>{openCount} open</span>
          </div>

          {days.length === 0 && (
            <div className="empty">
              <strong>No times published yet</strong>
              Use the panel to publish the first one.
            </div>
          )}

          {days.map(([d, daySlots]) => {
            const dt = parseDate(d);
            return (
              <div className="day" key={d}>
                <div className="date-tile">
                  <div className="month">{dt.toLocaleDateString("en-US", { month: "short" })}</div>
                  <div className="num">{dt.getDate()}</div>
                  <div className="wd">{dt.toLocaleDateString("en-US", { weekday: "short" })}</div>
                </div>

                <div className="times">
                  {daySlots.map((s) => (
                    <div key={s.id} className={`slot ${s.booked ? "booked" : ""}`}>
                      <div className="slot-row">
                        <div>
                          <div className="slot-time">
                            {s.startTime} to {endTime(s.startTime, s.durationMinutes)}
                          </div>
                          <div className="slot-meta">{s.durationMinutes} minutes</div>
                        </div>
                        {s.booked ? (
                          <span className="pill">Taken</span>
                        ) : (
                          <button className="btn small" onClick={() => setBookingId(s.id)}>
                            Book
                          </button>
                        )}
                      </div>

                      {bookingId === s.id && (
                        <form className="book-form" onSubmit={handleBook}>
                          <input
                            placeholder="Your name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            autoFocus
                          />
                          <input
                            type="email"
                            placeholder="Your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                          <div className="book-actions">
                            <button type="button" className="btn ghost small" onClick={() => setBookingId(null)}>
                              Cancel
                            </button>
                            <button type="submit" className="btn small" disabled={booking}>
                              {booking ? "Booking..." : "Confirm booking"}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      </div>

      {toast && (
        <div className={`toast ${toast.kind === "error" ? "error" : ""}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}