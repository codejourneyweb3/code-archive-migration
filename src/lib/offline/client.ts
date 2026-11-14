/**
 * Offline-first replacement for the backend query builder used by pages.
 * Reads come from the device copy; writes are applied on the device at once and queued for sync.
 * Supports the subset pages use: select / insert / upsert / update / delete, eq / neq / in / is, single / maybeSingle.
 */
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { applyOp, describeOp, matches, resolveOp, LocalWriteError, type Filter, type PendingOp, type Row } from "./ops";
import { indexedStore, localDb } from "./local-db";
import { syncEngine } from "./sync";
import type { SyncedTable } from "./schema";

export interface LocalError { message: string; code: string }
export interface LocalResult<T> { data: T | null; error: LocalError | null }

function toError(e: unknown): LocalError {
  if (e instanceof LocalWriteError) return { message: e.message, code: e.code };
  return { message: e instanceof Error ? e.message : String(e), code: "" };
}

function tablesOf(op: PendingOp): SyncedTable[] {
  if (op.kind === "rpc") return ["terms"];
  if (op.kind === "upload") return [];
  // Deletes can cascade, so refresh everything that may hold a reference.
  return op.kind === "delete" ? ["students", "classes", "streams", "class_streams", "subjects", "class_subjects", "terms", "assessments", "assessment_subjects", "marks", "grade_bands", "grading_systems", "term_fees", "fee_payments", "student_credits", "head_teacher_comments", "termination_logs", op.table] : [op.table];
}

/** Applies a change on the device and adds it to the outbox, all in one transaction. */
export async function commit(op: PendingOp): Promise<Row[]> {
  const db = localDb();
  const userId = syncEngine.userId ?? "unknown";
  const rows = await db.transaction("rw", db.allTables(), async () => {
    const resolved = await resolveOp(op, indexedStore);
    const summary = await describeOp(resolved, indexedStore);
    const written = await applyOp(resolved, indexedStore);
    await db.outbox.add({ userId, createdAt: new Date().toISOString(), summary, status: "pending", error: null, attempts: 0, op: resolved });
    return written;
  });
  syncEngine.notifyLocalChange(tablesOf(op));
  return rows;
}

type Action =
  | { type: "select" }
  | { type: "insert"; rows: Row[] }
  | { type: "upsert"; rows: Row[]; onConflict: string }
  | { type: "update"; patch: Row }
  | { type: "delete" };

class LocalQuery<R> implements PromiseLike<LocalResult<R[]>> {
  private filters: Filter[] = [];
  constructor(private table: SyncedTable, private action: Action) {}

  eq(column: keyof R & string, value: unknown) { this.filters.push({ op: "eq", column, value }); return this; }
  neq(column: keyof R & string, value: unknown) { this.filters.push({ op: "neq", column, value }); return this; }
  in(column: keyof R & string, value: readonly unknown[]) { this.filters.push({ op: "in", column, value: [...value] }); return this; }
  is(column: keyof R & string, value: null | boolean) { this.filters.push({ op: "is", column, value }); return this; }
  /** Returns the full rows; the column list is accepted for compatibility. */
  select(_columns?: string) { return this; }

  single(): PromiseLike<LocalResult<R>> {
    return this.run().then((r) => r.error ? { data: null, error: r.error }
      : r.data?.length === 1 ? { data: r.data[0]!, error: null }
      : { data: null, error: { message: `Expected one row, found ${r.data?.length ?? 0}`, code: "PGRST116" } });
  }
  maybeSingle(): PromiseLike<LocalResult<R>> {
    return this.run().then((r) => r.error ? { data: null, error: r.error } : { data: r.data?.[0] ?? null, error: null });
  }

  then<A = LocalResult<R[]>, B = never>(ok?: ((v: LocalResult<R[]>) => A | PromiseLike<A>) | null, fail?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return this.run().then(ok, fail);
  }

  private async run(): Promise<LocalResult<R[]>> {
    try {
      const a = this.action;
      if (a.type === "select") {
        await syncEngine.whenReady();
        const rows = (await localDb().rows(this.table).toArray()).filter((r) => matches(r, this.filters));
        return { data: rows as R[], error: null };
      }
      const op: PendingOp =
        a.type === "insert" ? { kind: "insert", table: this.table, rows: a.rows }
        : a.type === "upsert" ? { kind: "upsert", table: this.table, rows: a.rows, onConflict: a.onConflict }
        : a.type === "update" ? { kind: "update", table: this.table, patch: a.patch, filters: this.filters }
        : { kind: "delete", table: this.table, filters: this.filters };
      return { data: (await commit(op)) as R[], error: null };
    } catch (e) {
      return { data: null, error: toError(e) };
    }
  }
}

type Many<T> = T | T[];
const list = <T,>(v: Many<T>) => (Array.isArray(v) ? v : [v]) as unknown as Row[];

function from<T extends SyncedTable>(table: T) {
  type R = Tables<T>;
  return {
    select: (_columns?: string) => new LocalQuery<R>(table, { type: "select" }),
    insert: (rows: Many<TablesInsert<T>>) => new LocalQuery<R>(table, { type: "insert", rows: list(rows) }),
    upsert: (rows: Many<TablesInsert<T>>, opts?: { onConflict?: string }) =>
      new LocalQuery<R>(table, { type: "upsert", rows: list(rows), onConflict: opts?.onConflict ?? (table === "class_streams" ? "class_id,stream_id" : table === "class_subjects" ? "class_id,subject_id" : table === "assessment_subjects" ? "assessment_id,subject_id" : "id") }),
    update: (patch: TablesUpdate<T>) => new LocalQuery<R>(table, { type: "update", patch: patch as Row }),
    delete: () => new LocalQuery<R>(table, { type: "delete" }),
  };
}

async function rpc(fn: "set_active_term", args: { _term_id: number }): Promise<LocalResult<null>> {
  try { await commit({ kind: "rpc", fn, args }); return { data: null, error: null }; }
  catch (e) { return { data: null, error: toError(e) }; }
}

/** Keeps a photo or logo on the device and queues its upload; returns the storage path to save on the record. */
async function upload(folder: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const type = file.type || "image/jpeg";
  await localDb().files.put({ path, blob: file, type });
  await commit({ kind: "upload", path, contentType: type });
  return path;
}

export const local = { from, rpc, upload };
