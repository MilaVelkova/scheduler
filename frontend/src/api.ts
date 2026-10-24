export type Slot = {
    id: number;
    date: string;
    startTime: string;
    durationMinutes: number;
    bookedByName: string | null;
    booked: boolean;
};

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Something went wrong");
    return data as T;
}

export const getSlots = () => request<Slot[]>("/slots");

export const createSlot = (body: {
    date: string;
    startTime: string;
    durationMinutes: number;
}) => request<Slot>("/slots", { method: "POST", body: JSON.stringify(body) });

export const bookSlot = (id: number, body: { name: string; email: string }) =>
    request<Slot>(`/slots/${id}/book`, {
        method: "POST",
        body: JSON.stringify(body),
    });