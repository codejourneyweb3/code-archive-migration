/**
 * The device copy of the school's data (IndexedDB via Dexie).
 * One store per synced table, plus the outbox of changes waiting to sync, queued files and sync metadata.
 * Open it lazily: IndexedDB exists only in the browser.
 */
import Dexie, { type Table } from "dexie";
import { SYNCED_TABLES, type SyncedTable } from "./schema";
import { pkColumns, type PendingOp, type Row, type Store } from "./ops";

export interface OutboxEntry {
  seq?: number;
  userId: string;
  createdAt: string;
  summary: string;
  status: "pending" | "failed";
  error: string | null;
  attempts: number;
  op: PendingOp;
}
export interface StoredFile { path: string; blob: Blob; type: string }
export interface MetaEntry { key: string; value: unknown }

class LocalDb extends Dexie {
  outbox!: Table<OutboxEntry, number>;
  files!: Table<StoredFile, string>;
  meta!: Table<MetaEntry, string>;
  constructor() {
    super("autoschool360");
    const stores: Record<string, string> = { outbox: "++seq, userId", files: "path", meta: "key" };
    for (const t of SYNCED_TABLES) {
      const pk = pkColumns(t);
      stores[`t_${t}`] = pk.length === 1 ? pk[0]! : `[${pk.join("+")}]`;
    }
    this.version(1).stores(stores);
  }
  rows(t: SyncedTable): Table<Row, unknown> { return this.table(`t_${t}`); }
  allTables(): Table[] { return [...SYNCED_TABLES.map((t) => this.rows(t)), this.outbox, this.files, this.meta]; }
}

let instance: LocalDb | null = null;
export function localDb(): LocalDb {
  if (typeof indexedDB === "undefined") throw new Error("This device can't store data offline (no IndexedDB).");
  if (!instance) instance = new LocalDb();
  return instance;
}

function keyOf(t: SyncedTable, row: Row): unknown {
  const pk = pkColumns(t);
  return pk.length === 1 ? row[pk[0]!] : pk.map((c) => row[c]);
}

/** Store backed by IndexedDB; use inside localDb().transaction(...) so a change is all-or-nothing. */
export const indexedStore: Store = {
  all: (t) => localDb().rows(t).toArray(),
  put: async (t, row) => { await localDb().rows(t).put(row); },
  remove: async (t, row) => { await localDb().rows(t).delete(keyOf(t, row) as never); },
};

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await localDb().meta.get(key))?.value as T | undefined;
}
export async function setMeta(key: string, value: unknown) { await localDb().meta.put({ key, value }); }
