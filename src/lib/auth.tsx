import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface Profile { id: string; full_name: string; email: string | null; allowed_pages: string | null }
type Status = "loading" | "signed_out" | "no_role" | "ready";

interface AuthState {
  status: Status;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: string[];
  isAdmin: boolean;
  allowedPages: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

async function loadAccess(userId: string) {
  const [{ data: roles }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("profiles").select("id, full_name, email, allowed_pages").eq("id", userId).maybeSingle(),
  ]);
  return { roles: (roles ?? []).map((r) => r.role as string), profile: (profile as Profile | null) ?? null };
}

/**
 * Gives a signed-in account its school role on first visit:
 * imported desktop account (verified email match) → invite code from sign-up → first administrator.
 */
async function tryActivate(user: User): Promise<boolean> {
  const { data: legacy } = await supabase.rpc("claim_legacy_account");
  if (legacy) return true;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  if (typeof meta["invite_code"] === "string" && meta["invite_code"]) {
    const { data } = await supabase.rpc("redeem_invite", { _code: meta["invite_code"] });
    if (data) return true;
  }
  if (meta["intent"] === "first_admin") {
    const { data } = await supabase.rpc("claim_first_admin");
    if (data) return true;
  }
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const activating = useRef<string | null>(null);

  const resolve = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s?.user) { setStatus("signed_out"); setRoles([]); setProfile(null); return; }
    let access = await loadAccess(s.user.id);
    if (access.roles.length === 0 && activating.current !== s.user.id) {
      activating.current = s.user.id;
      if (await tryActivate(s.user)) access = await loadAccess(s.user.id);
    }
    setRoles(access.roles);
    setProfile(access.profile);
    setStatus(access.roles.length ? "ready" : "no_role");
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "TOKEN_REFRESHED") { setSession(s); return; }
      // Defer DB calls out of the auth callback.
      setTimeout(() => { void resolve(s); }, 0);
    });
    supabase.auth.getSession().then(({ data }) => resolve(data.session));
    return () => sub.subscription.unsubscribe();
  }, [resolve]);

  const isAdmin = roles.includes("admin");
  const value: AuthState = {
    status, session, user: session?.user ?? null, profile, roles, isAdmin,
    allowedPages: isAdmin ? null : profile?.allowed_pages ?? null,
    refresh: async () => { activating.current = null; const { data } = await supabase.auth.getSession(); await resolve(data.session); },
    signOut: async () => { await supabase.auth.signOut(); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
