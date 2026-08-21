import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Zero-friction sign-in for bar staff: reuse the existing session or create
 * an anonymous one. Requires "Allow anonymous sign-ins" to be enabled in the
 * Supabase dashboard (Authentication → Providers). Identity upgrade (magic
 * link) can be layered on later without losing game history.
 */
export async function ensureSignedIn(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;

  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error || !anon.user) {
    throw new Error(
      `Sign-in failed: ${error?.message ?? "no user"}. ` +
        "Check that anonymous sign-ins are enabled in Supabase Auth settings.",
    );
  }
  return anon.user.id;
}
