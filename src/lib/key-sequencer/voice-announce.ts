/**
 * Voice announcement — browser TTS wrapper for the Key Sequencer.
 *
 * Uses `window.speechSynthesis`, which ships in every modern browser
 * (Chrome, Firefox, Safari, Edge, mobile equivalents). Older browsers
 * that lack the API get a silent no-op — the drill still runs, just
 * without spoken prompts.
 *
 * Cancellation semantics: `speak()` always cancels any pending or
 * currently-speaking utterance before scheduling the new one. This
 * matches what users expect during a drill — falling behind and
 * hearing the previous prompt still catching up would be confusing.
 * The session page also calls `stop()` on Stop / pause / unmount so
 * navigating away doesn't leave audio running.
 */

let cachedSupported: boolean | null = null;

/** Is the browser's speechSynthesis API available? */
export function isVoiceAnnounceSupported(): boolean {
  if (cachedSupported !== null) return cachedSupported;
  const supported =
    typeof window !== "undefined" &&
    typeof window.speechSynthesis !== "undefined" &&
    typeof window.SpeechSynthesisUtterance !== "undefined";
  cachedSupported = supported;
  return supported;
}

/**
 * Speak `text` at `rate` speed. Any pending utterance is cancelled
 * first. Silent no-op when TTS isn't available.
 */
export function speakUpcoming(text: string, rate = 1.0): void {
  if (!isVoiceAnnounceSupported()) return;
  if (!text.trim()) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = Math.max(0.5, Math.min(2.0, rate));
    // Volume/pitch defaults are fine; keeps the TTS neutral so it
    // doesn't clash with the metronome click.
    window.speechSynthesis.speak(utter);
  } catch {
    // Some browsers throw when the tab isn't focused or when the
    // audio policy blocks speech. Silent swallow — the drill keeps
    // running without the utterance.
  }
}

/** Cancel any pending or in-progress utterance. Silent when unsupported. */
export function cancelVoiceAnnounce(): void {
  if (!isVoiceAnnounceSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore.
  }
}
