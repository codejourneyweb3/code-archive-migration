/**
 * Pure offline write logic: turns a save into a queued operation and applies it to the device copy.
 * Works on any Store, so the same rules run against IndexedDB in the app and an in-memory store in tests.
 */
import { FOREIGN_KEYS, NOW, PRIMARY_KEY, TABLE_COLUMNS, TABLE_LABELS, UNIQUE_RULES, type SyncedTable } from "./schema";

export type Row = Record<string, unknown>;
export type FilterOp = "eq" | "neq" | "in" | "is";
export interface Filter { op: FilterOp; column: string; value: unknown }

export type PendingOp =
  | { kind: "insert"; table: SyncedTable; rows: Row[] }
  | { kind: "upsert"; table: SyncedTable; rows: Row[]; onConflict: string }
  | { kind: "update"; table: SyncedTable; patch: Row; filters: Filter[] }
  | { kind: "delete"; table: SyncedTable; filters: Filter[] }
  | { kind: "rpc"; fn: "set_active_term"; args: { _term_id: number } }
  | { kind: "upload"; path: string; contentType: string };

export interface Store {
  all(table: SyncedTable): Promise<Row[]>;
  put(table: SyncedTable, row: Row): Promise<void>;
  remove(table: SyncedTable, row: Row): Promise<void>;
}

export class LocalWriteError extends Error {
  constructor(message: string, readonly code: string) { super(message); this.name = "LocalWriteError"; }
}

let idBase = -1;
let idSeq = 0;
/**
 * Ids made on the device: seconds since 1970 in the high bits plus a per-session random counter.
 * They never collide with the server's own small sequential ids and stay below 2^53.
 */
export function newId(nowMs = Date.now()): number {
  if (idBase < 0) idBase = Math.floor(Math.random() * 2 ** 21);
  idSeq = (idSeq + 1) % 2 ** 21;
  return Math.floor(nowMs / 1000) * 2 ** 21 + ((idBase + idSeq) % 2 ** 21);
}

export function pkColumns(table: SyncedTable): string[] {
  const pk = PRIMARY_KEY[table];
  return typeof pk === "string" ? [pk] : [...pk];
}

/** A complete row with the database's defaults filled in, exactly as the server would store it. */
export function completeRow(table: SyncedTable, partial: Row, nowIso = new Date().toISOString()): Row {
  const cols = TABLE_COLUMNS[table] as Record<string, unknown>;
  const row: Row = {};
  for (const [col, def] of Object.entries(cols)) {
    if (col in partial && partial[col] !== undefined) row[col] = partial[col];
    else row[col] = def === NOW ? nowIso : Array.isArray(def) ? [] : def ?? null;
  }
  if (pkColumns(table).join() === "id" && row["id"] == null) row["id"] = newId();
  return row;
}

export function matches(row: Row, filters: Filter[]): boolean {
  return filters.every((f) => {
    const v = row[f.column];
    switch (f.op) {
      case "eq": return v === f.value;
      case "neq": return v !== f.value;
      case "is": return f.value === null ? v == null : v === f.value;
      case "in": return Array.isArray(f.value) && f.value.includes(v);
    }
  });
}

const sameKey = (a: Row, b: Row, cols: string[]) => cols.every((c) => a[c] === b[c]);

function norm(v: unknown, ci?: boolean) { return ci && typeof v === "string" ? v.toLowerCase() : v ?? null; }

function checkUnique(table: SyncedTable, row: Row, existing: Row[]) {
  const pk = pkColumns(table);
  for (const rule of UNIQUE_RULES.filter((r) => r.table === table)) {
    if (rule.where && !rule.where(row)) continue;
    const clash = existing.find((o) => !sameKey(o, row, pk) && (!rule.where || rule.where(o)) &&
      rule.columns.every((c) => norm(o[c], rule.caseInsensitive) === norm(row[c], rule.caseInsensitive)));
    if (clash) throw new LocalWriteError(`duplicate key value violates unique constraint "${rule.name}"`, "23505");
  }
}

/** Turns a save request into the exact operation to queue, resolving defaults, ids and upsert targets. */
export async function resolveOp(op: PendingOp, store: Store): Promise<PendingOp> {
  if (op.kind === "insert") return { ...op, rows: op.rows.map((r) => completeRow(op.table, r)) };
  if (op.kind !== "upsert") return op;
  // An upsert that matches a row on this device becomes an update of just the given columns;
  // otherwise it is sent as a full row so the server can still merge with a row we haven't seen.
  const conflict = op.onConflict.split(",").map((c) => c.trim());
  const existing = await store.all(op.table);
  const row = op.rows[0];
  if (op.rows.length === 1 && row) {
    const hit = existing.find((e) => sameKey(e, row, conflict));
    if (hit) {
      const patch = { ...row };
      return { kind: "update", table: op.table, patch, filters: conflict.map((c) => ({ op: "eq", column: c, value: row[c] })) };
    }
  }
  return { ...op, rows: op.rows.map((r) => {
    const hit = existing.find((e) => sameKey(e, r, conflict));
    return hit ? { ...hit, ...r } : completeRow(op.table, r);
  }) };
}

async function deleteRow(table: SyncedTable, row: Row, store: Store, depth = 0): Promise<void> {
  if (depth > 6) return;
  if (pkColumns(table).join() === "id") {
    for (const fk of FOREIGN_KEYS.filter((f) => f.ref === table)) {
      const children = (await store.all(fk.table)).filter((c) => c[fk.column] === row["id"]);
      if (!children.length) continue;
      if (fk.onDelete === "restrict") {
        throw new LocalWriteError(`update or delete on table "${table}" violates foreign key constraint on table "${fk.table}"`, "23503");
      }
      for (const c of children) {
        if (fk.onDelete === "cascade") await deleteRow(fk.table, c, store, depth + 1);
        else await store.put(fk.table, { ...c, [fk.column]: null });
      }
    }
  }
  await store.remove(table, row);
}

/** Applies a resolved operation to the device copy. Returns the rows written (for insert/upsert/update). */
export async function applyOp(op: PendingOp, store: Store): Promise<Row[]> {
  switch (op.kind) {
    case "insert":
    case "upsert": {
      const existing = await store.all(op.table);
      const pk = pkColumns(op.table);
      const pool = [...existing];
      for (const r of op.rows) {
        checkUnique(op.table, r, pool);
        if (op.kind === "insert" && pool.some((e) => sameKey(e, r, pk))) {
          throw new LocalWriteError(`duplicate key value violates unique constraint "${op.table}_pkey"`, "23505");
        }
        pool.push(r);
      }
      for (const r of op.rows) await store.put(op.table, r);
      return op.rows;
    }
    case "update": {
      const all = await store.all(op.table);
      const targets = all.filter((r) => matches(r, op.filters));
      const updated = targets.map((t) => ({ ...t, ...op.patch }));
      const pk = pkColumns(op.table);
      for (const u of updated) checkUnique(op.table, u, all.map((a) => updated.find((x) => sameKey(x, a, pk)) ?? a));
      for (const u of updated) await store.put(op.table, u);
      return updated;
    }
    case "delete": {
      const targets = (await store.all(op.table)).filter((r) => matches(r, op.filters));
      for (const t of targets) await deleteRow(op.table, t, store);
      return targets;
    }
    case "rpc": {
      const terms = await store.all("terms");
      for (const t of terms) {
        const active = t["id"] === op.args._term_id;
        if (t["is_active"] !== active) await store.put("terms", { ...t, is_active: active });
      }
      return [];
    }
    case "upload":
      return [];
  }
}

function rowName(r: Row | undefined): string | null {
  if (!r) return null;
  for (const k of ["full_name", "name", "label", "category", "code"]) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** One-line plain-language description of a queued change, e.g. "Updated student Amina Nakato". */
export async function describeOp(op: PendingOp, store: Store): Promise<string> {
  if (op.kind === "rpc") {
    const t = (await store.all("terms")).find((x) => x["id"] === op.args._term_id);
    return `Set ${rowName(t) ?? "a term"} as the active term`;
  }
  if (op.kind === "upload") return op.path.startsWith("logo") ? "Uploaded the school logo" : "Uploaded a student photo";
  const [one, many] = TABLE_LABELS[op.table];
  if (op.kind === "insert" || op.kind === "upsert") {
    const verb = op.kind === "insert" ? "Added" : "Saved";
    if (op.rows.length === 1) { const n = rowName(op.rows[0]); return `${verb} ${one}${n ? ` ${n}` : ""}`; }
    return `${verb} ${op.rows.length} ${many}`;
  }
  const targets = (await store.all(op.table)).filter((r) => matches(r, op.filters));
  const verb = op.kind === "update" ? "Updated" : "Deleted";
  if (targets.length === 1) { const n = rowName(targets[0]); return `${verb} ${one}${n ? ` ${n}` : ""}`; }
  return `${verb} ${targets.length || ""} ${targets.length === 1 ? one : many}`.replace(/\s+/g, " ");
}

/** In-memory Store, used by tests and for previews. */
export class MemoryStore implements Store {
  constructor(readonly data: Partial<Record<SyncedTable, Row[]>> = {}) {}
  async all(t: SyncedTable) { return [...(this.data[t] ?? [])]; }
  async put(t: SyncedTable, row: Row) {
    const pk = pkColumns(t);
    const list = this.data[t] ?? (this.data[t] = []);
    const i = list.findIndex((r) => sameKey(r, row, pk));
    if (i >= 0) list[i] = row; else list.push(row);
  }
  async remove(t: SyncedTable, row: Row) {
    const pk = pkColumns(t);
    this.data[t] = (this.data[t] ?? []).filter((r) => !sameKey(r, row, pk));
  }
}
