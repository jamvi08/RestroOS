"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import { isSoundOn, turnOnSound } from "@/lib/alert-sound";

/** Shown until the waiter taps once to allow alert sounds (a browser rule). */
export function SoundBanner() {
  const [on, setOn] = useState(() => (typeof window !== "undefined" ? isSoundOn() : false));
  if (on) return null;

  return (
    <button
      type="button"
      onClick={async () => setOn(await turnOnSound())}
      className="flex w-full items-center gap-3 rounded-2xl border-2 border-primary bg-primary-soft p-4 text-left"
    >
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <BellRing className="size-5" />
      </span>
      <span>
        <span className="block text-base font-bold text-foreground">Tap to start shift</span>
        <span className="block text-[15px] text-muted-foreground">Turns on the ring for new orders and calls</span>
      </span>
    </button>
  );
}
