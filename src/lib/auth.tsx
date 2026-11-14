import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isTransientError } from "@/lib/offline/sync";

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
  /** True while working from the sign-in saved on this device because the server can't be reached. */
  offline: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

interface Access { roles: string[]; profile: Profile | null }

/** Role and page grants from the server; null when the server can't be reached. */
async function loadAccess(userId: string): Promise<Access | null> {
  const [r, p] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("profiles").select("id, full_name, email, allowed_pages").eq("id", userId).maybeSingle(),
  ]);
  if ((r.error && isTransientError(r.error)) || (p.error && isTransientError(p.error))) return null;
  return { roles: (r.data ?? []).map((x) => x.role as string), profile: (p.data as Profile | null) ?? null };
}

/** The last account that signed in on this device, so staff keep working when offline. Cleared on sign-out. */
const OFFLINE_KEY = "autoschool.offline-access";
interface SavedAccess extends Access { user: User }
function readSaved(): SavedAccess | null {
  try { const v = localStorage.getItem(OFFLINE_KEY); return v ? (JSON.parse(v) as SavedAccess) : null; } catch { return null; }
}
function save(a: SavedAccess) { try { localStorage.setItem(OFFLINE_KEY, JSON.stringify(a)); } catch { /* storage full */ } }
function clearSaved() { try { localStorage.removeItem(OFFLINE_KEY); } catch { /* ignore */ } }

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
  const [offlineUser, setOfflineUser] = useState<User | null>(null);
  const activating = useRef<string | null>(null);
  const unreachable = useRef(false);
  const offlineRef = useRef(false);

  const applySaved = useCallback((saved: SavedAccess) => {
    offlineRef.current = true;
    setOfflineUser(saved.user); setRoles(saved.roles); setProfile(saved.profile);
    setStatus(saved.roles.length ? "ready" : "no_role");
  }, []);

  const resolve = useCallback(async (s: Session | null) => {
    setSession(s);
    const saved = readSaved();
    const cantReach = () => !navigator.onLine || unreachable.current;
    if (!s?.user) {
      // No live sign-in. If that's only because we're offline, keep working as the last account on this device.
      if (saved && cantReach()) { applySaved(saved); return; }
      offlineRef.current = false;
      setOfflineUser(null); setStatus("signed_out"); setRoles([]); setProfile(null); return;
    }
    let access = await loadAccess(s.user.id);
    if (!access) {
      if (saved && saved.user.id === s.user.id) { applySaved({ ...saved, user: s.user }); return; }
      access = { roles: [], profile: null };
    }
    if (access.roles.length === 0 && activating.current !== s.user.id) {
      activating.current = s.user.id;
      if (await tryActivate(s.user)) access = (await loadAccess(s.user.id)) ?? access;
    }
    offlineRef.current = false;
    setOfflineUser(null);
    setRoles(access.roles);
    setProfile(access.profile);
    if (access.roles.length) save({ user: s.user, ...access });
    setStatus(access.roles.length ? "ready" : "no_role");
  }, [applySaved]);

  useEffect(() => {
    const check = () => supabase.auth.getSession().then(({ data, error }) => {
      unreachable.current = !!error && isTransientError(error);
      return resolve(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "TOKEN_REFRESHED" && !offlineRef.current) { setSession(s); return; }
      // Defer DB calls out of the auth callback.
      setTimeout(() => { void resolve(s); }, 0);
    });
    void check();
    const onOnline = () => { if (offlineRef.current) void check(); };
    window.addEventListener("online", onOnline);
    return () => { sub.subscription.unsubscribe(); window.removeEventListener("online", onOnline); };
  }, [resolve]);

  const isAdmin = roles.includes("admin");
  const value: AuthState = {
    status, session, user: session?.user ?? offlineUser, profile, roles, isAdmin,
    allowedPages: isAdmin ? null : profile?.allowed_pages ?? null,
    offline: !session && !!offlineUser,
    refresh: async () => { activating.current = null; const { data } = await supabase.auth.getSession(); await resolve(data.session); },
    signOut: async () => {
      clearSaved();
      offlineRef.current = false;
      setOfflineUser(null);
      const { error } = await supabase.auth.signOut(navigator.onLine ? undefined : { scope: "local" });
      if (error) await supabase.auth.signOut({ scope: "local" });
      setStatus("signed_out");
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
