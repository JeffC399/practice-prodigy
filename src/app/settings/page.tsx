"use client";

import {
  Check,
  Copy,
  Download,
  RotateCcw,
  Sparkles,
  Sun,
  Moon,
  Monitor,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BackButton } from "@/components/shell/back-button";
import {
  decodeAppearance,
  encodeAppearance,
} from "@/lib/state/share-appearance";
import {
  CHORD_NOTATION_STYLES,
  NOTATION_STYLE_DISPLAY_NAMES,
  type ChordNotationStyle,
} from "@/lib/music/render-chord";
import { useDrillsLibrary } from "@/lib/state/drills-library";
import {
  ACCENT_PALETTE_DISPLAY_NAMES,
  ACCENT_PALETTE_SWATCHES,
  ACCENT_PALETTES,
  APPEARANCE_MOOD_DESCRIPTIONS,
  APPEARANCE_MOOD_DISPLAY_NAMES,
  APPEARANCE_MOODS,
  CHORD_FONT_DISPLAY_NAMES,
  CHORD_FONTS,
  CORNER_RADII,
  CORNER_RADIUS_DISPLAY_NAMES,
  FONT_SCALE_DISPLAY_NAMES,
  FONT_SCALES,
  NOTE_COLORING_DISPLAY_NAMES,
  NOTE_COLORINGS,
  PAPER_COLOR_DISPLAY_NAMES,
  PAPER_COLOR_SWATCHES,
  PAPER_COLORS,
  PATTERN_DISPLAYS,
  PATTERN_DISPLAY_DESCRIPTIONS,
  PATTERN_DISPLAY_LABELS,
  PRACTICE_LAYOUT_DESCRIPTIONS,
  PRACTICE_LAYOUT_DISPLAY_NAMES,
  PRACTICE_LAYOUTS,
  THEME_MODE_DISPLAY_NAMES,
  THEME_MODES,
  THEME_PALETTE_DISPLAY_NAMES,
  THEME_PALETTES,
  UI_BRIGHTNESS_DEFAULT,
  UI_BRIGHTNESS_MAX,
  UI_BRIGHTNESS_MIN,
  UI_DENSITIES,
  UI_DENSITY_DISPLAY_NAMES,
  UI_FONT_DISPLAY_NAMES,
  UI_FONTS,
  UI_SATURATION_DEFAULT,
  UI_SATURATION_MAX,
  UI_SATURATION_MIN,
  appearanceSlicesEqual,
  getAppearanceSnapshot,
  useUserPrefs,
  type AppearanceMood,
  type AppearanceSlice,
  type ThemeMode,
  type ThemePalette,
} from "@/lib/state/user-prefs";

/**
 * Settings — the user-global preferences surface (PROJECT-DESIGN.md
 * §3.2 cascading-defaults "User" layer + §4.8 settings architecture).
 *
 * Phase 34 (this pass) — Appearance Overhaul. The user asked for
 * "maximum degree of control over look/feel", so this page is now the
 * central mission-control for every visual preference:
 *
 *   - Theme mode (light/dark/system) + auto-by-time
 *   - Predefined theme palettes (Nord, Dracula, Solarized, Sepia,
 *     High Contrast, Warm, Cool, plus the brand default)
 *   - Accent color swatches + arbitrary custom accent color picker
 *   - Font scale (compact/normal/large) + UI density (compact/normal/roomy)
 *   - Paper color swatches for the sheet-music surface
 *   - UI font family + chord font family defaults
 *   - Note pitch coloring (Boomwhacker on lead sheets)
 *   - Accessibility: reduce motion, larger click targets
 *   - Reset appearance to defaults (one click)
 *
 * The cascade discipline: per-drill / per-sheet settings ALWAYS
 * override the user-global defaults set here. Settings is the fallback
 * layer for when a drill / sheet doesn't specify its own value.
 */
export default function SettingsPage() {
  // Existing prefs (Phase 9 + earlier).
  const theme = useUserPrefs((s) => s.theme);
  const setTheme = useUserPrefs((s) => s.setTheme);
  const accent = useUserPrefs((s) => s.accent);
  const setAccent = useUserPrefs((s) => s.setAccent);
  const practiceLayout = useUserPrefs((s) => s.practiceLayout);
  const setPracticeLayout = useUserPrefs((s) => s.setPracticeLayout);
  const notationDefault = useUserPrefs((s) => s.notationDefault);
  const setNotationDefault = useUserPrefs((s) => s.setNotationDefault);
  const patternDisplay = useUserPrefs((s) => s.patternDisplay);
  const setPatternDisplay = useUserPrefs((s) => s.setPatternDisplay);

  // Phase 34 — all new appearance prefs.
  const themePalette = useUserPrefs((s) => s.themePalette);
  const setThemePalette = useUserPrefs((s) => s.setThemePalette);
  const customAccent = useUserPrefs((s) => s.customAccent);
  const setCustomAccent = useUserPrefs((s) => s.setCustomAccent);
  const fontScale = useUserPrefs((s) => s.fontScale);
  const setFontScale = useUserPrefs((s) => s.setFontScale);
  const uiDensity = useUserPrefs((s) => s.uiDensity);
  const setUiDensity = useUserPrefs((s) => s.setUiDensity);
  const paperColor = useUserPrefs((s) => s.paperColor);
  const setPaperColor = useUserPrefs((s) => s.setPaperColor);
  const uiFont = useUserPrefs((s) => s.uiFont);
  const setUiFont = useUserPrefs((s) => s.setUiFont);
  const chordFontDefault = useUserPrefs((s) => s.chordFontDefault);
  const setChordFontDefault = useUserPrefs((s) => s.setChordFontDefault);
  const noteColoring = useUserPrefs((s) => s.noteColoring);
  const setNoteColoring = useUserPrefs((s) => s.setNoteColoring);
  const reduceMotion = useUserPrefs((s) => s.reduceMotion);
  const setReduceMotion = useUserPrefs((s) => s.setReduceMotion);
  const largerTargets = useUserPrefs((s) => s.largerTargets);
  const setLargerTargets = useUserPrefs((s) => s.setLargerTargets);
  const autoThemeByTime = useUserPrefs((s) => s.autoThemeByTime);
  const setAutoThemeByTime = useUserPrefs((s) => s.setAutoThemeByTime);
  const uiBrightness = useUserPrefs((s) => s.uiBrightness);
  const setUiBrightness = useUserPrefs((s) => s.setUiBrightness);
  const uiSaturation = useUserPrefs((s) => s.uiSaturation);
  const setUiSaturation = useUserPrefs((s) => s.setUiSaturation);
  const cornerRadius = useUserPrefs((s) => s.cornerRadius);
  const setCornerRadius = useUserPrefs((s) => s.setCornerRadius);
  const highContrast = useUserPrefs((s) => s.highContrast);
  const setHighContrast = useUserPrefs((s) => s.setHighContrast);
  const resetAppearance = useUserPrefs((s) => s.resetAppearance);
  const applyAppearanceSlice = useUserPrefs((s) => s.applyAppearanceSlice);
  const applyMood = useUserPrefs((s) => s.applyMood);

  const drillsLib = useDrillsLibrary();

  // Gate render until after mount so persisted-store hydration doesn't
  // diff against SSR's default values (same pattern as /practice).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Phase 34.2 — snapshot the appearance the moment the user enters
  // Settings so we can offer "Revert changes" and drive the Compare
  // toggle's "before" view. Snapshot is captured once on mount and
  // updated only when the user hits Revert / applies a snapshot.
  const [snapshot, setSnapshot] = useState<AppearanceSlice | null>(null);
  const currentAppearance = useMemo(
    () =>
      getAppearanceSnapshot(useUserPrefs.getState()),
    // We want to recompute on every render since any pref change
    // triggers a re-render of this component via the field selectors
    // above. Purposely empty deps + read from the store's raw state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      theme,
      accent,
      themePalette,
      customAccent,
      fontScale,
      uiDensity,
      paperColor,
      uiFont,
      chordFontDefault,
      noteColoring,
      reduceMotion,
      largerTargets,
      autoThemeByTime,
      uiBrightness,
      uiSaturation,
      cornerRadius,
      highContrast,
    ],
  );
  useEffect(() => {
    if (mounted && !snapshot) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSnapshot(currentAppearance);
    }
  }, [mounted, snapshot, currentAppearance]);
  const isDirty =
    snapshot !== null && !appearanceSlicesEqual(snapshot, currentAppearance);
  const revertToSnapshot = () => {
    if (snapshot) applyAppearanceSlice(snapshot);
  };

  // Compare toggle — "before" (frozen snapshot) vs "now" (live) shown
  // side by side in the preview.
  const [compareOpen, setCompareOpen] = useState(false);

  // Sticky preview pin — user can dismiss the stickiness for a scroll
  // session. Doesn't persist; resets on route change.
  const [previewPinned, setPreviewPinned] = useState(true);

  if (!mounted) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Loading settings…
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="flex w-full max-w-3xl flex-col gap-10">
        {/* Phase 34.7 — Back button so Settings isn't a dead-end.
            Returns to whatever page the user was on before clicking
            the settings link. Shared component with the Roadmap page. */}
        <div className="flex flex-col gap-2">
          <BackButton />
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Settings
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">
            Your preferences
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Cross-module choices that apply everywhere. Per-drill and
            per-sheet settings always override these defaults — this
            page sets the fallback values when a drill or sheet
            doesn&rsquo;t specify its own.
          </p>
        </div>

        {/* Phase 34.1 — Live preview card. Everything above shows here
            immediately as the user tweaks sliders / toggles / palettes
            below. No round-trip required — the preview reads from the
            same active CSS variables ThemeApplicator writes to <html>.
            Phase 34.2 — sticky wrapper + optional Compare view. */}
        <AppearancePreview
          pinned={previewPinned}
          onTogglePin={() => setPreviewPinned((v) => !v)}
          snapshot={snapshot}
          isDirty={isDirty}
          onRevert={revertToSnapshot}
          compareOpen={compareOpen}
          onToggleCompare={() => setCompareOpen((v) => !v)}
        />

        {/* Phase 34.2 — Preset moods bundle. One-click starting points
            for common scenarios. Applies a partial appearance slice
            through the store's atomic applyMood action. */}
        <SettingsSection
          title="Preset moods"
          description="One-click bundles for common practice scenarios. Applying a mood only touches the fields it defines — everything else stays as you set it."
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {APPEARANCE_MOODS.map((mood) => (
              <MoodTile
                key={mood}
                mood={mood}
                onApply={() => applyMood(mood)}
              />
            ))}
          </div>
        </SettingsSection>

        {/* APPEARANCE — the flagship visual section. Theme, palette,
            accent, custom accent, and auto-by-time all live here. */}
        <SettingsSection
          title="Theme & palette"
          description="Overall look. Palettes ship with matching light + dark variants; pick a mode below to see either."
          headerAction={
            <ResetButton onClick={resetAppearance} label="Reset appearance" />
          }
        >
          <SettingsField label="Theme mode">
            <div className="grid grid-cols-3 gap-2">
              {THEME_MODES.map((mode) => (
                <ThemeOption
                  key={mode}
                  mode={mode}
                  selected={theme === mode}
                  onSelect={() => setTheme(mode)}
                  disabled={autoThemeByTime}
                />
              ))}
            </div>
          </SettingsField>

          <SettingsField
            label="Auto-switch by time of day"
            hint="When on, the theme mode toggles automatically: light 6am–6pm, dark otherwise."
          >
            <ToggleRow
              value={autoThemeByTime}
              onChange={setAutoThemeByTime}
              label={autoThemeByTime ? "Auto" : "Manual"}
            />
          </SettingsField>

          <SettingsField label="Palette">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {THEME_PALETTES.map((palette) => {
                const isSelected = themePalette === palette;
                return (
                  <PaletteTile
                    key={palette}
                    palette={palette}
                    persistedPalette={themePalette}
                    selected={isSelected}
                    onSelect={() => setThemePalette(palette)}
                  />
                );
              })}
            </div>
          </SettingsField>
        </SettingsSection>

        <SettingsSection
          title="Accent color"
          description="Applies to primary buttons, active toggles, focus rings, and the app-wide highlight color. Pick a preset swatch, or set a fully custom color."
        >
          <SettingsField label="Preset swatches">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ACCENT_PALETTES.map((palette) => {
                const isSelected = accent === palette && !customAccent;
                return (
                  <button
                    key={palette}
                    type="button"
                    onClick={() => {
                      setAccent(palette);
                      setCustomAccent(null);
                    }}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    <span
                      className="inline-block h-4 w-4 rounded-full ring-1 ring-border"
                      style={{
                        backgroundColor: ACCENT_PALETTE_SWATCHES[palette],
                      }}
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {ACCENT_PALETTE_DISPLAY_NAMES[palette]}
                    </span>
                  </button>
                );
              })}
            </div>
          </SettingsField>

          <SettingsField
            label="Custom accent color"
            hint="Any color you like. Overrides the swatch above. Clear it to fall back to the preset."
          >
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={customAccent ?? ACCENT_PALETTE_SWATCHES[accent]}
                onChange={(e) => setCustomAccent(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-md border border-border bg-background"
                aria-label="Pick a custom accent color"
              />
              <input
                type="text"
                value={customAccent ?? ""}
                onChange={(e) =>
                  setCustomAccent(e.target.value.trim() || null)
                }
                placeholder="#f59e0b or oklch(...)"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCustomAccent(null)}
                disabled={!customAccent}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </SettingsField>
        </SettingsSection>

        {/* Phase 34.1 — Fine tuning. Screen dimming + saturation + corner
            radius + high contrast. Dimming + saturation are applied to
            UI chrome only; the sheet-music paper stays at 100/100 via
            an inverse filter so engraved notation and Boomwhacker
            colors always read true. */}
        <SettingsSection
          title="Fine tuning"
          description="Micro-adjustments that layer on top of the palette. Screen dimming and saturation affect only the app UI — your sheet-music surface always renders at 100/100 so notation and Boomwhacker colors stay true."
        >
          <SettingsField
            label={`Theme intensity — ${uiBrightness}%`}
            hint="100% is the palette's full look. Sliding down flattens toward mid-gray — in dark mode this brightens the app; in light mode it dims. Lets the brightest dark and darkest light look meaningfully closer."
          >
            <SliderRow
              value={uiBrightness}
              min={UI_BRIGHTNESS_MIN}
              max={UI_BRIGHTNESS_MAX}
              step={1}
              onChange={setUiBrightness}
              onReset={() => setUiBrightness(UI_BRIGHTNESS_DEFAULT)}
              defaultValue={UI_BRIGHTNESS_DEFAULT}
              minLabel="Flat / gray"
              maxLabel="Full palette"
            />
          </SettingsField>

          <SettingsField
            label={`Color saturation — ${uiSaturation}%`}
            hint="Slide down for a muted, eye-strain-friendly look, or up to make palette colors pop. Sheet-music colors are unaffected."
          >
            <SliderRow
              value={uiSaturation}
              min={UI_SATURATION_MIN}
              max={UI_SATURATION_MAX}
              step={1}
              onChange={setUiSaturation}
              onReset={() => setUiSaturation(UI_SATURATION_DEFAULT)}
              defaultValue={UI_SATURATION_DEFAULT}
              minLabel={`${UI_SATURATION_MIN}%`}
              maxLabel={`${UI_SATURATION_MAX}%`}
            />
          </SettingsField>

          <SettingsField
            label="Corner radius"
            hint="How rounded buttons, cards, and inputs look."
          >
            <ChipRow
              options={CORNER_RADII}
              value={cornerRadius}
              onChange={setCornerRadius}
              labels={CORNER_RADIUS_DISPLAY_NAMES}
            />
          </SettingsField>

          <SettingsField
            label="High contrast"
            hint="Deepens the separation between text and background. Layers on top of your palette — safe to combine with any theme choice."
          >
            <ToggleRow
              value={highContrast}
              onChange={setHighContrast}
              label={highContrast ? "On" : "Off"}
            />
          </SettingsField>
        </SettingsSection>

        <SettingsSection
          title="Typography & density"
          description="Text sizing, spacing, and font choices across the whole app."
        >
          <SettingsField label="Font scale">
            <ChipRow
              options={FONT_SCALES}
              value={fontScale}
              onChange={setFontScale}
              labels={FONT_SCALE_DISPLAY_NAMES}
            />
          </SettingsField>

          <SettingsField label="UI density">
            <ChipRow
              options={UI_DENSITIES}
              value={uiDensity}
              onChange={setUiDensity}
              labels={UI_DENSITY_DISPLAY_NAMES}
            />
          </SettingsField>

          <SettingsField label="UI font family">
            <select
              value={uiFont}
              onChange={(e) =>
                setUiFont(e.target.value as typeof uiFont)
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              {UI_FONTS.map((font) => (
                <option key={font} value={font}>
                  {UI_FONT_DISPLAY_NAMES[font]}
                </option>
              ))}
            </select>
          </SettingsField>

          <SettingsField
            label="Default chord font"
            hint="Used on new lead sheets. Each sheet keeps its own chord-font choice, so this only affects sheets that haven't been customized."
          >
            <select
              value={chordFontDefault}
              onChange={(e) =>
                setChordFontDefault(e.target.value as typeof chordFontDefault)
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              {CHORD_FONTS.map((font) => (
                <option key={font} value={font}>
                  {CHORD_FONT_DISPLAY_NAMES[font]}
                </option>
              ))}
            </select>
          </SettingsField>
        </SettingsSection>

        <SettingsSection
          title="Lead sheet appearance"
          description="Paper color and note coloring for the Lead Sheet Builder."
        >
          <SettingsField label="Paper color">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PAPER_COLORS.map((color) => {
                const isSelected = paperColor === color;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setPaperColor(color)}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    <span
                      className="inline-block h-4 w-4 rounded-sm ring-1 ring-border"
                      style={{
                        backgroundColor: PAPER_COLOR_SWATCHES[color],
                      }}
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {PAPER_COLOR_DISPLAY_NAMES[color]}
                    </span>
                  </button>
                );
              })}
            </div>
          </SettingsField>

          <SettingsField
            label="Note pitch coloring"
            hint="Boomwhacker colors each note by pitch class (C = red, D = orange, E = yellow, F = green, G = teal, A = blue, B = purple) — the same convention as the popular classroom Boomwhacker tubes."
          >
            <ChipRow
              options={NOTE_COLORINGS}
              value={noteColoring}
              onChange={setNoteColoring}
              labels={NOTE_COLORING_DISPLAY_NAMES}
              cols={2}
            />
          </SettingsField>
        </SettingsSection>

        <SettingsSection
          title="Accessibility"
          description="Motion + click-target adjustments. The app also respects your OS's reduced-motion setting automatically."
        >
          <SettingsField
            label="Reduce motion"
            hint="Turns off animations and transitions across the app."
          >
            <ToggleRow
              value={reduceMotion}
              onChange={setReduceMotion}
              label={reduceMotion ? "On" : "Off"}
            />
          </SettingsField>

          <SettingsField
            label="Larger click targets"
            hint="Enforces a 44×44px minimum for buttons and links — helpful on touchscreens or with fine-motor challenges."
          >
            <ToggleRow
              value={largerTargets}
              onChange={setLargerTargets}
              label={largerTargets ? "On" : "Off"}
            />
          </SettingsField>
        </SettingsSection>

        <SettingsSection
          title="Practice screen layout"
          description="Only affects the Bass Arpeggios drill screen."
        >
          <SettingsField label="Layout">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PRACTICE_LAYOUTS.map((layout) => {
                const isSelected = practiceLayout === layout;
                return (
                  <button
                    key={layout}
                    type="button"
                    onClick={() => setPracticeLayout(layout)}
                    className={`flex flex-col gap-1 rounded-md border px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? "border-primary/50 bg-primary/10"
                        : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    <span
                      className={`text-sm font-medium ${
                        isSelected ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {PRACTICE_LAYOUT_DISPLAY_NAMES[layout]}
                    </span>
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      {PRACTICE_LAYOUT_DESCRIPTIONS[layout]}
                    </span>
                  </button>
                );
              })}
            </div>
          </SettingsField>
        </SettingsSection>

        {/* NOTATION — global default chord notation style. The Setup
            screen's per-drill picker remains the override path. */}
        <SettingsSection
          title="Notation"
          description="Chord-symbol style applied across the app. The Setup screen's per-drill picker overrides this default."
        >
          <SettingsField label="Default chord-notation style">
            <select
              value={notationDefault}
              onChange={(e) =>
                setNotationDefault(e.target.value as ChordNotationStyle)
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              {CHORD_NOTATION_STYLES.map((style) => (
                <option key={style} value={style}>
                  {NOTATION_STYLE_DISPLAY_NAMES[style]}
                </option>
              ))}
            </select>
          </SettingsField>
        </SettingsSection>

        {/* PATTERN DISPLAY — GLOBAL DEFAULT. Each drill can override
            this on the setup screen (Pattern section → Pattern
            subtitle on drill screen). When a drill is set to "Follow
            global", THIS is the value it uses. */}
        <SettingsSection
          title="Pattern display"
          description="Global default for the pattern subtitle under each chord during a drill. Drills can override this per-drill on the setup screen."
        >
          <SettingsField label="Pattern subtitle">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {PATTERN_DISPLAYS.map((mode) => {
                const isSelected = patternDisplay === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPatternDisplay(mode)}
                    className={`flex flex-col gap-1 rounded-md border px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? "border-primary/50 bg-primary/10"
                        : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    <span
                      className={`text-sm font-medium ${
                        isSelected ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {PATTERN_DISPLAY_LABELS[mode]}
                    </span>
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      {PATTERN_DISPLAY_DESCRIPTIONS[mode]}
                    </span>
                  </button>
                );
              })}
            </div>
          </SettingsField>
        </SettingsSection>

        {/* Phase 34.2 — share appearance code. Encode / decode the
            appearance slice as a compact string that can be pasted
            elsewhere. Great for teachers sending exact setups to
            students. */}
        <SettingsSection
          title="Share appearance"
          description="Copy your current look as a short code. Anyone with the code — or another device of yours — can paste it here to apply the exact same appearance."
        >
          <ShareAppearance
            currentSlice={currentAppearance}
            onApply={(slice) => applyAppearanceSlice(slice)}
          />
        </SettingsSection>

        {/* DATA — single-click export of everything that lives in
            localStorage. Useful for backups, migrating to a new
            device before cloud sync ships, and for testers who want
            to send their state for debugging. */}
        <SettingsSection
          title="Data"
          description="Back up your drills and preferences, or restore from a saved bundle."
        >
          <DataExport drillsCount={drillsLib.drills.length} />
        </SettingsSection>

        <SettingsSection
          title="Account & sync"
          description="Sign in to back up your drills to the cloud and sync across devices."
          stub
        />
      </div>
    </main>
  );
}

function SettingsSection({
  title,
  description,
  stub,
  headerAction,
  children,
}: {
  title: string;
  description: string;
  stub?: boolean;
  headerAction?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={`flex flex-col gap-4 rounded-md border bg-background/30 p-5 ${
        stub
          ? "border-dashed border-border/60 opacity-60"
          : "border-border"
      }`}
    >
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {title}
          </h2>
          {stub ? (
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
              Coming soon
            </span>
          ) : (
            headerAction
          )}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </header>
      {children && <div className="flex flex-col gap-4">{children}</div>}
    </section>
  );
}

function SettingsField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {hint && (
        <span className="-mt-1 text-xs text-muted-foreground leading-relaxed">
          {hint}
        </span>
      )}
      {children}
    </div>
  );
}

const THEME_ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

function ThemeOption({
  mode,
  selected,
  onSelect,
  disabled,
}: {
  mode: ThemeMode;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  const Icon = THEME_ICONS[mode];
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      title={disabled ? "Auto-switch is on — turn it off to pick a mode" : undefined}
      className={`flex flex-col items-center gap-1.5 rounded-md border px-3 py-3 text-sm transition-colors ${
        disabled
          ? "cursor-not-allowed border-border/40 bg-background/40 text-muted-foreground/50"
          : selected
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/40"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{THEME_MODE_DISPLAY_NAMES[mode]}</span>
    </button>
  );
}

/**
 * A row of pill-style chips for enum choices (font scale, density,
 * note coloring). Generic over the option type so it works for any
 * string-literal union backed by a `Record<T, string>` label map.
 */
function ChipRow<T extends string>({
  options,
  value,
  onChange,
  labels,
  cols = 3,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  labels: Record<T, string>;
  cols?: 2 | 3;
}) {
  const gridCols = cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";
  return (
    <div className={`grid grid-cols-1 gap-2 ${gridCols}`}>
      {options.map((opt) => {
        const isSelected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-md border px-3 py-2 text-sm transition-colors ${
              isSelected
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-foreground hover:border-primary/40"
            }`}
          >
            {labels[opt]}
          </button>
        );
      })}
    </div>
  );
}

function ToggleRow({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors ${
        value
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-foreground hover:border-primary/40"
      }`}
    >
      <span className="font-medium">{label}</span>
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          value ? "bg-primary" : "bg-border"
        }`}
        aria-hidden="true"
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
            value ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function ResetButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
    >
      <RotateCcw className="h-3 w-3" aria-hidden="true" />
      {label}
    </button>
  );
}

/**
 * Slider row — a labeled range input with a "Reset" chevron on the
 * right and small min/max labels underneath. Fires `onChange` with
 * the numeric value (parseInt of the range's string value).
 */
function SliderRow({
  value,
  min,
  max,
  step,
  onChange,
  onReset,
  defaultValue,
  minLabel,
  maxLabel,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  onReset: () => void;
  defaultValue: number;
  minLabel: string;
  maxLabel: string;
}) {
  const isDefault = value === defaultValue;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <input
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-[color:var(--primary)]"
        />
        <button
          type="button"
          onClick={onReset}
          disabled={isDefault}
          className="rounded-md border border-border bg-background px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
        >
          Reset
        </button>
      </div>
      <div className="flex items-center justify-between px-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

/**
 * Palette tile with hover-preview. Applies its palette's class to
 * <html> on mouse enter and clears it on mouse leave — restoring the
 * user's persisted palette. Click permanently sets the palette (which
 * ThemeApplicator picks up via the store on the next render).
 *
 * Directly mutating <html> classList on hover bypasses the store
 * intentionally: preview shouldn't persist. The final onClick delegates
 * to the store, which then re-applies via ThemeApplicator so the
 * classes end up correct even if hover state was left in-between.
 */
function PaletteTile({
  palette,
  persistedPalette,
  selected,
  onSelect,
}: {
  palette: ThemePalette;
  persistedPalette: ThemePalette;
  selected: boolean;
  onSelect: () => void;
}) {
  const applyPreview = (p: ThemePalette) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    // Clear any palette class currently applied.
    THEME_PALETTES.forEach((tp) => root.classList.remove(`palette-${tp}`));
    if (p !== "default") root.classList.add(`palette-${p}`);
  };
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => applyPreview(palette)}
      onMouseLeave={() => applyPreview(persistedPalette)}
      onFocus={() => applyPreview(palette)}
      onBlur={() => applyPreview(persistedPalette)}
      className={`flex flex-col items-start gap-1.5 rounded-md border px-3 py-2 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background hover:border-primary/40"
      }`}
    >
      <PaletteSwatchPreview palette={palette} />
      <span className="truncate text-sm font-medium">
        {THEME_PALETTE_DISPLAY_NAMES[palette]}
      </span>
    </button>
  );
}

/**
 * Live preview card. Renders sample UI (title, buttons, card, text,
 * a mini 2-note staff) so the user sees every appearance change
 * reflect immediately. Elements use the same CSS variables the rest of
 * the app uses, so palette / accent / density / brightness / saturation
 * / corner-radius / contrast all show through here in real time.
 *
 * Phase 34.2 additions:
 *   - Sticky (via `position: sticky; top: 0.5rem`) so the preview
 *     stays visible while the user scrolls the long Settings page.
 *     Pin toggle in the header lets the user opt out for a scroll
 *     session (state is component-local; resets on route change).
 *   - Auto-collapse to a slim strip once scrolled past the natural
 *     position via a scroll observer. The full card returns as soon
 *     as the user scrolls back near the top.
 *   - Compare mode splits the preview so "before" (frozen snapshot on
 *     entry) shows alongside "now" (live). Applies the snapshot's
 *     appearance to the left half via inline CSS custom properties.
 *   - Revert button restores the initial-mount snapshot, clearing
 *     any changes made in this Settings session.
 */
function AppearancePreview({
  pinned,
  onTogglePin,
  snapshot,
  isDirty,
  onRevert,
  compareOpen,
  onToggleCompare,
}: {
  pinned: boolean;
  onTogglePin: () => void;
  snapshot: AppearanceSlice | null;
  isDirty: boolean;
  onRevert: () => void;
  compareOpen: boolean;
  onToggleCompare: () => void;
}) {
  // Track whether the sticky preview has scrolled past its natural
  // position — used to add a subtle drop-shadow so the user knows it's
  // floating. Purely visual; no size changes on scroll, so the page's
  // total scroll height stays constant and the browser never has to
  // snap-adjust the scroll position (Phase 34.2.1 fix — the previous
  // auto-collapse behavior triggered layout reflow on every scroll
  // over the sticky boundary, which the browser reconciled by yanking
  // the viewport back near the top).
  const [floating, setFloating] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pinned || !sentinelRef.current) return;
    const el = sentinelRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => setFloating(!entry.isIntersecting),
      { rootMargin: "0px", threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pinned]);

  return (
    <>
      {/* Zero-height sentinel — used by IntersectionObserver purely to
          detect "am I currently pinned?" for shadow styling. The sticky
          element's SIZE never changes based on this, so there's no
          layout reflow when it fires. */}
      <div ref={sentinelRef} className="h-px w-full" aria-hidden="true" />
      {/* Phase 34.7.2 — Dropped `backdrop-blur` + went from
          `bg-background/95` to a fully opaque `bg-background`. Any
          `backdrop-filter` (like `backdrop-blur`) promotes the element
          to a compositing layer, which causes ALL descendant text to
          lose subpixel antialiasing — this is why the "Practice
          Prodigy" heading inside the preview rendered visibly softer
          than the rest of the app. Opaque background is a cheap trade
          for crisp text, and the sticky section still reads as a
          distinct floating panel because of the border + shadow. */}
      <section
        className={`z-20 flex flex-col gap-3 rounded-md border border-border bg-background p-5 transition-shadow ${
          pinned ? "sticky top-14" : ""
        } ${pinned && floating ? "shadow-lg" : ""}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Live preview
            </span>
            {isDirty && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                Unsaved
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <PreviewIconButton
              active={compareOpen}
              disabled={!snapshot}
              onClick={onToggleCompare}
              label={compareOpen ? "Hide compare" : "Compare with before"}
              icon="split"
            />
            {isDirty && (
              <PreviewIconButton
                onClick={onRevert}
                label="Revert to state on entry"
                icon="revert"
              />
            )}
            <PreviewIconButton
              active={pinned}
              onClick={onTogglePin}
              label={pinned ? "Unpin preview" : "Pin preview"}
              icon="pin"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {compareOpen && snapshot ? (
            <>
              <PreviewHalf label="Before" frozenSlice={snapshot} />
              <PreviewHalf label="Now" frozenSlice={null} />
            </>
          ) : (
            <>
              <PreviewCard />
              <PreviewStaffCard />
            </>
          )}
        </div>
      </section>
    </>
  );
}

/**
 * The interactive left-half of the preview (chord card + buttons).
 * Renders sample UI at the CURRENT live CSS variables when
 * `frozenSlice` is null; renders at the frozen snapshot's palette /
 * accent / paper color / etc when `frozenSlice` is supplied. Frozen
 * mode is used by the Compare toggle to show "before" alongside "now".
 */
function PreviewHalf({
  label,
  frozenSlice,
}: {
  label: string;
  frozenSlice: AppearanceSlice | null;
}) {
  const frozenStyle = frozenSlice
    ? buildFrozenPreviewStyle(frozenSlice)
    : undefined;
  return (
    <div
      className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-3"
      style={frozenStyle}
    >
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <PreviewCardInner />
    </div>
  );
}

/**
 * Full-width interactive preview card (used when Compare is off).
 */
function PreviewCard() {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
      <PreviewCardInner />
    </div>
  );
}

function PreviewCardInner() {
  return (
    <>
      <h3 className="text-base font-semibold tracking-tight text-card-foreground">
        Practice Prodigy
      </h3>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Adjust the sliders and palette below — this card updates live.
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Primary
        </button>
        <button
          type="button"
          className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary/40 transition-colors"
        >
          Secondary
        </button>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
          Accent
        </span>
      </div>
    </>
  );
}

function PreviewStaffCard() {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-3">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Sample staff (paper unaffected)
      </span>
      <MiniStaffPreview />
    </div>
  );
}

/**
 * Build inline CSS variables that force the Preview subtree to render
 * as if the given appearance slice were active. Used for the "Before"
 * half of the Compare view. Doesn't attempt to reproduce every field
 * — focuses on the visible ones: primary accent, paper color.
 * (Palette classes can't be applied to a subtree without swapping
 * `<html>`, so a full palette reproduction here would require
 * inlining every palette's variable set — deferred as a follow-up.)
 */
function buildFrozenPreviewStyle(
  slice: AppearanceSlice,
): React.CSSProperties {
  const style = {} as Record<string, string>;
  const primary =
    slice.customAccent ?? ACCENT_PALETTE_SWATCHES[slice.accent];
  if (primary) {
    style["--primary"] = primary;
    style["--ring"] = primary;
  }
  style["--sheet-paper"] = PAPER_COLOR_SWATCHES[slice.paperColor];
  return style as React.CSSProperties;
}

/**
 * Small icon-only button used in the preview header (Compare / Revert
 * / Pin). Compact and non-distracting; live-updates from the same
 * accent color as everything else.
 */
function PreviewIconButton({
  onClick,
  disabled,
  active,
  label,
  icon,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  label: string;
  icon: "split" | "revert" | "pin";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/40"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {icon === "split" && (
        <svg
          viewBox="0 0 20 20"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M10 3v14M3 6h4M13 6h4M3 10h4M13 10h4M3 14h4M13 14h4" />
        </svg>
      )}
      {icon === "revert" && <Undo2 className="h-3.5 w-3.5" />}
      {icon === "pin" && (
        <svg
          viewBox="0 0 20 20"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M8 3l4 4M6 5l9 9-5 1-1 5-9-9 6-6z" />
        </svg>
      )}
    </button>
  );
}

/**
 * Preset "mood" tile — one-click bundle applier. Shows the mood's
 * name + a short description. Click applies the mood via the store's
 * atomic `applyMood` action.
 */
function MoodTile({
  mood,
  onApply,
}: {
  mood: AppearanceMood;
  onApply: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onApply}
      className="flex flex-col gap-1 rounded-md border border-border bg-background px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        {APPEARANCE_MOOD_DISPLAY_NAMES[mood]}
      </span>
      <span className="text-xs text-muted-foreground leading-relaxed">
        {APPEARANCE_MOOD_DESCRIPTIONS[mood]}
      </span>
    </button>
  );
}

/**
 * Share-appearance panel — copy your current appearance to the
 * clipboard as a short code, or paste someone else's code to apply
 * their exact look. Uses the base64-encoded slice from
 * `src/lib/state/share-appearance.ts`.
 */
function ShareAppearance({
  currentSlice,
  onApply,
}: {
  currentSlice: AppearanceSlice;
  onApply: (slice: AppearanceSlice) => void;
}) {
  const code = useMemo(() => encodeAppearance(currentSlice), [currentSlice]);
  const [importCode, setImportCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const handleImport = () => {
    const trimmed = importCode.trim();
    if (!trimmed) return;
    const decoded = decodeAppearance(trimmed);
    if (!decoded) {
      setImportError("That doesn't look like a valid appearance code.");
      return;
    }
    setImportError(null);
    onApply(decoded);
    setImportCode("");
  };

  return (
    <div className="flex flex-col gap-4">
      <SettingsField label="Your appearance code">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={code}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </SettingsField>

      <SettingsField
        label="Import an appearance code"
        hint="Paste someone else's code (or one from another device) to apply their exact look."
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={importCode}
            onChange={(e) => {
              setImportCode(e.target.value);
              if (importError) setImportError(null);
            }}
            placeholder="Paste a code here…"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={handleImport}
            disabled={!importCode.trim()}
            className="rounded-md border border-primary/60 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
          >
            Apply
          </button>
        </div>
        {importError && (
          <span className="text-xs text-destructive">{importError}</span>
        )}
      </SettingsField>
    </div>
  );
}

/**
 * Tiny 2-note SVG staff. Uses the same `--sheet-paper` variable the
 * real SheetSurface reads, so paper color changes propagate here too.
 * Marks itself with class `sheet-paper` so the CSS inverse-filter is
 * applied (matching the real sheet behavior).
 */
function MiniStaffPreview() {
  return (
    <div
      className="sheet-paper rounded-sm border border-border p-2"
      style={{ background: "var(--sheet-paper, #fbfaf5)" }}
    >
      <svg
        viewBox="0 0 200 60"
        className="h-14 w-full"
        aria-hidden="true"
      >
        {/* Five staff lines. */}
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1="10"
            y1={16 + i * 8}
            x2="190"
            y2={16 + i * 8}
            stroke="#222"
            strokeWidth="1"
          />
        ))}
        {/* Treble clef stand-in (simple text glyph). */}
        <text
          x="14"
          y="42"
          fontFamily="serif"
          fontSize="34"
          fill="#222"
        >
          𝄞
        </text>
        {/* Two quarter notes. */}
        <g>
          <ellipse cx="90" cy="32" rx="7" ry="5" fill="#e53935" />
          <line
            x1="97"
            y1="32"
            x2="97"
            y2="10"
            stroke="#222"
            strokeWidth="1.5"
          />
        </g>
        <g>
          <ellipse cx="140" cy="24" rx="7" ry="5" fill="#43a047" />
          <line
            x1="147"
            y1="24"
            x2="147"
            y2="4"
            stroke="#222"
            strokeWidth="1.5"
          />
        </g>
      </svg>
    </div>
  );
}

/**
 * Tiny 3-color swatch strip previewing a palette's dominant colors.
 * Reads directly from static values (not the live CSS variables) so
 * each preview shows its palette regardless of which one is active.
 */
function PaletteSwatchPreview({
  palette,
}: {
  palette: (typeof THEME_PALETTES)[number];
}) {
  const swatches = PALETTE_PREVIEW_SWATCHES[palette];
  return (
    <div className="flex gap-1">
      {swatches.map((c, i) => (
        <span
          key={i}
          className="inline-block h-3 w-6 rounded-sm ring-1 ring-border/60"
          style={{ backgroundColor: c }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

// [primary, background-dark, accent] preview swatches per palette.
const PALETTE_PREVIEW_SWATCHES: Record<
  (typeof THEME_PALETTES)[number],
  [string, string, string]
> = {
  default: ["#f59e0b", "#18181b", "#3f3f46"],
  nord: ["#88c0d0", "#2e3440", "#5e81ac"],
  dracula: ["#bd93f9", "#282a36", "#ff79c6"],
  solarized: ["#268bd2", "#002b36", "#b58900"],
  sepia: ["#c99a4c", "#2b2117", "#d9b878"],
  "high-contrast": ["#ffff00", "#000000", "#00ffff"],
  warm: ["#f59e0b", "#1c1310", "#ff8f42"],
  cool: ["#22d3ee", "#0d1a1e", "#67e8f9"],
};

/**
 * Bundles drills-library + user-prefs into a single .json blob and
 * triggers a download. Resume-session blob is intentionally excluded
 * (it's transient and would clutter the export). Stub for import is
 * present in the UI but disabled — import implementation lands in a
 * follow-up since it requires schema-validating untrusted JSON.
 */
function DataExport({ drillsCount }: { drillsCount: number }) {
  const drillsLib = useDrillsLibrary();
  const linkRef = useRef<HTMLAnchorElement | null>(null);

  const handleExport = () => {
    const bundle = {
      app: "practice-prodigy",
      version: 1,
      exportedAt: new Date().toISOString(),
      drills: drillsLib.drills,
      userPrefs: useUserPrefs.getState(),
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = linkRef.current ?? document.createElement("a");
    a.href = url;
    a.download = `practice-prodigy-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleExport}
        className="flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Download backup ({drillsCount} drill
        {drillsCount === 1 ? "" : "s"} + prefs)
      </button>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Saves a single JSON file with every saved drill plus your
        appearance / notation / layout preferences. Import is coming
        in a follow-up.
      </p>
      <a ref={linkRef} className="hidden" aria-hidden="true" />
    </div>
  );
}
