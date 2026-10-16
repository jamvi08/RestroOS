"use client";

import { useCallback, useEffect, useState } from "react";

const POLL_MS = 5000;

/**
 * Fetches `url` now and every `intervalMs` while the page is visible.
 * Keeps the last good data when a request fails (patchy 4G) and reports the error.
 */
export function usePoll<T>(url: string, intervalMs = POLL_MS) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Could not load.");
      setData(json as T);
      setError(null);
      setFetchedAt(Date.now());
    } catch (err) {
      setError(
        typeof navigator !== "undefined" && !navigator.onLine
          ? "No internet. Retrying…"
          : err instanceof Error ? err.message : "Could not load."
      );
    }
  }, [url]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    tick();
    const timer = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("online", tick);
    };
  }, [refresh, intervalMs]);

  return { data, error, fetchedAt, refresh };
}

