/**
 * Placeholder Database type for Supabase clients.
 *
 * Slice A.1 (Phase 78) — the real type will be generated once Slice A's
 * migrations land the profile / routines / sessions / songs tables in
 * both `practice-prodigy-dev` and `practice-prodigy-prod`. Command:
 *
 *   supabase gen types typescript --project-id buqtiadbmeticaqxfyyk \
 *     > src/lib/supabase/database.types.ts
 *
 * Until then, this loose shape lets the client build without errors.
 * Table + column type safety kicks in once we regenerate.
 */
export type Database = {
  public: {
    Tables: Record<string, unknown>;
    Views: Record<string, unknown>;
    Functions: Record<string, unknown>;
    Enums: Record<string, unknown>;
  };
};
