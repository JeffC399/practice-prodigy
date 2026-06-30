import {
  ElectricPiano,
  Mallet,
  Mellotron,
  Soundfont,
  SplendidGrandPiano,
} from "smplr";
import * as Tone from "tone";
import type { ChordVoice, MelodyVoice } from "@/lib/sheets/types";

/**
 * Phase 27.1 — sample-based instrument voices for sheet playback.
 *
 * Lazy-loads smplr instruments on first request and caches them by
 * voice id. The "synth" voice is a Tone.PolySynth / MonoSynth — kept
 * as a fast / low-bandwidth fallback so users can hear the sheet
 * immediately without waiting for samples to download.
 *
 * Each voice exposes a small unified play API so the playback engine
 * doesn't care whether it's hitting a smplr sampler or a Tone synth.
 */

export type VoiceHandle = {
  /** Trigger a note at audioTime for sustainSeconds. MIDI = 0..127. */
  play: (
    midi: number | number[],
    audioTime: number,
    sustainSeconds: number,
    velocity?: number,
  ) => void;
  /** Hard-stop everything (release all pressed notes). */
  releaseAll: () => void;
  /** Set output volume in dB. (0 = unity; -inf to ~+6.) */
  setVolumeDb: (db: number) => void;
  /** Toggle output via a downstream gain. */
  setMuted: (muted: boolean) => void;
  /** Dispose audio nodes. */
  dispose: () => void;
};

type ChordVoiceCache = Partial<Record<ChordVoice, Promise<VoiceHandle>>>;
type MelodyVoiceCache = Partial<Record<MelodyVoice, Promise<VoiceHandle>>>;

const chordVoiceCache: ChordVoiceCache = {};
const melodyVoiceCache: MelodyVoiceCache = {};

function audioContext(): AudioContext {
  return Tone.getContext().rawContext as AudioContext;
}

/** dB → linear gain. -Infinity safely clamps to 0. */
function dbToGain(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.pow(10, db / 20);
}

/**
 * Wrap a smplr instrument behind a downstream GainNode so we can do
 * mute/volume without losing samples mid-play. smplr's output is its
 * own gain node; we route it through ours.
 */
function wrapSmplr(instrument: {
  context: BaseAudioContext;
  output: { gain: AudioParam } | unknown;
  start: (event: {
    note: number;
    time?: number;
    duration?: number;
    velocity?: number;
  }) => unknown;
  stop?: () => unknown;
  disconnect?: () => void;
}): VoiceHandle {
  const ctx = instrument.context as AudioContext;
  const gain = ctx.createGain();
  gain.gain.value = 1;
  const mute = ctx.createGain();
  mute.gain.value = 1;
  // The smplr instrument's output already connects to ctx.destination
  // by default. To route through our gains, we need to disconnect and
  // reroute. smplr exposes the output gain on `output.gain` for some
  // classes — but to keep this universal, we'll just put our gain
  // chain in front of the destination indirectly: we plug a separate
  // GainNode into destination AFTER smplr's gain via context manip.
  // Pragmatic shortcut: control the smplr internal gain when available.
  const outputGain =
    (instrument.output as { gain?: AudioParam }).gain ??
    (instrument.output as { volume?: AudioParam }).volume;
  return {
    play: (midi, audioTime, sustainSeconds, velocity = 0.9) => {
      const notes = Array.isArray(midi) ? midi : [midi];
      for (const m of notes) {
        instrument.start({
          note: m,
          time: audioTime,
          duration: sustainSeconds,
          velocity,
        });
      }
    },
    releaseAll: () => {
      instrument.stop?.();
    },
    setVolumeDb: (db) => {
      const linear = dbToGain(db);
      if (outputGain) {
        outputGain.cancelScheduledValues(ctx.currentTime);
        outputGain.setValueAtTime(linear, ctx.currentTime);
      } else {
        gain.gain.setValueAtTime(linear, ctx.currentTime);
      }
    },
    setMuted: (muted) => {
      const target = muted ? 0 : 1;
      mute.gain.setValueAtTime(target, ctx.currentTime);
      // For smplr instances whose output.gain is the master control,
      // also slam that to 0 so muting takes effect immediately.
      if (outputGain && muted) {
        outputGain.setValueAtTime(0, ctx.currentTime);
      }
    },
    dispose: () => {
      instrument.disconnect?.();
      try {
        gain.disconnect();
        mute.disconnect();
      } catch {
        /* already disposed */
      }
    },
  };
}

/** Build the Tone.js synth voice for the "synth" option. */
function buildChordSynthVoice(): VoiceHandle {
  const gain = new Tone.Gain(1).toDestination();
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.02, decay: 0.4, sustain: 0.5, release: 0.6 },
    volume: -14,
  }).connect(gain);
  return {
    play: (midi, audioTime, sustainSeconds) => {
      const notes = Array.isArray(midi) ? midi : [midi];
      const freqs = notes.map((m) =>
        Tone.Frequency(m, "midi").toFrequency(),
      );
      synth.triggerAttackRelease(freqs, sustainSeconds, audioTime);
    },
    releaseAll: () => {
      synth.releaseAll();
    },
    setVolumeDb: (db) => {
      synth.volume.value = db - 14; // bias so 0 dB is reasonable
    },
    setMuted: (muted) => {
      gain.gain.rampTo(muted ? 0 : 1, 0.02);
    },
    dispose: () => {
      synth.dispose();
      gain.dispose();
    },
  };
}

function buildMelodySynthVoice(): VoiceHandle {
  const gain = new Tone.Gain(1).toDestination();
  const synth = new Tone.MonoSynth({
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.01, decay: 0.15, sustain: 0.3, release: 0.25 },
    filter: { type: "lowpass", Q: 1, rolloff: -24 },
    filterEnvelope: {
      attack: 0.02,
      decay: 0.15,
      sustain: 0.5,
      release: 0.25,
      baseFrequency: 600,
      octaves: 1.6,
    },
    volume: -10,
  }).connect(gain);
  return {
    play: (midi, audioTime, sustainSeconds) => {
      const m = Array.isArray(midi) ? midi[0] : midi;
      synth.triggerAttackRelease(
        Tone.Frequency(m, "midi").toFrequency(),
        sustainSeconds,
        audioTime,
      );
    },
    releaseAll: () => {
      synth.triggerRelease();
    },
    setVolumeDb: (db) => {
      synth.volume.value = db - 10;
    },
    setMuted: (muted) => {
      gain.gain.rampTo(muted ? 0 : 1, 0.02);
    },
    dispose: () => {
      synth.dispose();
      gain.dispose();
    },
  };
}

/** Load a sample-based chord voice via smplr. */
async function buildChordSampleVoice(
  voice: Exclude<ChordVoice, "synth">,
): Promise<VoiceHandle> {
  const ctx = audioContext();
  let instrument: Parameters<typeof wrapSmplr>[0];
  switch (voice) {
    case "piano":
      instrument = (await new SplendidGrandPiano(ctx).load) as never;
      break;
    case "epiano":
      instrument = (await new ElectricPiano(ctx).load) as never;
      break;
    case "guitar":
      instrument = (await new Soundfont(ctx, {
        instrument: "acoustic_guitar_nylon",
      }).load) as never;
      break;
    case "vibes":
      instrument = (await new Mallet(ctx).load) as never;
      break;
    case "strings":
      instrument = (await new Soundfont(ctx, {
        instrument: "string_ensemble_1",
      }).load) as never;
      break;
  }
  return wrapSmplr(instrument);
}

/** Load a sample-based melody voice via smplr. */
async function buildMelodySampleVoice(
  voice: Exclude<MelodyVoice, "synth">,
): Promise<VoiceHandle> {
  const ctx = audioContext();
  let instrument: Parameters<typeof wrapSmplr>[0];
  switch (voice) {
    case "piano":
      instrument = (await new SplendidGrandPiano(ctx).load) as never;
      break;
    case "voice":
      instrument = (await new Mellotron(ctx).load) as never;
      break;
    case "sax":
      instrument = (await new Soundfont(ctx, {
        instrument: "tenor_sax",
      }).load) as never;
      break;
    case "flute":
      instrument = (await new Soundfont(ctx, {
        instrument: "flute",
      }).load) as never;
      break;
    case "strings":
      instrument = (await new Soundfont(ctx, {
        instrument: "string_ensemble_1",
      }).load) as never;
      break;
  }
  return wrapSmplr(instrument);
}

export async function loadChordVoice(voice: ChordVoice): Promise<VoiceHandle> {
  if (chordVoiceCache[voice]) return chordVoiceCache[voice]!;
  const promise: Promise<VoiceHandle> =
    voice === "synth"
      ? Promise.resolve(buildChordSynthVoice())
      : buildChordSampleVoice(voice);
  chordVoiceCache[voice] = promise;
  return promise;
}

export async function loadMelodyVoice(
  voice: MelodyVoice,
): Promise<VoiceHandle> {
  if (melodyVoiceCache[voice]) return melodyVoiceCache[voice]!;
  const promise: Promise<VoiceHandle> =
    voice === "synth"
      ? Promise.resolve(buildMelodySynthVoice())
      : buildMelodySampleVoice(voice);
  melodyVoiceCache[voice] = promise;
  return promise;
}
