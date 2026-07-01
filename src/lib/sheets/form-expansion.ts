import type { SheetMeasure } from "@/lib/sheets/types";

/**
 * Phase 28.1 — Form-marking playback expansion.
 *
 * Walks a linear array of `SheetMeasure`s and emits the expanded play
 * order — a sequence of source-measure indices — that obeys the form
 * markings (repeats, first/second endings, D.C. al Fine, D.S. al Coda,
 * To Coda, Fine, Coda, Segno).
 *
 * Kept as a pure helper so the algorithm can be reasoned about in
 * isolation from Tone.js scheduling. The playback engine consumes the
 * returned `PlayStep[]` and schedules audio events in expanded order.
 *
 * Basic Tier scope (matches Phase 28.0's data model):
 *   - Single-level repeats (𝄆 ... 𝄇). Not nested.
 *   - First / second endings via `volta: 1 | 2`.
 *   - D.C. al Fine (jump back to top, play until `fine`).
 *   - D.S. al Coda (jump back to `segno`, play until `to-coda`, then
 *     jump forward to `coda`, play through to end).
 *
 * Design decisions:
 *   - If a repeat region has no explicit `repeatStart`, the section
 *     starts at measure 0 (standard convention: implicit start-of-piece).
 *   - Volta measures play only on the pass number matching their
 *     volta number. Non-volta measures inside a repeat play on every
 *     pass. A first ending (volta 1) plays only on pass 1; second
 *     ending (volta 2) only on pass 2.
 *   - `D.C. al Fine` and `D.S. al Coda` each fire at most once per
 *     playthrough (standard convention — no infinite loops).
 *   - Missing `fine` after a D.C.: play to end of piece.
 *   - Missing `to-coda` or `coda` after a D.S. al Coda: play to end.
 *   - Passes through the same repeatEnd do NOT re-fire the repeat
 *     after the second time — that's the standard "|: A :|" =
 *     "play A twice" convention.
 *
 * Safety: hard cap of MAX_STEPS (2000) prevents runaway loops in
 * pathological form markings (mutually-recursive jumps). Real charts
 * would never approach this — a 32-bar song with all repeats + D.C.
 * expanded is ~80 measures.
 */

/** One entry in the expanded playback order. */
export type PlayStep = {
  /** Index into the original `sheet.measures` array. */
  sourceMeasureIdx: number;
};

const MAX_STEPS = 2000;

/**
 * Find the nearest previous measure carrying `mark: "segno"` looking
 * backward from `fromIdx` (inclusive). Returns -1 if none.
 */
function findSegnoBefore(measures: SheetMeasure[], fromIdx: number): number {
  for (let i = fromIdx; i >= 0; i--) {
    if (measures[i]?.mark === "segno") return i;
  }
  return -1;
}

/**
 * Find the nearest next measure carrying `mark: "coda"` looking
 * forward from `fromIdx` (exclusive). Returns -1 if none.
 */
function findCodaAfter(measures: SheetMeasure[], fromIdx: number): number {
  for (let i = fromIdx + 1; i < measures.length; i++) {
    if (measures[i]?.mark === "coda") return i;
  }
  return -1;
}

/**
 * Find the matching `repeatStart` for a `repeatEnd` at `endIdx`.
 * Returns the index of the nearest previous `repeatStart` (inclusive
 * of endIdx), or 0 if none is found (standard convention: implicit
 * start-of-piece is the repeat origin).
 */
function findRepeatStartFor(measures: SheetMeasure[], endIdx: number): number {
  for (let i = endIdx; i >= 0; i--) {
    if (measures[i]?.repeatStart) return i;
  }
  return 0;
}

/**
 * Expand a linear measure list into playback order that obeys form
 * markings. Pure function — no side effects, deterministic output.
 */
export function expandFormPlayOrder(measures: SheetMeasure[]): PlayStep[] {
  const result: PlayStep[] = [];
  if (measures.length === 0) return result;

  // Pass number for each repeat-start index. New repeat sections
  // start at pass 1; when the section's repeatEnd fires a jump-back,
  // the count bumps to 2.
  const passCount = new Map<number, number>();
  const getPass = (sectionStart: number): number =>
    passCount.get(sectionStart) ?? 1;

  // Track how many times each repeatEnd has already sent us back.
  // Standard convention: a single "|:...:|" pair fires exactly once
  // (i.e. plays the section twice). We check this counter on the
  // way OUT of a repeatEnd measure.
  const repeatEndFired = new Set<number>();

  let dcFired = false;
  let dsFired = false;
  let watchForFine = false; // true after D.C. or D.S.
  let watchForToCoda = false; // true after D.S. al Coda

  // Current "active" repeat section start. Default = measure 0
  // (implicit start-of-piece as the origin of any repeatEnd without
  // an explicit start).
  let activeSectionStart = 0;

  let i = 0;
  let steps = 0;

  while (i < measures.length && steps < MAX_STEPS) {
    steps++;
    const m = measures[i];

    // ---- Skip logic based on voltas ---------------------------------
    // If this measure is a volta, its number must match the current
    // pass of the active repeat section for us to play it. Otherwise
    // skip forward.
    if (m.volta !== undefined) {
      const currentPass = getPass(activeSectionStart);
      if (m.volta !== currentPass) {
        i++;
        continue;
      }
    }

    // ---- Update active section start on entering a repeatStart ------
    if (m.repeatStart) {
      activeSectionStart = i;
      if (!passCount.has(activeSectionStart)) {
        passCount.set(activeSectionStart, 1);
      }
    }

    // ---- Play this measure ------------------------------------------
    result.push({ sourceMeasureIdx: i });

    // ---- After-play instruction handling ----------------------------
    // Fine: stops playback ONLY if we're on a jump-back pass (D.C. /
    // D.S.). First-pass Fine is ignored — that's the standard
    // convention (the Fine only fires "after the D.C. / D.S.").
    if (m.instruction === "fine" && watchForFine) {
      break;
    }

    // To Coda: on a D.S. al Coda pass, when we hit To Coda, jump to
    // the next Coda mark and clear watchForToCoda.
    if (m.instruction === "to-coda" && watchForToCoda) {
      const codaIdx = findCodaAfter(measures, i);
      if (codaIdx >= 0) {
        i = codaIdx;
        watchForToCoda = false;
        // After the jump, watchForFine stays true (a Fine after the
        // Coda would still stop us).
        continue;
      }
      // No Coda mark found — play through the rest linearly. Drop
      // the flag so we don't check again.
      watchForToCoda = false;
    }

    // D.C. al Fine: jump to measure 0 and watch for Fine. Fires at
    // most once per playthrough.
    if (m.instruction === "dc-al-fine" && !dcFired) {
      dcFired = true;
      watchForFine = true;
      // Reset repeat state so the from-the-top pass replays repeats
      // that would otherwise be considered "already fired." Standard
      // convention.
      passCount.clear();
      repeatEndFired.clear();
      activeSectionStart = 0;
      i = 0;
      continue;
    }

    // D.S. al Coda: jump to nearest previous Segno, watch for
    // To Coda + Fine. Fires at most once.
    if (m.instruction === "ds-al-coda" && !dsFired) {
      dsFired = true;
      watchForFine = true;
      watchForToCoda = true;
      const segnoIdx = findSegnoBefore(measures, i);
      const jumpTo = segnoIdx >= 0 ? segnoIdx : 0;
      passCount.clear();
      repeatEndFired.clear();
      activeSectionStart = jumpTo;
      i = jumpTo;
      continue;
    }

    // ---- Repeat-end jump-back ---------------------------------------
    // Fires only once per repeatEnd, then advances past on subsequent
    // reaches. This handles the standard "play section twice" case
    // AND correctly handles a D.C./D.S. jump-back re-crossing the
    // same repeatEnd (repeatEndFired is cleared on D.C./D.S.).
    if (m.repeatEnd && !repeatEndFired.has(i)) {
      repeatEndFired.add(i);
      const sectionStart = findRepeatStartFor(measures, i);
      activeSectionStart = sectionStart;
      // Bump pass counter for this section: 1 → 2.
      passCount.set(sectionStart, getPass(sectionStart) + 1);
      i = sectionStart;
      continue;
    }

    i++;
  }

  return result;
}
