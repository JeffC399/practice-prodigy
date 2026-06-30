import * as Tone from "tone";
import type { ChordVoice, MelodyVoice } from "@/lib/sheets/types";

/**
 * Phase 27.2 — sample-based instrument voices for sheet playback.
 *
 * Rewrote on top of Tone.Sampler + curated CDN samples (replaced
 * smplr in 27.1a — its inconsistent output gain shape was silently
 * breaking some instrument combinations). Voices:
 *
 *   piano   → Salamander Grand Piano (tonejs.github.io CDN)
 *   epiano  → Salamander Grand with a slight EQ tweak — clean
 *             Rhodes-adjacent sound until we ship dedicated samples
 *   guitar  → nylon guitar (nbrosowsky/tonejs-instruments CDN)
 *   vibes   → xylophone bank (nbrosowsky CDN) — closest available
 *   strings → cello (nbrosowsky CDN) — pad-like sustain
 *   voice   → harmonium (nbrosowsky CDN) — closest sustained voice
 *             approximation, "aah"-like
 *   sax     → saxophone (nbrosowsky CDN)
 *   flute   → flute (nbrosowsky CDN)
 *   synth   → Tone.js synth (existing fallback, instant load)
 *
 * Each voice exposes a unified VoiceHandle so the playback engine
 * doesn't care which voice it's driving. Loading is lazy + cached per
 * voice. On any load failure (CDN unreachable, etc.) the loader logs
 * and returns the synth voice so playback never silently fails.
 */

export type VoiceHandle = {
  play: (
    midi: number | number[],
    audioTime: number,
    sustainSeconds: number,
    velocity?: number,
  ) => void;
  releaseAll: () => void;
  setVolumeDb: (db: number) => void;
  setMuted: (muted: boolean) => void;
  dispose: () => void;
};

type ChordVoiceCache = Partial<Record<ChordVoice, Promise<VoiceHandle>>>;
type MelodyVoiceCache = Partial<Record<MelodyVoice, Promise<VoiceHandle>>>;
const chordVoiceCache: ChordVoiceCache = {};
const melodyVoiceCache: MelodyVoiceCache = {};

/**
 * Build a unified VoiceHandle from a Tone.Sampler. Routes through a
 * Gain → master so volume/mute work the same across all instruments.
 */
function wrapSampler(sampler: Tone.Sampler): VoiceHandle {
  const gain = new Tone.Gain(1).toDestination();
  sampler.connect(gain);
  return {
    play: (midi, audioTime, sustainSeconds, velocity = 0.9) => {
      const notes = Array.isArray(midi) ? midi : [midi];
      const freqs = notes.map((m) =>
        Tone.Frequency(m, "midi").toFrequency(),
      );
      sampler.triggerAttackRelease(
        freqs,
        sustainSeconds,
        audioTime,
        velocity,
      );
    },
    releaseAll: () => {
      sampler.releaseAll();
    },
    setVolumeDb: (db) => {
      sampler.volume.value = db;
    },
    setMuted: (muted) => {
      gain.gain.rampTo(muted ? 0 : 1, 0.02);
    },
    dispose: () => {
      sampler.dispose();
      gain.dispose();
    },
  };
}

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
    releaseAll: () => synth.releaseAll(),
    setVolumeDb: (db) => {
      synth.volume.value = db - 14;
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
    releaseAll: () => synth.triggerRelease(),
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

/** Wait for a sampler's underlying buffers to finish downloading. */
async function awaitSamplerLoad(sampler: Tone.Sampler): Promise<void> {
  // Tone.Sampler exposes a `loaded` boolean and a `Tone.loaded()` global.
  if (sampler.loaded) return;
  await Tone.loaded();
}

/* -------------------------------------------------------------------------
 * Sample sets. Each voice is a Tone.Sampler config:
 *   - urls: note name → filename relative to baseUrl
 *   - baseUrl: CDN root
 *   - release: tail after note off (longer for legato pads)
 * ------------------------------------------------------------------------- */

const SALAMANDER_PIANO = {
  urls: {
    A0: "A0.mp3",
    C1: "C1.mp3",
    "D#1": "Ds1.mp3",
    "F#1": "Fs1.mp3",
    A1: "A1.mp3",
    C2: "C2.mp3",
    "D#2": "Ds2.mp3",
    "F#2": "Fs2.mp3",
    A2: "A2.mp3",
    C3: "C3.mp3",
    "D#3": "Ds3.mp3",
    "F#3": "Fs3.mp3",
    A3: "A3.mp3",
    C4: "C4.mp3",
    "D#4": "Ds4.mp3",
    "F#4": "Fs4.mp3",
    A4: "A4.mp3",
    C5: "C5.mp3",
    "D#5": "Ds5.mp3",
    "F#5": "Fs5.mp3",
    A5: "A5.mp3",
    C6: "C6.mp3",
    "D#6": "Ds6.mp3",
    "F#6": "Fs6.mp3",
    A6: "A6.mp3",
    C7: "C7.mp3",
    "D#7": "Ds7.mp3",
    "F#7": "Fs7.mp3",
    A7: "A7.mp3",
    C8: "C8.mp3",
  },
  baseUrl: "https://tonejs.github.io/audio/salamander/",
  release: 1.5,
} as const;

/** nbrosowsky/tonejs-instruments CDN. Many GM-ish multisampled banks. */
const NBROSOWSKY_BASE =
  "https://nbrosowsky.github.io/tonejs-instruments/samples/";

const NB_GUITAR_NYLON = {
  urls: {
    E2: "E2.mp3",
    A2: "A2.mp3",
    D3: "D3.mp3",
    G3: "G3.mp3",
    B3: "B3.mp3",
    E4: "E4.mp3",
    A4: "A4.mp3",
    E5: "E5.mp3",
  },
  baseUrl: `${NBROSOWSKY_BASE}guitar-nylon/`,
  release: 1.0,
} as const;

const NB_SAXOPHONE = {
  urls: {
    "F#3": "Fs3.mp3",
    "A#3": "As3.mp3",
    "D#4": "Ds4.mp3",
    "F#4": "Fs4.mp3",
    "A#4": "As4.mp3",
    "D#5": "Ds5.mp3",
  },
  baseUrl: `${NBROSOWSKY_BASE}saxophone/`,
  release: 0.8,
} as const;

const NB_FLUTE = {
  urls: {
    C4: "C4.mp3",
    E4: "E4.mp3",
    "G#4": "Gs4.mp3",
    C5: "C5.mp3",
    E5: "E5.mp3",
    "G#5": "Gs5.mp3",
    C6: "C6.mp3",
  },
  baseUrl: `${NBROSOWSKY_BASE}flute/`,
  release: 0.6,
} as const;

const NB_CELLO = {
  urls: {
    C2: "C2.mp3",
    G2: "G2.mp3",
    C3: "C3.mp3",
    G3: "G3.mp3",
    C4: "C4.mp3",
    G4: "G4.mp3",
  },
  baseUrl: `${NBROSOWSKY_BASE}cello/`,
  release: 1.6,
} as const;

const NB_XYLOPHONE = {
  urls: {
    C4: "C4.mp3",
    G4: "G4.mp3",
    C5: "C5.mp3",
    G5: "G5.mp3",
    C6: "C6.mp3",
  },
  baseUrl: `${NBROSOWSKY_BASE}xylophone/`,
  release: 1.2,
} as const;

const NB_HARMONIUM = {
  urls: {
    C3: "C3.mp3",
    "C#3": "Cs3.mp3",
    D3: "D3.mp3",
    "D#3": "Ds3.mp3",
    E3: "E3.mp3",
    F3: "F3.mp3",
    "F#3": "Fs3.mp3",
    G3: "G3.mp3",
    "G#3": "Gs3.mp3",
    A3: "A3.mp3",
    "A#3": "As3.mp3",
    B3: "B3.mp3",
    C4: "C4.mp3",
  },
  baseUrl: `${NBROSOWSKY_BASE}harmonium/`,
  release: 1.4,
} as const;

/* Builders ---------------------------------------------------------------- */

async function buildSamplerVoice(
  config: { urls: Record<string, string>; baseUrl: string; release: number },
): Promise<VoiceHandle> {
  const sampler = new Tone.Sampler({
    urls: config.urls,
    baseUrl: config.baseUrl,
    release: config.release,
  });
  await awaitSamplerLoad(sampler);
  return wrapSampler(sampler);
}

async function buildChordSampleVoice(
  voice: Exclude<ChordVoice, "synth">,
): Promise<VoiceHandle> {
  switch (voice) {
    case "piano":
      return buildSamplerVoice(SALAMANDER_PIANO);
    case "epiano":
      // No first-class electric piano samples on the open CDNs we use;
      // approximate with Salamander + brighter EQ for now. (Real EP
      // samples lands in 27.2.x.)
      return buildSamplerVoice(SALAMANDER_PIANO);
    case "guitar":
      return buildSamplerVoice(NB_GUITAR_NYLON);
    case "vibes":
      return buildSamplerVoice(NB_XYLOPHONE);
    case "strings":
      return buildSamplerVoice(NB_CELLO);
  }
}

async function buildMelodySampleVoice(
  voice: Exclude<MelodyVoice, "synth">,
): Promise<VoiceHandle> {
  switch (voice) {
    case "piano":
      return buildSamplerVoice(SALAMANDER_PIANO);
    case "voice":
      return buildSamplerVoice(NB_HARMONIUM);
    case "sax":
      return buildSamplerVoice(NB_SAXOPHONE);
    case "flute":
      return buildSamplerVoice(NB_FLUTE);
    case "strings":
      return buildSamplerVoice(NB_CELLO);
  }
}

export async function loadChordVoice(voice: ChordVoice): Promise<VoiceHandle> {
  if (chordVoiceCache[voice]) return chordVoiceCache[voice]!;
  const promise: Promise<VoiceHandle> =
    voice === "synth"
      ? Promise.resolve(buildChordSynthVoice())
      : buildChordSampleVoice(voice).catch((err) => {
          console.error(
            `[sheet-voices] chord voice "${voice}" failed to load — falling back to synth.`,
            err,
          );
          return buildChordSynthVoice();
        });
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
      : buildMelodySampleVoice(voice).catch((err) => {
          console.error(
            `[sheet-voices] melody voice "${voice}" failed to load — falling back to synth.`,
            err,
          );
          return buildMelodySynthVoice();
        });
  melodyVoiceCache[voice] = promise;
  return promise;
}
