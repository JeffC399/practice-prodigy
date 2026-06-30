import type { LyricSyllable, MelodyNote, Sheet } from "@/lib/sheets/types";

/**
 * Lyric-cursor helpers (Phase 24c).
 *
 * The lyric cursor walks pitched notes in document order, skipping
 * rests and "tied follower" notes (the second-and-later notes of a
 * tied chain, whose syllable is inherited visually via the tie).
 */

export type LyricCursor = {
  measureIdx: number;
  noteIdx: number;
};

/**
 * Returns true if the note at `measureIdx, noteIdx` is eligible to
 * carry a lyric syllable. Pitched notes are eligible; rests and tied
 * followers are not.
 *
 * Tied-follower detection looks at the immediately previous note in
 * the SAME measure. Phase 24b.2 only renders ties within a measure;
 * cross-measure tied followers will be added when Phase 24b.4 ships
 * cross-measure ties.
 */
export function isLyricEligible(
  sheet: Sheet,
  measureIdx: number,
  noteIdx: number,
): boolean {
  const measure = sheet.measures[measureIdx];
  if (!measure) return false;
  const melody = measure.melody ?? [];
  const note = melody[noteIdx];
  if (!note || note.kind !== "note") return false;
  if (noteIdx === 0) return true;
  const prev = melody[noteIdx - 1];
  if (
    prev &&
    prev.kind === "note" &&
    prev.tieToNext === true &&
    prev.pitch === note.pitch
  ) {
    return false;
  }
  return true;
}

/** Flat list of every lyric-eligible position in document order. */
export function listLyricPositions(sheet: Sheet): LyricCursor[] {
  const out: LyricCursor[] = [];
  sheet.measures.forEach((measure, measureIdx) => {
    (measure.melody ?? []).forEach((_, noteIdx) => {
      if (isLyricEligible(sheet, measureIdx, noteIdx)) {
        out.push({ measureIdx, noteIdx });
      }
    });
  });
  return out;
}

function cursorEquals(a: LyricCursor, b: LyricCursor): boolean {
  return a.measureIdx === b.measureIdx && a.noteIdx === b.noteIdx;
}

/** First lyric-eligible position, or null if there are none. */
export function firstLyricPosition(sheet: Sheet): LyricCursor | null {
  const all = listLyricPositions(sheet);
  return all[0] ?? null;
}

/** Next lyric-eligible position after `cursor`, or null at end-of-sheet. */
export function nextLyricPosition(
  sheet: Sheet,
  cursor: LyricCursor,
): LyricCursor | null {
  const all = listLyricPositions(sheet);
  const idx = all.findIndex((p) => cursorEquals(p, cursor));
  if (idx < 0 || idx === all.length - 1) return null;
  return all[idx + 1];
}

/** Previous lyric-eligible position before `cursor`, or null at start. */
export function prevLyricPosition(
  sheet: Sheet,
  cursor: LyricCursor,
): LyricCursor | null {
  const all = listLyricPositions(sheet);
  const idx = all.findIndex((p) => cursorEquals(p, cursor));
  if (idx <= 0) return null;
  return all[idx - 1];
}

/**
 * Parse a draft input string into a (clean text, continuation) pair.
 * The user types `love-` for a hyphenated continuation and `ah_` for
 * a melisma; we strip the marker so it isn't double-rendered.
 */
export function parseLyricInput(raw: string): LyricSyllable | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.endsWith("-")) {
    const text = trimmed.slice(0, -1).trim();
    if (text.length === 0) return null;
    return { text, continuation: "hyphen" };
  }
  if (trimmed.endsWith("_")) {
    const text = trimmed.slice(0, -1).trim();
    if (text.length === 0) return null;
    return { text, continuation: "underscore" };
  }
  return { text: trimmed, continuation: "none" };
}

/** Format an existing syllable back to its editable input form. */
export function formatLyricForInput(syllable: LyricSyllable): string {
  if (syllable.continuation === "hyphen") return `${syllable.text}-`;
  if (syllable.continuation === "underscore") return `${syllable.text}_`;
  return syllable.text;
}

/**
 * Returns the lyric currently attached to the note at `cursor`, or
 * undefined if none.
 */
export function getLyricAt(
  sheet: Sheet,
  cursor: LyricCursor,
): LyricSyllable | undefined {
  const note = sheet.measures[cursor.measureIdx]?.melody?.[cursor.noteIdx];
  if (!note || note.kind !== "note") return undefined;
  return note.lyric;
}

/**
 * Returns a new measures array with the note at `cursor` carrying the
 * supplied syllable (or no syllable when `syllable === null`). Pure
 * function — caller hands the result to `updateSheet`.
 */
export function setLyricAt(
  sheet: Sheet,
  cursor: LyricCursor,
  syllable: LyricSyllable | null,
): Sheet["measures"] {
  return sheet.measures.map((m, mi) => {
    if (mi !== cursor.measureIdx) return m;
    const melody = m.melody ?? [];
    const next: MelodyNote[] = melody.map((n, ni) => {
      if (ni !== cursor.noteIdx) return n;
      if (n.kind !== "note") return n;
      if (syllable === null) {
        const { lyric: _drop, ...rest } = n;
        void _drop;
        return rest;
      }
      return { ...n, lyric: syllable };
    });
    return { ...m, melody: next };
  });
}
