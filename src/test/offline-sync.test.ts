import { describe, expect, it } from "vitest";
import { applyOp, completeRow, describeOp, MemoryStore, newId, resolveOp, type PendingOp } from "@/lib/offline/ops";
import { friendlySyncError, isTransientError } from "@/lib/offline/sync";

async function save(store: MemoryStore, op: PendingOp) {
  const resolved = await resolveOp(op, store);
  await applyOp(resolved, store);
  return resolved;
}

describe("offline saves", () => {
  it("fills in the same defaults the server would for a new student", () => {
    const row = completeRow("students", { full_name: "Amina", lin: "LIN-1" }, "2026-11-14T00:00:00.000Z");
    expect(row["is_active"]).toBe(true);
    expect(row["termination_reason"]).toBe(0);
    expect(row["promotion_status"]).toBe(0);
    expect(row["created_at"]).toBe("2026-11-14T00:00:00.000Z");
    expect(typeof row["id"]).toBe("number");
  });

  it("makes device ids that are unique and safe to store", () => {
    const ids = new Set(Array.from({ length: 5000 }, () => newId()));
    expect(ids.size).toBe(5000);
    for (const id of ids) expect(Number.isSafeInteger(id)).toBe(true);
  });

  it("refuses a second active student with the same LIN, ignoring case", async () => {
    const store = new MemoryStore();
    await save(store, { kind: "insert", table: "students", rows: [{ full_name: "A", lin: "lin-9" }] });
    await expect(save(store, { kind: "insert", table: "students", rows: [{ full_name: "B", lin: "LIN-9" }] }))
      .rejects.toThrow("students_active_lin_unique");
  });

  it("allows a new student to reuse the LIN of a terminated student", async () => {
    const store = new MemoryStore({ students: [completeRow("students", { id: 1, full_name: "A", lin: "L1", is_active: false })] });
    await expect(save(store, { kind: "insert", table: "students", rows: [{ full_name: "B", lin: "L1" }] })).resolves.toBeTruthy();
  });

  it("turns an upsert of an existing term fee into an update of just the amount", async () => {
    const store = new MemoryStore({ term_fees: [{ id: 5, term_id: 1, class_id: 2, amount: 100 }] });
    const op = await save(store, { kind: "upsert", table: "term_fees", rows: [{ term_id: 1, class_id: 2, amount: 250 }], onConflict: "term_id,class_id" });
    expect(op.kind).toBe("update");
    expect(store.data.term_fees).toEqual([{ id: 5, term_id: 1, class_id: 2, amount: 250 }]);
  });

  it("deleting a class removes its assessments and marks and unassigns its students, like the server", async () => {
    const store = new MemoryStore({
      classes: [{ id: 1, name: "P4" }],
      students: [{ id: 10, class_id: 1, full_name: "A", lin: "L" }],
      assessments: [{ id: 20, class_id: 1 }],
      marks: [{ id: 30, assessment_id: 20, student_id: 10, subject_id: null }],
      class_streams: [{ class_id: 1, stream_id: 3 }],
    });
    await save(store, { kind: "delete", table: "classes", filters: [{ op: "eq", column: "id", value: 1 }] });
    expect(store.data.classes).toEqual([]);
    expect(store.data.assessments).toEqual([]);
    expect(store.data.marks).toEqual([]);
    expect(store.data.class_streams).toEqual([]);
    expect(store.data.students?.[0]?.["class_id"]).toBeNull();
  });

  it("setting the active term deactivates every other term on the device", async () => {
    const store = new MemoryStore({ terms: [{ id: 1, name: "Term 1", is_active: true }, { id: 2, name: "Term 2", is_active: false }] });
    await save(store, { kind: "rpc", fn: "set_active_term", args: { _term_id: 2 } });
    expect(store.data.terms?.map((t) => t["is_active"])).toEqual([false, true]);
  });

  it("describes queued changes in plain words", async () => {
    const store = new MemoryStore({ students: [{ id: 1, full_name: "Amina Nakato" }] });
    expect(await describeOp({ kind: "update", table: "students", patch: { is_active: false }, filters: [{ op: "eq", column: "id", value: 1 }] }, store)).toBe("Updated student Amina Nakato");
    expect(await describeOp({ kind: "insert", table: "marks", rows: [{}, {}, {}] }, store)).toBe("Added 3 marks");
  });
});

describe("sync errors", () => {
  it("keeps changes queued when the connection drops or the sign-in needs refreshing", () => {
    expect(isTransientError({ message: "TypeError: Failed to fetch" })).toBe(true);
    expect(isTransientError({ message: "JWT expired", code: "PGRST301" })).toBe(true);
    expect(isTransientError({ message: "duplicate key value", code: "23505" })).toBe(false);
  });
  it("explains refused changes in plain words", () => {
    expect(friendlySyncError({ message: "new row violates row-level security policy", code: "42501" })).toBe("Your account isn't allowed to make this change.");
  });
});
