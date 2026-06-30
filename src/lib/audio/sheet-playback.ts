import * as Tone from "tone";
import { CHORD_INTERVALS } from "@/lib/music/intervals";
import { type Chord, type PitchClass } from "@/lib/music/chord";
import type {
  ChordBeat,
  ChordVoice,
  MelodyDuration,
  MelodyNote,
  MelodyVoice,
  Sheet,
  SheetMixer,
} from "@/lib/sheets/types";
import {
  DEFAULT_SHEET_MIXER,
  MELODY_DURATION_BEATS,
} from "@/lib/sheets/types";
import {
  loadChordVoice,
  loadMelodyVoice,
  type VoiceHandle,
} from "@/lib/audio/sheet-voices";

/**
 * Phase 27 — Lead-sheet live audio playback.
 * Phase 27.1 — sample-based instruments + per-voice mixer.
 *
 * Plays a Sheet aloud through two configurable voices:
 *   - Chord comping: holds each ChordBeat for the duration until the
 *     next chord change. Voiced in the bass-baritone range (root from
 *     C3) so it sits below the melody.
 *   - Melody: plays each MelodyNote at its computed start beat for
 *     its computed duration. Rests advance the clock without
 *     scheduling audio. Tied note pairs combine sustain.
 *
 * Voice choice + mixer (volume + mute per voice) comes from the
 * Sheet's `chordVoice` / `melodyVoice` / `mixer` fields (with sensible
 * defaults). Voices lazy-load on first play and cache.
 */

const LEAD_IN_SECONDS = 0.1;
const CHORD_OCTAVE = 3;

const PITCH_CLASS_TO_SEMITONE: Record<PitchClass, number> = {
  C: 0,
  "C#": 1,
  D: 2,
  "D#": 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  "G#": 8,
  A: 9,
  "A#": 10,
  B: 11,
};

const LETTER_TO_SEMITONE: Record<string, number> = {
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  b: 11,
};

export function vexPitchToMidi(pitch: string): number | null {
  const slash = pitch.indexOf("/");
  if (slash < 0) return null;
  const letter = pitch[0]?.toLowerCase();
  const accidental = pitch[1];
  const octaveStr = pitch.slice(slash + 1);
  const octave = parseInt(octaveStr, 10);
  if (!letter || Number.isNaN(octave)) return null;
  const base = LETTER_TO_SEMITONE[letter];
  if (base === undefined) return null;
  let semitone = base;
  if (accidental === "#") semitone += 1;
  else if (accidental === "b") semitone -= 1;
  return 12 * (octave + 1) + semitone;
}

export function chordToMidiNotes(
  chord: Chord,
  octave: number = CHORD_OCTAVE,
  bass?: PitchClass,
): number[] {
  const rootMidi = 12 * (octave + 1) + PITCH_CLASS_TO_SEMITONE[chord.root];
  const intervals = CHORD_INTERVALS[chord.quality];
  const notes = intervals.map((iv) => rootMidi + iv);
  if (bass) {
    const bassMidi = 12 * octave + PITCH_CLASS_TO_SEMITONE[bass];
    return [bassMidi, ...notes];
  }
  return notes;
}

function beatsForDuration(
  duration: MelodyDuration,
  dotted?: boolean,
): number {
  const base = MELODY_DURATION_BEATS[duration] ?? 1;
  return dotted ? base * 1.5 : base;
}

class SheetPlayback {
  private chordVoice: VoiceHandle | null = null;
  private melodyVoice: VoiceHandle | null = null;
  private scheduledEvents: number[] = [];
  private endEvent: number | null = null;
  private endCallback: (() => void) | null = null;
  private _isPlaying = false;
  private _isLoading = false;

  isPlaying(): boolean {
    return this._isPlaying;
  }
  isLoading(): boolean {
    return this._isLoading;
  }

  /** Re-apply the mixer to currently-loaded voices. Called between plays
   *  so volume / mute changes mid-stop are reflected next time. */
  applyMixer(mixer: SheetMixer): void {
    if (this.chordVoice) {
      this.chordVoice.setVolumeDb(mixer.chordVolume);
      this.chordVoice.setMuted(mixer.chordMuted);
    }
    if (this.melodyVoice) {
      this.melodyVoice.setVolumeDb(mixer.melodyVolume);
      this.melodyVoice.setMuted(mixer.melodyMuted);
    }
  }

  async play(
    sheet: Sheet,
    options?: { bpmOverride?: number; onEnded?: () => void },
  ): Promise<void> {
    await Tone.start();
    this.cancel();

    const chordVoice: ChordVoice = sheet.chordVoice ?? "piano";
    const melodyVoice: MelodyVoice = sheet.melodyVoice ?? "piano";
    const mixer: SheetMixer = sheet.mixer ?? DEFAULT_SHEET_MIXER;

    // Lazy-load voices (cached). Both load in parallel.
    this._isLoading = true;
    try {
      [this.chordVoice, this.melodyVoice] = await Promise.all([
        loadChordVoice(chordVoice),
        loadMelodyVoice(melodyVoice),
      ]);
    } finally {
      this._isLoading = false;
    }
    this.applyMixer(mixer);

    const bpm = options?.bpmOverride ?? sheet.bpm ?? 120;
    const transport = Tone.getTransport();
    transport.bpm.value = bpm;
    transport.position = 0;

    const beatSeconds = 60 / bpm;
    const beatsPerMeasure = sheet.timeSignature.beatsPerMeasure;
    const totalMeasureBeats = sheet.measures.length * beatsPerMeasure;

    // 1) Chord events: each ChordBeat sustains until the NEXT chord
    // change in time order, or end-of-sheet.
    type FlatChord = { startBeat: number; midi: number[] };
    const flatChords: FlatChord[] = [];
    sheet.measures.forEach((m, mi) => {
      const sorted: ChordBeat[] = [...m.chords].sort(
        (a, b) => a.beat - b.beat,
      );
      for (const cb of sorted) {
        const start = mi * beatsPerMeasure + (cb.beat - 1);
        const midi = chordToMidiNotes(cb.chord, CHORD_OCTAVE, cb.bass);
        flatChords.push({ startBeat: start, midi });
      }
    });
    flatChords.sort((a, b) => a.startBeat - b.startBeat);

    for (let i = 0; i < flatChords.length; i++) {
      const fc = flatChords[i];
      const nextStart =
        i + 1 < flatChords.length
          ? flatChords[i + 1].startBeat
          : totalMeasureBeats;
      const durBeats = Math.max(0.25, nextStart - fc.startBeat);
      const sustainSeconds = durBeats * beatSeconds * 0.95;
      const id = transport.schedule((time) => {
        this.chordVoice?.play(fc.midi, time, sustainSeconds, 0.7);
      }, LEAD_IN_SECONDS + fc.startBeat * beatSeconds);
      this.scheduledEvents.push(id);
    }

    // 2) Melody events.
    sheet.measures.forEach((m, mi) => {
      const melody: MelodyNote[] = m.melody ?? [];
      let cursor = 0;
      melody.forEach((n, ni) => {
        const beats = beatsForDuration(n.duration, n.dotted);
        const startBeat = mi * beatsPerMeasure + cursor;
        if (n.kind === "note") {
          const prev = melody[ni - 1];
          const isTiedFollower =
            prev &&
            prev.kind === "note" &&
            prev.tieToNext === true &&
            prev.pitch === n.pitch;
          if (!isTiedFollower) {
            let sustainBeats = beats;
            const next = melody[ni + 1];
            if (
              n.tieToNext &&
              next &&
              next.kind === "note" &&
              next.pitch === n.pitch
            ) {
              sustainBeats += beatsForDuration(next.duration, next.dotted);
            }
            const midi = vexPitchToMidi(n.pitch);
            if (midi !== null) {
              const sustainSeconds = Math.max(
                0.05,
                sustainBeats * beatSeconds * 0.92,
              );
              const id = transport.schedule((time) => {
                this.melodyVoice?.play(midi, time, sustainSeconds, 0.85);
              }, LEAD_IN_SECONDS + startBeat * beatSeconds);
              this.scheduledEvents.push(id);
            }
          }
        }
        cursor += beats;
      });
    });

    // 3) End-of-sheet stop.
    const totalSeconds =
      LEAD_IN_SECONDS + totalMeasureBeats * beatSeconds + 0.8;
    this.endCallback = options?.onEnded ?? null;
    this.endEvent = transport.scheduleOnce(() => {
      this.cancel();
      this.endCallback?.();
    }, totalSeconds);

    this._isPlaying = true;
    transport.start();
  }

  cancel(): void {
    const transport = Tone.getTransport();
    for (const id of this.scheduledEvents) transport.clear(id);
    this.scheduledEvents = [];
    if (this.endEvent !== null) {
      transport.clear(this.endEvent);
      this.endEvent = null;
    }
    transport.stop();
    transport.position = 0;
    this.chordVoice?.releaseAll();
    this.melodyVoice?.releaseAll();
    this._isPlaying = false;
  }
}

export const sheetPlayback = new SheetPlayback();
