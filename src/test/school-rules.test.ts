import { describe, expect, it } from "vitest";
import {
  checkPromotionalPass, completionPercent, computeGradebook, computeReportCard, computeStudentAverage,
  gradeFromAverage, gradeFromBands, suggestNextClass, type Band,
} from "@/lib/academics";
import { feeStatus, overpaymentFor, defaulters } from "@/lib/finance";
import { landingPath, mayAccess } from "@/lib/pages";
import type { AcademicData } from "@/lib/db";

const band = (label: string, min: number, max: number, pass = true): Band => ({ label, min_score: min, max_score: max, is_promotional_pass: pass, is_repeater: false, is_promotional_fail: !pass });

function base(): AcademicData {
  const student = (id: number, name: string, stream: number | null = null) => ({ id, full_name: name, lin: `LIN-${id}`, class_id: 1, stream_id: stream, is_active: true, created_at: "2026-01-01" }) as AcademicData["students"][number];
  const assess = (id: number, o: Partial<AcademicData["assessments"][number]>) => ({ id, name: `A${id}`, class_id: 1, subject_id: 10, term_id: 1, academic_year_id: null, stream_id: null, stream_ids: [], is_class_wide: true, is_school_wide: false, weight_percent: 0, due_date: `2026-02-0${id}`, promotion_role: 0, created_at: `2026-01-0${id}`, ...o }) as AcademicData["assessments"][number];
  return {
    students: [student(1, "Amina"), student(2, "Brian", 7)],
    classes: [{ id: 1, name: "P4", grading_system_id: 100 }, { id: 2, name: "P5", grading_system_id: null }, { id: 3, name: "P7", grading_system_id: null }] as AcademicData["classes"],
    streams: [{ id: 7, name: "Blue" }], classStreams: [], subjects: [{ id: 10, name: "Maths" }, { id: 11, name: "English" }], classSubjects: [],
    terms: [{ id: 1, name: "Term 3", start_date: "2026-09-01", end_date: "2026-11-30", is_active: true }] as AcademicData["terms"], years: [],
    assessments: [assess(1, { weight_percent: 20, promotion_role: 1 }), assess(2, { weight_percent: 80, promotion_role: 2 })],
    assessmentSubjects: [],
    marks: [
      { id: 1, student_id: 1, assessment_id: 1, subject_id: null, mark: 60 }, { id: 2, student_id: 1, assessment_id: 2, subject_id: null, mark: 80 },
      { id: 3, student_id: 2, assessment_id: 1, subject_id: null, mark: 30 }, { id: 4, student_id: 2, assessment_id: 2, subject_id: null, mark: 40 },
    ] as AcademicData["marks"],
    gradingSystems: [{ id: 100, name: "Primary", is_default: true, pass_mark: 50 }] as AcademicData["gradingSystems"],
    gradeBands: [
      { id: 1, grading_system_id: 100, ...band("A", 80, 100) }, { id: 2, grading_system_id: 100, ...band("C", 50, 79) }, { id: 3, grading_system_id: 100, ...band("F", 0, 49, false) },
    ] as AcademicData["gradeBands"],
  };
}

describe("grading", () => {
  it("falls back to A–F when no bands exist", () => {
    expect(gradeFromAverage(80)).toBe("A");
    expect(gradeFromAverage(39.9)).toBe("F");
    expect(gradeFromBands(72, [])).toBe("B");
  });
  it("uses the grading system bands when present", () => {
    expect(gradeFromBands(85, [band("A", 80, 100), band("C", 50, 79)])).toBe("A");
  });
  it("passes promotion by band flag, or by pass mark with no bands", () => {
    expect(checkPromotionalPass(45, 50, [band("F", 0, 49, false)])).toBe(false);
    expect(checkPromotionalPass(55, 50, [])).toBe(true);
    expect(checkPromotionalPass(49, 50, [])).toBe(false);
  });
});

describe("gradebook & report card", () => {
  it("ranks students by average with grades from the class system", () => {
    const rows = computeGradebook({ classId: 1, termId: 1 }, base());
    expect(rows.map((r) => [r.studentName, r.average, r.grade, r.rank, r.status])).toEqual([
      ["Amina", 70, "C", 1, "Excellent"], ["Brian", 35, "F", 2, "At Risk"],
    ]);
  });
  it("puts the end-of-year exam in the promotional table and the rest in contributory", () => {
    const rc = computeReportCard(1, 1, base())!;
    expect(rc.promotional.map((r) => r.mark)).toEqual([80]);
    expect(rc.contributory.map((r) => r.mark)).toEqual([60]);
    expect(rc.overallAverage).toBe(70);
    expect(rc.rank).toBe(1);
  });
  it("uses the promotional exam mark as the year-end average", () => {
    expect(computeStudentAverage(1, base())).toBe(80);
    expect(computeStudentAverage(2, base())).toBe(40);
  });
  it("counts completion as marks / (students × subjects)", () => {
    const d = base();
    d.assessments.push({ ...d.assessments[0]!, id: 3, subject_id: null });
    d.assessmentSubjects = [{ assessment_id: 3, subject_id: 10 }, { assessment_id: 3, subject_id: 11 }];
    d.marks.push({ id: 9, student_id: 1, assessment_id: 3, subject_id: 10, mark: 50 } as AcademicData["marks"][number]);
    expect(completionPercent(d.assessments[2]!, d)).toBe(25);
  });
  it("suggests the next class by number", () => {
    expect(suggestNextClass(1, base().classes)?.name).toBe("P5");
    expect(suggestNextClass(3, base().classes)).toBeNull();
  });
});

describe("fees", () => {
  it("classifies fee status", () => {
    expect(feeStatus(0, 0)).toBe("N/A");
    expect(feeStatus(500000, 500000)).toBe("Paid");
    expect(feeStatus(500000, 1)).toBe("Partial");
    expect(feeStatus(500000, 0)).toBe("Unpaid");
  });
  it("carries overpayment forward as credit", () => {
    expect(overpaymentFor(500000, 600000, 0)).toBe(100000);
    expect(overpaymentFor(500000, 400000, 0)).toBe(0);
  });
  it("lists only students with a balance, largest first", () => {
    const students = base().students;
    const termFees = [{ id: 1, term_id: 1, class_id: 1, amount: 300000 }];
    const payments = [{ id: 1, student_id: 1, amount: 300000, term_id: 1 }, { id: 2, student_id: 2, amount: 100000, term_id: 1 }] as never;
    expect(defaulters({ students, termFees, payments }, 1).map((r) => [r.student.full_name, r.balance])).toEqual([["Brian", 200000]]);
  });
});

describe("page access", () => {
  it("keeps admin-only pages from data entrants", () => {
    for (const p of ["Budget", "Promotion", "TermManagement", "AuditLog", "SchoolSettings"] as const) expect(mayAccess(p, false, null)).toBe(false);
    expect(mayAccess("SchoolSettings", true, null)).toBe(true);
  });
  it("limits restricted entrants to their granted pages and lands them on the first", () => {
    expect(mayAccess("MarksEntry", false, "MarksEntry,Gradebook")).toBe(true);
    expect(mayAccess("FeeCollection", false, "MarksEntry,Gradebook")).toBe(false);
    expect(landingPath(false, "Gradebook,MarksEntry")).toBe("/marks-entry");
    expect(mayAccess("Enrollment", false, "Students")).toBe(true);
  });
});
