import type {
  MelodyNote,
  Sheet,
  SheetOctavaShift,
} from "@/lib/sheets/types";
import { nudgePitch } from "@/lib/sheets/melody-caret";

/**
 * Phase 31.4 — Selection model for melody notes.
 *
 * Selection is UI-only state (not persisted). Each selected item is
 * identified by `${measureIdx}:${noteIdx}` — the same coordinate
 * system used by the SheetSurface's onLayout callback so drag-marquee
 * and click-to-select share the same identifier space.
 *
 * Operations are pure functions over the sheet's measures array: each
 * returns a NEW measures array with the operation applied. The editor
 * consumes them via `updateSheet(id, { measures })`, so undo/redo,
 * autosave, and cross-measure tie renderers all keep working with
 * zero additional wiring.
 */

export type NoteRef = { measureIdx: number; noteIdx: number };

export type MelodySelection = Set<string>;

/** Encode a NoteRef as its string id (used as the Set key). */
export function refId(ref: NoteRef): string {
  return `${ref.measureIdx}:${ref.noteIdx}`;
}

/** Decode a string id back into a NoteRef. */
export function parseRefId(id: string): NoteRef | null {
  const [m, n] = id.split(":").map((s) => parseInt(s, 10));
  if (Number.isNaN(m) || Number.isNaN(n)) return null;
  return { measureIdx: m, noteIdx: n };
}

/** Sort a list of refs in melody-order (measure, then note within measure). */
export function sortRefs(refs: NoteRef[]): NoteRef[] {
  return [...refs].sort(
    (a, b) =>
      a.measureIdx - b.measureIdx || a.noteIdx - b.noteIdx,
  );
}

/**
 * Delete every selected note from its measure. Returns a fresh
 * measures array. Indices in the selection are pre-sorted then walked
 * in descending order so each splice doesn't invalidate the following
 * indices.
 */
export function deleteSelection(
  sheet: Sheet,
  selection: MelodySelection,
): Sheet["measures"] {
  if (selection.size === 0) return sheet.measures;
  // Group by measureIdx to minimize allocations.
  const perMeasure = new Map<number, number[]>();
  for (const id of selection) {
    const ref = parseRefId(id);
    if (!ref) continue;
    const arr = perMeasure.get(ref.measureIdx) ?? [];
    arr.push(ref.noteIdx);
    perMeasure.set(ref.measureIdx, arr);
  }
  return sheet.measures.map((m, mi) => {
    const idxs = perMeasure.get(mi);
    if (!idxs || idxs.length === 0) return m;
    // Walk high-to-low so splice doesn't shift the remaining indexes.
    const melody = [...(m.melody ?? [])];
    idxs
      .slice()
      .sort((a, b) => b - a)
      .forEach((i) => melody.splice(i, 1));
    return { ...m, melody };
  });
}

/**
 * Transpose every selected pitched note by `direction` staff steps
 * (letter cycle — C → D → E …). Rests unaffected. When `octaves` is
 * true, shift by 7 letter steps (one full octave).
 */
export function transposeSelection(
  sheet: Sheet,
  selection: MelodySelection,
  direction: 1 | -1,
  octaves: boolean,
): Sheet["measures"] {
  if (selection.size === 0) return sheet.measures;
  const perMeasure = new Map<number, Set<number>>();
  for (const id of selection) {
    const ref = parseRefId(id);
    if (!ref) continue;
    const set = perMeasure.get(ref.measureIdx) ?? new Set<number>();
    set.add(ref.noteIdx);
    perMeasure.set(ref.measureIdx, set);
  }
  const steps = octaves ? 7 : 1;
  return sheet.measures.map((m, mi) => {
    const idxs = perMeasure.get(mi);
    if (!idxs || idxs.size === 0) return m;
    const melody = (m.melody ?? []).map((n, ni) => {
      if (!idxs.has(ni) || n.kind !== "note") return n;
      let pitch = n.pitch;
      for (let s = 0; s < steps; s++) {
        pitch = nudgePitch(pitch, direction);
      }
      return { ...n, pitch };
    });
    return { ...m, melody };
  });
}

/**
 * Copy the selected notes into a plain array preserving melody-order.
 * Cross-measure boundaries are marked by an implicit "measure break"
 * so paste can restore the shape (v1 flattens — paste inserts all
 * notes contiguously at the caret without preserving bar boundaries).
 */
export function copySelection(
  sheet: Sheet,
  selection: MelodySelection,
): MelodyNote[] {
  const refs = sortRefs(
    Array.from(selection)
      .map(parseRefId)
      .filter((r): r is NoteRef => r !== null),
  );
  const out: MelodyNote[] = [];
  for (const ref of refs) {
    const m = sheet.measures[ref.measureIdx];
    const n = m?.melody?.[ref.noteIdx];
    if (n) out.push(n);
  }
  return out;
}

/**
 * Return the last selected note's ref in melody-order, or null when
 * the selection is empty. Callers use this to anchor paste immediately
 * after the selection.
 */
export function lastSelectedRef(selection: MelodySelection): NoteRef | null {
  const refs = sortRefs(
    Array.from(selection)
      .map(parseRefId)
      .filter((r): r is NoteRef => r !== null),
  );
  return refs.length > 0 ? refs[refs.length - 1] : null;
}

/**
 * Insert a list of MelodyNotes into a measure at a specific position.
 * `target` = null → append to the last measure of the sheet.
 * Otherwise insert into measures[measureIdx] immediately AFTER
 * afterNoteIdx (use afterNoteIdx = -1 to prepend).
 *
 * This is a literal insert — no beat-fit / auto-split awareness.
 * The Phase 31.0 beat-count badge will flag any measure that ends up
 * over- or under-filled; users can split manually via the selection
 * + delete flow if the paste overflows.
 */
export function pasteToSheet(
  sheet: Sheet,
  notes: MelodyNote[],
  target: { measureIdx: number; afterNoteIdx: number } | null,
): Sheet["measures"] {
  if (notes.length === 0 || sheet.measures.length === 0) {
    return sheet.measures;
  }
  const targetMi = target?.measureIdx ?? sheet.measures.length - 1;
  const targetNi = target ? target.afterNoteIdx + 1 : -1;
  return sheet.measures.map((m, mi) => {
    if (mi !== targetMi) return m;
    const melody = [...(m.melody ?? [])];
    if (targetNi < 0 || targetNi > melody.length) {
      melody.push(...notes);
    } else {
      melody.splice(targetNi, 0, ...notes);
    }
    return { ...m, melody };
  });
}

/**
 * Apply (or clear when `shift` is undefined) an ottava marking to
 * every measure that contains at least one selected note. Phase 31.4.1
 * lets the user cover partial-line ottava scenarios by selecting only
 * the notes in the measures that need the shift.
 */
export function applyOctavaToSelection(
  sheet: Sheet,
  selection: MelodySelection,
  shift: SheetOctavaShift | undefined,
): Sheet["measures"] {
  if (selection.size === 0) return sheet.measures;
  const measuresToShift = new Set<number>();
  for (const id of selection) {
    const ref = parseRefId(id);
    if (ref) measuresToShift.add(ref.measureIdx);
  }
  return sheet.measures.map((m, mi) =>
    measuresToShift.has(mi) ? { ...m, octavaShift: shift } : m,
  );
}
