"use client";

// Browsers only allow sound after the user taps something, so the waiter taps
// "Turn on alerts" once per visit. The AudioContext then lives for the session.
let ctx: AudioContext | null = null;

export function isSoundOn() {
  return ctx !== null && ctx.state === "running";
}

export async function turnOnSound() {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return false;
  ctx ??= new AC();
  if (ctx.state === "suspended") await ctx.resume();
  playChime();
  return isSoundOn();
}

/** Two short rising beeps plus a vibration — loud enough for a busy dining hall. */
export function playChime() {
  try {
    navigator.vibrate?.([250, 120, 250]);
  } catch {
    // vibration not supported
  }
  if (!ctx || ctx.state !== "running") return;

  const now = ctx.currentTime;
  [0, 0.22].forEach((offset, i) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = "sine";
    osc.frequency.value = i === 0 ? 880 : 1175;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.6, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.2);
  });
}
