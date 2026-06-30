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

/**
 * Phase 27.2.1: richer chord-synth preset. PolySynth with detuned
 * fat-sawtooth oscillators + slow filter envelope + reverb → fuller,
 * more useful pad than the bare triangle that shipped before.
 */
function buildChordSynthVoice(): VoiceHandle {
  const gain = new Tone.Gain(1).toDestination();
  const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.25 }).connect(gain);
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "fatsawtooth", count: 3, spread: 24 },
    envelope: { attack: 0.04, decay: 0.5, sustain: 0.6, release: 0.8 },
    volume: -16,
  }).connect(reverb);
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
      synth.volume.value = db - 16;
    },
    setMuted: (muted) => {
      gain.gain.rampTo(muted ? 0 : 1, 0.02);
    },
    dispose: () => {
      synth.dispose();
      reverb.dispose();
      gain.dispose();
    },
  };
}

/**
 * Phase 27.2.1: smoother melody synth. MonoSynth with a softer filter
 * envelope + slightly wider lowpass + light reverb so it doesn't read
 * as harsh / nasal.
 */
function buildMelodySynthVoice(): VoiceHandle {
  const gain = new Tone.Gain(1).toDestination();
  const reverb = new Tone.Reverb({ decay: 1.5, wet: 0.15 }).connect(gain);
  const synth = new Tone.MonoSynth({
    oscillator: { type: "fatsawtooth", count: 2, spread: 10 },
    envelope: { attack: 0.015, decay: 0.2, sustain: 0.5, release: 0.35 },
    filter: { type: "lowpass", Q: 0.8, rolloff: -24 },
    filterEnvelope: {
      attack: 0.03,
      decay: 0.2,
      sustain: 0.6,
      release: 0.35,
      baseFrequency: 850,
      octaves: 2.0,
    },
    volume: -12,
  }).connect(reverb);
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
      synth.volume.value = db - 12;
    },
    setMuted: (muted) => {
      gain.gain.rampTo(muted ? 0 : 1, 0.02);
    },
    dispose: () => {
      synth.dispose();
      reverb.dispose();
      gain.dispose();
    },
  };
}

/**
 * Phase 27.2.1 — String ENSEMBLE pad for chord side. The cello sample
 * sounds bad on block voicings (too much bow noise + harmonic detail);
 * a synth pad reads as "strings" much better when triggered by chords.
 */
function buildStringPadVoice(): VoiceHandle {
  const gain = new Tone.Gain(1).toDestination();
  const reverb = new Tone.Reverb({ decay: 3.0, wet: 0.35 }).connect(gain);
  const chorus = new Tone.Chorus({
    frequency: 0.6,
    delayTime: 6,
    depth: 0.5,
    wet: 0.5,
  })
    .connect(reverb)
    .start();
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "fatsawtooth", count: 4, spread: 30 },
    envelope: { attack: 0.4, decay: 0.6, sustain: 0.9, release: 1.4 },
    volume: -18,
  }).connect(chorus);
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
      synth.volume.value = db - 18;
    },
    setMuted: (muted) => {
      gain.gain.rampTo(muted ? 0 : 1, 0.02);
    },
    dispose: () => {
      synth.dispose();
      chorus.dispose();
      reverb.dispose();
      gain.dispose();
    },
  };
}

/**
 * Phase 27.2.1 — Rhodes-style FM Electric Piano. Bell-like tine
 * harmonic from the high modulation ratio + short envelope. Better
 * EP placeholder than the Salamander-Grand approximation.
 */
function buildEPianoVoice(): VoiceHandle {
  const gain = new Tone.Gain(1).toDestination();
  const reverb = new Tone.Reverb({ decay: 1.8, wet: 0.2 }).connect(gain);
  const synth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3.5,
    modulationIndex: 9,
    oscillator: { type: "sine" },
    envelope: { attack: 0.004, decay: 1.0, sustain: 0.25, release: 1.0 },
    modulation: { type: "sine" },
    modulationEnvelope: {
      attack: 0.004,
      decay: 0.4,
      sustain: 0,
      release: 0.3,
    },
    volume: -10,
  }).connect(reverb);
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
      synth.volume.value = db - 10;
    },
    setMuted: (muted) => {
      gain.gain.rampTo(muted ? 0 : 1, 0.02);
    },
    dispose: () => {
      synth.dispose();
      reverb.dispose();
      gain.dispose();
    },
  };
}

/**
 * Phase 27.2.1 — "Voice (Aah)" choir pad. The harmonium sample didn't
 * read as a human voice at all; this layered synth with chorus +
 * formant-ish filter is closer to a vocalese aah.
 */
function buildVoicePadVoice(): VoiceHandle {
  const gain = new Tone.Gain(1).toDestination();
  const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.3 }).connect(gain);
  const chorus = new Tone.Chorus({
    frequency: 1.2,
    delayTime: 3.5,
    depth: 0.6,
    wet: 0.6,
  })
    .connect(reverb)
    .start();
  // Formant-ish vowel resonance via a bandpass set around 700 Hz
  // (close to /a/ vowel's first formant) gives more "aah" character.
  const formant = new Tone.Filter({
    type: "bandpass",
    frequency: 700,
    Q: 0.9,
  }).connect(chorus);
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "fatsawtooth", count: 3, spread: 22 },
    envelope: { attack: 0.25, decay: 0.5, sustain: 0.85, release: 1.0 },
    volume: -10,
  }).connect(formant);
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
      synth.volume.value = db - 10;
    },
    setMuted: (muted) => {
      gain.gain.rampTo(muted ? 0 : 1, 0.02);
    },
    dispose: () => {
      synth.dispose();
      formant.dispose();
      chorus.dispose();
      reverb.dispose();
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

/** Phase 27.2.1: classical-leaning acoustic guitar samples. */
const NB_GUITAR_ACOUSTIC = {
  urls: {
    A2: "A2.mp3",
    "A#2": "As2.mp3",
    B2: "B2.mp3",
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
  baseUrl: `${NBROSOWSKY_BASE}guitar-acoustic/`,
  release: 0.9,
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

/* Builders ---------------------------------------------------------------- */

async function buildSamplerVoice(
  config: { urls: Record<string, string>; baseUrl: string; release: number },
  options?: {
    /** Sampler-level volume boost (dB) — for quiet sample sets. */
    volumeBoostDb?: number;
    /** Apply a lowpass filter to tame bright samples. */
    lowpassHz?: number;
  },
): Promise<VoiceHandle> {
  const sampler = new Tone.Sampler({
    urls: config.urls,
    baseUrl: config.baseUrl,
    release: config.release,
  });
  if (options?.volumeBoostDb) {
    sampler.volume.value = options.volumeBoostDb;
  }
  await awaitSamplerLoad(sampler);
  if (options?.lowpassHz) {
    // Insert a lowpass before the master gain so the sampler still
    // routes through wrapSampler's volume/mute chain.
    const gain = new Tone.Gain(1).toDestination();
    const lowpass = new Tone.Filter({
      type: "lowpass",
      frequency: options.lowpassHz,
      Q: 0.7,
    }).connect(gain);
    sampler.connect(lowpass);
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
      releaseAll: () => sampler.releaseAll(),
      setVolumeDb: (db) => {
        sampler.volume.value = db + (options?.volumeBoostDb ?? 0);
      },
      setMuted: (muted) => {
        gain.gain.rampTo(muted ? 0 : 1, 0.02);
      },
      dispose: () => {
        sampler.dispose();
        lowpass.dispose();
        gain.dispose();
      },
    };
  }
  return wrapSampler(sampler);
}

async function buildChordSampleVoice(
  voice: Exclude<ChordVoice, "synth">,
): Promise<VoiceHandle> {
  switch (voice) {
    case "piano":
      return buildSamplerVoice(SALAMANDER_PIANO);
    case "epiano":
      // Phase 27.2.1: FM Rhodes approximation instead of Salamander.
      return buildEPianoVoice();
    case "guitar":
      // Phase 27.2.1: swap nylon → acoustic + ~3.5 kHz lowpass to tame
      // the user-reported brightness.
      return buildSamplerVoice(NB_GUITAR_ACOUSTIC, {
        lowpassHz: 3500,
      });
    case "vibes":
      // Phase 27.2.1: +10 dB sampler boost — xylophone samples are
      // markedly quieter than the others.
      return buildSamplerVoice(NB_XYLOPHONE, { volumeBoostDb: 10 });
    case "strings":
      // Phase 27.2.1: synth pad instead of cello samples. Cello block
      // voicings sounded terrible on the chord side.
      return buildStringPadVoice();
  }
}

async function buildMelodySampleVoice(
  voice: Exclude<MelodyVoice, "synth">,
): Promise<VoiceHandle> {
  switch (voice) {
    case "piano":
      return buildSamplerVoice(SALAMANDER_PIANO);
    case "voice":
      // Phase 27.2.1: choir-pad approximation. Harmonium didn't read
      // as voice at all.
      return buildVoicePadVoice();
    case "sax":
      return buildSamplerVoice(NB_SAXOPHONE, { volumeBoostDb: 3 });
    case "flute":
      return buildSamplerVoice(NB_FLUTE);
    case "strings":
      // Melody-side strings (cello samples) sounded OK per the user;
      // leaving as-is.
      return buildSamplerVoice(NB_CELLO);
    case "guitar":
      // Phase 27.2.1: new acoustic-guitar melody voice. Same lowpass
      // treatment as the chord-side guitar so both read together.
      return buildSamplerVoice(NB_GUITAR_ACOUSTIC, {
        lowpassHz: 3500,
      });
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
