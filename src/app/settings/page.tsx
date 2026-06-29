"use client";

import { Download, Sun, Moon, Monitor } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  PRACTICE_LAYOUT_DESCRIPTIONS,
  PRACTICE_LAYOUT_DISPLAY_NAMES,
  PRACTICE_LAYOUTS,
  THEME_MODE_DISPLAY_NAMES,
  THEME_MODES,
  useUserPrefs,
  type ThemeMode,
} from "@/lib/state/user-prefs";

/**
 * Settings — the user-global preferences surface (PROJECT-DESIGN.md
 * §3.2 cascading-defaults "User" layer + §4.8 settings architecture).
 *
 * Phase 9.0 (this build) ships:
 *   - Appearance: theme (light/dark/system) + accent palette + practice layout
 *   - Notation: global default chord-notation style
 *   - Data: export all drills + prefs as a single .json bundle
 *
 * Stubs are visible for the sections that come in later sub-phases:
 *   - Practice defaults (default BPM / time sig / count-in / pattern)
 *   - Audio (master volume, click sound, output device)
 *   - Accessibility (reduced motion, text scaling, high contrast)
 *   - Account / sync (placeholder until Supabase Auth in v1.1)
 *
 * The cascade discipline: per-drill settings ALWAYS override the
 * user-global defaults set here. Settings is the fallback layer for
 * when a drill doesn't specify a value, not a hard override.
 */
export default function SettingsPage() {
  const theme = useUserPrefs((s) => s.theme);
  const setTheme = useUserPrefs((s) => s.setTheme);
  const accent = useUserPrefs((s) => s.accent);
  const setAccent = useUserPrefs((s) => s.setAccent);
  const practiceLayout = useUserPrefs((s) => s.practiceLayout);
  const setPracticeLayout = useUserPrefs((s) => s.setPracticeLayout);
  const notationDefault = useUserPrefs((s) => s.notationDefault);
  const setNotationDefault = useUserPrefs((s) => s.setNotationDefault);
  const drillsLib = useDrillsLibrary();

  // Gate render until after mount so persisted-store hydration doesn't
  // diff against SSR's default values (same pattern as /practice).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

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
      <div className="flex w-full max-w-2xl flex-col gap-10">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Settings
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">
            Your preferences
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Cross-module choices that apply everywhere. Per-drill
            settings (on the Setup screen) always override these
            defaults — this page sets the fallback values when a
            drill doesn&rsquo;t specify its own.
          </p>
        </div>

        {/* APPEARANCE — theme + accent + layout. The visible flagship
            section: changing any value here re-tints the whole app
            instantly via the ThemeApplicator client component. */}
        <SettingsSection
          title="Appearance"
          description="Theme and accent. Applies to every screen."
        >
          <SettingsField label="Theme">
            <div className="grid grid-cols-3 gap-2">
              {THEME_MODES.map((mode) => (
                <ThemeOption
                  key={mode}
                  mode={mode}
                  selected={theme === mode}
                  onSelect={() => setTheme(mode)}
                />
              ))}
            </div>
          </SettingsField>

          <SettingsField label="Accent color">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ACCENT_PALETTES.map((palette) => {
                const isSelected = accent === palette;
                return (
                  <button
                    key={palette}
                    type="button"
                    onClick={() => setAccent(palette)}
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

          <SettingsField label="Practice screen layout">
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

        {/* Stubs — visible but disabled, so the user knows these are
            coming without having to guess from the roadmap. */}
        <SettingsSection
          title="Practice defaults"
          description="Default tempo, time signature, count-in, and arpeggio pattern for new drills."
          stub
        />
        <SettingsSection
          title="Audio"
          description="Master volume, click sound choice, output device."
          stub
        />
        <SettingsSection
          title="Accessibility"
          description="Reduced motion, text scaling, high contrast."
          stub
        />
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
  children,
}: {
  title: string;
  description: string;
  stub?: boolean;
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
          {stub && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
              Coming soon
            </span>
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
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
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
}: {
  mode: ThemeMode;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = THEME_ICONS[mode];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-center gap-1.5 rounded-md border px-3 py-3 text-sm transition-colors ${
        selected
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
