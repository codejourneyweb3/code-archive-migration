/** Fee rules ported from the desktop app (expected = term fee for the student's class). */
import type { FeePayment, Student, StudentCredit, TermFee } from "./db";

export interface FeeData { students: Student[]; termFees: TermFee[]; payments: FeePayment[]; credits?: StudentCredit[] }

export function expectedFor(student: Pick<Student, "class_id">, termFees: TermFee[], termId?: number | null): number {
  if (!student.class_id) return 0;
  return termFees.filter((tf) => tf.class_id === student.class_id && (!termId || tf.term_id === termId)).reduce((p, tf) => p + tf.amount, 0);
}

export function paidBy(studentId: number, payments: FeePayment[], termId?: number | null): number {
  return payments.filter((p) => p.student_id === studentId && (!termId || p.term_id === termId)).reduce((s, p) => s + p.amount, 0);
}

export function availableCredit(studentId: number, credits: StudentCredit[] = []): number {
  return credits.filter((c) => c.student_id === studentId && !c.applied_at).reduce((s, c) => s + c.amount, 0);
}

export type FeeStatus = "Paid" | "Partial" | "Unpaid" | "N/A";
export function feeStatus(expected: number, paid: number): FeeStatus {
  if (expected <= 0) return "N/A";
  if (paid >= expected) return "Paid";
  if (paid > 0) return "Partial";
  return "Unpaid";
}

export interface FeeRow { student: Student; expected: number; paid: number; balance: number; status: FeeStatus }

export function feeRegister(d: FeeData, termId?: number | null, classId?: number | null): FeeRow[] {
  return d.students
    .filter((s) => s.is_active && (!classId || s.class_id === classId))
    .map((s) => {
      const expected = expectedFor(s, d.termFees, termId);
      const paid = paidBy(s.id, d.payments, termId);
      return { student: s, expected, paid, balance: expected - paid, status: feeStatus(expected, paid) };
    });
}

export function defaulters(d: FeeData, termId?: number | null, classId?: number | null, minBalance?: number | null) {
  return feeRegister(d, termId, classId)
    .filter((r) => r.expected > 0 && (minBalance == null || r.balance >= minBalance) && r.balance > 0)
    .sort((a, b) => b.balance - a.balance);
}

export interface Cohort { label: string; classId: number | null; total: number; paid: number; partial: number; unpaid: number; expected: number; collected: number }

export function cohortSummaries(d: FeeData, classes: { id: number; name: string }[], termId?: number | null): Cohort[] {
  const rows = feeRegister(d, termId).filter((r) => r.student.class_id != null);
  const out: Cohort[] = [];
  for (const c of classes) {
    const rs = rows.filter((r) => r.student.class_id === c.id);
    if (rs.length === 0) continue;
    out.push({
      label: c.name, classId: c.id, total: rs.length,
      paid: rs.filter((r) => r.balance <= 0).length,
      partial: rs.filter((r) => r.balance > 0 && r.paid > 0).length,
      unpaid: rs.filter((r) => r.balance > 0 && r.paid <= 0).length,
      expected: rs.reduce((p, r) => p + r.expected, 0), collected: rs.reduce((p, r) => p + r.paid, 0),
    });
  }
  const sum = (k: keyof Cohort) => out.reduce((p, c) => p + (c[k] as number), 0);
  out.unshift({ label: "School-wide", classId: null, total: sum("total"), paid: sum("paid"), partial: sum("partial"), unpaid: sum("unpaid"), expected: sum("expected"), collected: sum("collected") });
  return out;
}

/** Overpayment beyond the term fee becomes a carry-forward credit (ProcessOverpaymentCreditAsync). */
export function overpaymentFor(expected: number, totalPaidThisTerm: number, existingUnappliedCredits: number): number {
  if (expected <= 0) return 0;
  return Math.max(0, totalPaidThisTerm + existingUnappliedCredits - expected);
}
