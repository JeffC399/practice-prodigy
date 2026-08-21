"use client";

/**
 * routine-sounds — Slice B.15 (Phase 116).
 *
 * Two WebAudio helpers used by the routine player to nudge the user
 * at slice boundaries:
 *
 *   - playRestEndChime(): a soft two-note rising ping when a rest
 *     item auto-advances to the next item.
 *   - playRoutineCompleteChime(): a cheerier ascending triad when the
 *     whole routine finishes.
 *
 * Both are pure oscillator+gain graphs — no external samples to load,
 * so there's zero latency from a cold cache. Callers should check
 * user-prefs `routineSounds` before invoking; this module doesn't
 * consult prefs itself, so tests and one-off "preview" buttons can
 * fire regardless of the toggle.
 *
 * ## AudioContext lifecycle
 *
 * We lazily construct a single AudioContext on first use. Browsers
 * suspend it until a user gesture, so the first play from a gesture-
 * initiated flow (the routine Start button) resumes it. The player
 * calls `primeRoutineAudio()` on Start so subsequent auto-fired
 * chimes have a warm, running context.
 */

let ctx: AudioContext | null = null;

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

/**
 * Resume the AudioContext (must be called from a user gesture). Safe
 * to call multiple times — no-op when already running or unsupported.
 */
export function primeRoutineAudio(): void {
  const c = ensureContext();
  if (!c) return;
  if (c.state === "suspended") {
    // No await — fire-and-forget; the promise settles before the next
    // scheduled sound anyway.
    void c.resume();
  }
}

/** Schedule one soft sine-wave note. Returns the stop time (seconds). */
function scheduleNote(
  c: AudioContext,
  freq: number,
  startAt: number,
  durationSec: number,
  peakGain: number,
): number {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, startAt);

  // ADSR-lite: fast attack, longer release. Keeps the tone from
  // "clicking" at start / stop.
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);

  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(startAt);
  osc.stop(startAt + durationSec + 0.05);
  return startAt + durationSec;
}

/**
 * Two-note rising ping — G5 → C6 over ~350ms. Meant to be pleasant
 * and non-startling; volume kept low so it doesn't punch through
 * headphones during quiet practice moments.
 */
export function playRestEndChime(): void {
  const c = ensureContext();
  if (!c) return;
  primeRoutineAudio();
  const now = c.currentTime;
  scheduleNote(c, 784, now, 0.18, 0.14);
  scheduleNote(c, 1046.5, now + 0.14, 0.24, 0.14);
}

/**
 * Ascending C-E-G triad — celebratory but brief (~600ms). Fires when
 * the whole routine wraps up.
 */
export function playRoutineCompleteChime(): void {
  const c = ensureContext();
  if (!c) return;
  primeRoutineAudio();
  const now = c.currentTime;
  scheduleNote(c, 523.25, now, 0.2, 0.16); // C5
  scheduleNote(c, 659.25, now + 0.16, 0.2, 0.16); // E5
  scheduleNote(c, 783.99, now + 0.32, 0.3, 0.16); // G5
}
