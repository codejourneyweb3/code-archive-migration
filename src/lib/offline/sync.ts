/**
 * Sync engine: pushes the outbox to the server in order, then refreshes the device copy.
 * Runs whenever the device is online — on sign-in, reconnect, tab focus, after each save and once a minute.
 */
import { supabase } from "@/integrations/supabase/client";
import { applyOp, type PendingOp, type Row } from "./ops";
import { getMeta, indexedStore, localDb, setMeta, type OutboxEntry } from "./local-db";
import { SYNCED_TABLES, type SyncedTable } from "./schema";

export interface SyncSnapshot {
  online: boolean;
  reachable: boolean;
  syncing: boolean;
  userId: string | null;
  entries: OutboxEntry[];
  lastSyncedAt: string | null;
  lastError: string | null;
  hasData: boolean;
}
type ChangeListener = (tables: SyncedTable[] | "all") => void;

const PULL_EVERY_MS = 120_000;
const TICK_MS = 60_000;

interface RemoteError { message: string; code?: string; status?: number; name?: string }
type RemoteResult = PromiseLike<{ data?: unknown; error: RemoteError | null }>;
interface FilterChain extends RemoteResult {
  eq(c: string, v: unknown): FilterChain; neq(c: string, v: unknown): FilterChain;
  in(c: string, v: unknown): FilterChain; is(c: string, v: unknown): FilterChain;
}
interface LooseClient {
  from(t: string): {
    insert(rows: Row[]): RemoteResult;
    upsert(rows: Row[], o: { onConflict: string }): RemoteResult;
    update(p: Row): FilterChain;
    delete(): FilterChain;
    select(c: string): { range(a: number, b: number): RemoteResult };
  };
  rpc(fn: string, args: Record<string, unknown>): RemoteResult;
}
const remote = () => supabase as unknown as LooseClient;

export function isTransientError(e: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const err = (e ?? {}) as RemoteError;
  const msg = `${err.name ?? ""} ${err.message ?? String(e)}`;
  if (/failed to fetch|networkerror|load failed|fetch failed|network request failed|timeout|timed out/i.test(msg)) return true;
  if (/jwt|token.*expired|AuthRetryable|AuthSessionMissing/i.test(msg) || err.code === "PGRST301" || err.code === "PGRST303") return true;
  return err.status === 401 || err.status === 502 || err.status === 503 || err.status === 504;
}

export function friendlySyncError(e: unknown): string {
  const err = (e ?? {}) as RemoteError;
  if (err.code === "23505") return "The server already has a matching record (duplicate), so this change was refused.";
  if (err.code === "23503") return "A record this change depends on is missing on the server, or is still used elsewhere.";
  if (err.code === "42501" || /row-level security|permission denied/i.test(err.message ?? "")) return "Your account isn't allowed to make this change.";
  return err.message || String(e);
}

const PAGE = 1000;
async function fetchRemote(table: SyncedTable): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await remote().from(table).select("*").range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as Row[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

async function sendToServer(op: PendingOp): Promise<void> {
  const check = (error: RemoteError | null, okDuplicatePk = false) => {
    if (!error) return;
    // A retried insert that already reached the server: the row is there, so treat it as done.
    if (okDuplicatePk && error.code === "23505" && /_pkey/.test(error.message)) return;
    throw error;
  };
  switch (op.kind) {
    case "insert": { const { error } = await remote().from(op.table).insert(op.rows); check(error, true); return; }
    case "upsert": { const { error } = await remote().from(op.table).upsert(op.rows, { onConflict: op.onConflict }); check(error); return; }
    case "update":
    case "delete": {
      let q = op.kind === "update" ? remote().from(op.table).update(op.patch) : remote().from(op.table).delete();
      for (const f of op.filters) q = q[f.op](f.column, f.value);
      const { error } = await q; check(error); return;
    }
    case "rpc": { const { error } = await remote().rpc(op.fn, op.args); check(error); return; }
    case "upload": {
      const file = await localDb().files.get(op.path);
      if (!file) return;
      const { error } = await supabase.storage.from("school-media").upload(op.path, file.blob, { upsert: true, contentType: op.contentType });
      if (error && !/already exists/i.test(error.message)) throw error;
      return;
    }
  }
}

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  return locks ? locks.request("autoschool360-sync", fn) as Promise<T> : fn();
}

class SyncEngine {
  private snap: SyncSnapshot = { online: true, reachable: true, syncing: false, userId: null, entries: [], lastSyncedAt: null, lastError: null, hasData: false };
  private listeners = new Set<() => void>();
  private changeListeners = new Set<ChangeListener>();
  private running: Promise<void> | null = null;
  private again = false;
  private lastPullMs = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private channel: BroadcastChannel | null = null;
  private wired = false;
  private resolveReady: (() => void) | null = null;
  private ready: Promise<void> = new Promise((r) => { this.resolveReady = r; });

  get userId() { return this.snap.userId; }
  getSnapshot = () => this.snap;
  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  onChange(fn: ChangeListener) { this.changeListeners.add(fn); return () => { this.changeListeners.delete(fn); }; }
  /** Resolves once the device has a copy of the data (or there's no way to get one right now). */
  whenReady() { return this.ready; }

  private set(p: Partial<SyncSnapshot>) { this.snap = { ...this.snap, ...p }; this.listeners.forEach((l) => l()); }
  private emitChange(t: SyncedTable[] | "all", broadcast = true) {
    this.changeListeners.forEach((l) => l(t));
    if (broadcast) this.channel?.postMessage({ type: "changed" });
  }
  private async refreshEntries() {
    const entries = await localDb().outbox.orderBy("seq").toArray();
    this.set({ entries });
  }

  private wire() {
    if (this.wired) return;
    this.wired = true;
    window.addEventListener("online", () => { this.set({ online: true }); void this.syncNow({ pull: true }); });
    window.addEventListener("offline", () => this.set({ online: false, reachable: false }));
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void this.syncNow(); });
    if ("BroadcastChannel" in window) {
      this.channel = new BroadcastChannel("autoschool360");
      this.channel.onmessage = () => { this.emitChange("all", false); void this.refreshEntries(); };
    }
  }

  async start(userId: string) {
    if (typeof window === "undefined") return;
    this.wire();
    const firstStart = this.snap.userId === null;
    this.set({ userId, online: navigator.onLine });
    if (!this.timer) this.timer = setInterval(() => { void this.syncNow(); }, TICK_MS);
    const lastPulledAt = await getMeta<string>("lastPulledAt").catch(() => undefined);
    this.set({ hasData: !!lastPulledAt, lastSyncedAt: lastPulledAt ?? null });
    await this.refreshEntries();
    if (lastPulledAt || !navigator.onLine) {
      this.resolveReady?.();
      if (navigator.onLine) void this.syncNow({ pull: true });
    } else {
      await this.syncNow({ pull: true });
      this.resolveReady?.();
    }
    if (!firstStart) this.emitChange("all", false);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.set({ userId: null });
  }

  /** Called after every save on this device. */
  notifyLocalChange(tables: SyncedTable[]) {
    this.emitChange(tables);
    void this.refreshEntries();
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => { void this.syncNow(); }, 1200);
  }

  syncNow(opts: { pull?: boolean } = {}): Promise<void> {
    if (!this.snap.userId || typeof navigator === "undefined") return Promise.resolve();
    if (!navigator.onLine) { this.set({ online: false, reachable: false }); return Promise.resolve(); }
    if (this.running) { this.again = true; return this.running; }
    this.running = (async () => {
      this.set({ syncing: true, online: true });
      try {
        await withLock(async () => {
          const pushed = await this.push();
          if (opts.pull || Date.now() - this.lastPullMs > PULL_EVERY_MS) await this.pull();
          void pushed;
        });
        this.set({ reachable: true, lastError: null });
      } catch (e) {
        if (isTransientError(e)) this.set({ reachable: false, lastError: "Can't reach the school server right now. Changes stay on this device." });
        else this.set({ lastError: friendlySyncError(e) });
      } finally {
        this.running = null;
        await this.refreshEntries().catch(() => undefined);
        this.set({ syncing: false });
        if (this.again) { this.again = false; void this.syncNow(); }
      }
    })();
    return this.running;
  }

  /** Sends this account's queued changes in order; stops at the first one the server refuses. */
  private async push(): Promise<number> {
    const db = localDb();
    const entries = (await db.outbox.orderBy("seq").toArray()).filter((e) => e.userId === this.snap.userId);
    let sent = 0;
    for (const e of entries) {
      if (e.status === "failed") break;
      try {
        await sendToServer(e.op);
        await db.outbox.delete(e.seq!);
        sent++;
      } catch (err) {
        if (isTransientError(err)) throw err;
        await db.outbox.update(e.seq!, { status: "failed", error: friendlySyncError(err), attempts: e.attempts + 1 });
        break;
      }
      if (sent % 10 === 0) await this.refreshEntries();
    }
    return sent;
  }

  /** Replaces the device copy with the server's data, then re-applies changes still waiting to sync. */
  private async pull() {
    const results = await Promise.all(SYNCED_TABLES.map(async (t) => [t, await fetchRemote(t)] as const));
    const db = localDb();
    const now = new Date().toISOString();
    await db.transaction("rw", db.allTables(), async () => {
      for (const [t, rows] of results) { await db.rows(t).clear(); await db.rows(t).bulkPut(rows); }
      for (const e of await db.outbox.orderBy("seq").toArray()) {
        try { await applyOp(e.op, indexedStore); } catch { /* the server decides when it's pushed */ }
      }
      await setMeta("lastPulledAt", now);
    });
    this.lastPullMs = Date.now();
    this.set({ lastSyncedAt: now, hasData: true });
    this.emitChange("all");
  }

  async retry(seq: number) {
    await localDb().outbox.update(seq, { status: "pending", error: null });
    await this.refreshEntries();
    await this.syncNow({ pull: true });
  }

  /** Drops a queued change. The device copy is rebuilt from the server at the next sync. */
  async discard(seq: number) {
    await localDb().outbox.delete(seq);
    await this.refreshEntries();
    this.emitChange("all");
    await this.syncNow({ pull: true });
  }
}

export const syncEngine = new SyncEngine();
