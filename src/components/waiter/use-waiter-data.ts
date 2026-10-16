"use client";

import { useEffect, useRef } from "react";
import { playChime } from "@/lib/alert-sound";
import type { BoardAlert, BoardTable } from "@/lib/board";
import { usePoll } from "@/lib/use-poll";

export { usePoll };

export type Board = { tables: BoardTable[]; alerts: BoardAlert[] };

/** The board, plus a chime whenever a new order or help request shows up. */
export function useBoard() {
  const poll = usePoll<Board>("/api/waiter/board");
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!poll.data) return;
    const urgent = poll.data.alerts.filter((a) => a.status === "OPEN").map((a) => a.key);
    // First load: remember what's already there without ringing
    if (seen.current === null) {
      seen.current = new Set(urgent);
      return;
    }
    const fresh = urgent.filter((k) => !seen.current!.has(k));
    urgent.forEach((k) => seen.current!.add(k));
    if (fresh.length > 0) playChime();
  }, [poll.data]);

  return poll;
}

/** POST/PATCH helper for waiter actions; throws with the server's message. */
export async function send(url: string, body: unknown, method: "POST" | "PATCH" | "PUT" = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || "Something went wrong. Please try again.");
  return json;
}

export function minutesAgo(iso: string, now: number) {
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} hr ${mins % 60} min ago`;
}
