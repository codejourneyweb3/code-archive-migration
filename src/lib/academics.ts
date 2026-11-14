/**
 * Academic rules ported from the desktop AutoTable DatabaseDataService.
 * Pure functions over loaded rows so every page computes results the same way.
 */
import type {
  AcademicData, Assessment, GradeBand, GradingSystem, Mark, Student,
} from "./db";

export const PROMOTION_ROLES = [
  { value: 0, label: "Just an assessment", short: "Assessment" },
  { value: 4, label: "Contributory (End of Term)", short: "Contributory EOT" },
  { value: 3, label: "End of Term", short: "End of Term" },
  { value: 1, label: "Contributory (End of Year / Promotional)", short: "Contributory EOY" },
  { value: 2, label: "End of Year (Promotional)", short: "Promotional" },
] as const;
export const ROLE = { None: 0, CountsTowardPromotion: 1, PromotionExam: 2, EndOfTerm: 3, ContributoryEndOfTerm: 4 } as const;
export const roleLabel = (v: number) => PROMOTION_ROLES.find((r) => r.value === v)?.label ?? "Just an assessment";

export const TERMINATION_REASONS = [
  { value: 1, label: "Completed course" },
  { value: 2, label: "Left school" },
  { value: 3, label: "Expelled" },
  { value: 4, label: "Other" },
] as const;
export const terminationLabel = (v: number) => TERMINATION_REASONS.find((r) => r.value === v)?.label ?? "—";

export const PROMOTION_STATUS = { Pending: 0, Promoted: 1, Repeat: 2, Shifted: 3 } as const;
export const promotionStatusLabel = (v: number) => ["Pending", "Promoted", "Repeat", "Shifted"][v] ?? "Pending";

export type Band = Pick<GradeBand, "label" | "min_score" | "max_score" | "is_promotional_pass" | "is_repeater" | "is_promotional_fail">;

/** Fallback scale used when no grading system bands exist (desktop GradeFromAverage). */
export function gradeFromAverage(mark: number): string {
  if (mark >= 80) return "A";
  if (mark >= 70) return "B";
  if (mark >= 60) return "C";
  if (mark >= 50) return "D";
  if (mark >= 40) return "E";
  return "F";
}

export function gradeFromBands(mark: number, bands: Band[]): string {
  if (bands.length === 0) return gradeFromAverage(mark);
  const band = [...bands].sort((a, b) => a.min_score - b.min_score).find((b) => mark >= b.min_score && mark <= b.max_score);
  return band?.label ?? gradeFromAverage(mark);
}

export function checkPromotionalPass(mark: number, passMark: number, bands: Band[]): boolean {
  if (bands.length > 0) {
    const band = [...bands].sort((a, b) => a.min_score - b.min_score).find((b) => mark >= b.min_score && mark <= b.max_score);
    if (band) return band.is_promotional_pass;
  }
  return mark >= passMark;
}

export function performanceStatus(avg: number, passMark: number): "At Risk" | "Excellent" | "On Track" | "No Data" {
  if (avg <= 0) return "No Data";
  if (avg < passMark) return "At Risk";
  if (avg >= 70) return "Excellent";
  return "On Track";
}

export interface ResolvedScale { system: GradingSystem | null; passMark: number; bands: GradeBand[] }

/** Class grading system → school default → first by name → none. */
export function resolveScale(
  classId: number | null | undefined,
  data: Pick<AcademicData, "classes" | "gradingSystems" | "gradeBands">,
): ResolvedScale {
  const cls = data.classes.find((c) => c.id === classId);
  let system = cls?.grading_system_id ? data.gradingSystems.find((g) => g.id === cls.grading_system_id) ?? null : null;
  if (!system) system = data.gradingSystems.find((g) => g.is_default) ?? [...data.gradingSystems].sort((a, b) => a.name.localeCompare(b.name))[0] ?? null;
  const bands = system ? data.gradeBands.filter((b) => b.grading_system_id === system!.id).sort((a, b) => a.min_score - b.min_score) : [];
  return { system, passMark: system?.pass_mark ?? 50, bands };
}

export function streamIdsOf(a: Pick<Assessment, "stream_id" | "stream_ids">): number[] {
  const ids = new Set<number>(a.stream_ids ?? []);
  if (a.stream_id) ids.add(a.stream_id);
  return [...ids];
}

/** True when an assessment applies to the student (stream-scoped papers only reach target streams). */
export function assessmentForStudent(a: Assessment, student: Pick<Student, "stream_id"> | undefined): boolean {
  if (!student?.stream_id) return true;
  if (a.is_school_wide || a.is_class_wide) return true;
  const ids = streamIdsOf(a);
  if (ids.length === 0) return true;
  return ids.includes(student.stream_id);
}

export function assessmentAppliesToClass(a: Assessment, classId: number): boolean {
  return a.is_school_wide || a.class_id === classId;
}

/** Subjects an assessment covers: its own subject, or its linked subjects for multi-subject papers. */
export function assessmentSubjectIds(a: Assessment, data: Pick<AcademicData, "assessmentSubjects">): number[] {
  if (a.subject_id) return [a.subject_id];
  return data.assessmentSubjects.filter((x) => x.assessment_id === a.id).map((x) => x.subject_id);
}

export type AssessmentScope = "Single" | "AllInClass" | "SpecificSubjects" | "AllInSchool" | "Stream";
export function assessmentScope(a: Assessment): AssessmentScope {
  if (a.is_school_wide) return "AllInSchool";
  if (streamIdsOf(a).length > 0 && !a.is_class_wide) return "Stream";
  if (a.subject_id == null) return "AllInClass";
  return "Single";
}

/** The subject a mark counts for (multi-subject marks carry their own subject). */
export function markSubjectId(m: Mark, a: Assessment | undefined): number | null {
  return m.subject_id ?? a?.subject_id ?? null;
}

/** Students expected to sit an assessment (active, in class, in target streams). */
export function rosterFor(a: Assessment, data: Pick<AcademicData, "students">, classId?: number): Student[] {
  const ids = streamIdsOf(a);
  return data.students.filter((s) => {
    if (!s.is_active) return false;
    if (a.is_school_wide) { if (classId && s.class_id !== classId) return false; }
    else if (s.class_id !== a.class_id) return false;
    if (!a.is_class_wide && ids.length > 0) return s.stream_id != null && ids.includes(s.stream_id);
    return true;
  });
}

/** Completion = marks entered / (students × linked subjects). */
export function completionPercent(a: Assessment, data: Pick<AcademicData, "students" | "assessmentSubjects" | "marks">): number {
  const roster = rosterFor(a, data).length;
  const linked = data.assessmentSubjects.filter((x) => x.assessment_id === a.id).length;
  const expected = linked > 0 ? roster * linked : roster;
  const entered = data.marks.filter((m) => m.assessment_id === a.id && m.mark != null).length;
  if (expected === 0) return 0;
  return Math.min(100, Math.round((entered * 100) / expected));
}

const byAssessmentOrder = (amap: Map<number, Assessment>) => (x: Mark, y: Mark) => {
  const a = amap.get(x.assessment_id), b = amap.get(y.assessment_id);
  const da = a?.due_date ?? a?.created_at ?? "", db = b?.due_date ?? b?.created_at ?? "";
  return da === db ? x.assessment_id - y.assessment_id : da < db ? -1 : 1;
};

export interface GradebookRow {
  studentId: number; studentName: string; lin: string; stream: string;
  cat1: number; cat2: number; midTerm: number; endTerm: number;
  average: number; grade: string; status: string; rank: number; count: number;
}

export interface GradebookFilter {
  classId: number; subjectId?: number | null; termId?: number | null; yearId?: number | null;
  streamId?: number | null; studentQuery?: string;
}

export function computeGradebook(f: GradebookFilter, data: AcademicData): GradebookRow[] {
  const scale = resolveScale(f.classId, data);
  const amap = new Map(data.assessments.map((a) => [a.id, a]));
  const smap = new Map(data.students.map((s) => [s.id, s]));
  const streamName = new Map(data.streams.map((s) => [s.id, s.name]));
  const marks = data.marks.filter((m) => {
    const a = amap.get(m.assessment_id);
    if (!a || !assessmentAppliesToClass(a, f.classId)) return false;
    if (f.subjectId && !(a.subject_id === f.subjectId || m.subject_id === f.subjectId)) return false;
    if (f.yearId && a.academic_year_id !== f.yearId) return false;
    if (f.termId && a.term_id !== f.termId) return false;
    const s = smap.get(m.student_id);
    if (!s) return false;
    if (a.is_school_wide && s.class_id !== f.classId) return false;
    if (f.streamId && s.stream_id !== f.streamId) return false;
    if (f.studentQuery && !s.full_name.toLowerCase().includes(f.studentQuery.toLowerCase())) return false;
    return true;
  });
  const groups = new Map<number, Mark[]>();
  for (const m of marks) groups.set(m.student_id, [...(groups.get(m.student_id) ?? []), m]);
  const rows: GradebookRow[] = [...groups.entries()].map(([sid, ms]) => {
    const s = smap.get(sid)!;
    const sorted = [...ms].sort(byAssessmentOrder(amap));
    const scores = sorted.map((x) => x.mark ?? 0);
    const avg = scores.length ? Math.round((scores.reduce((p, c) => p + c, 0) / scores.length) * 10) / 10 : 0;
    return {
      studentId: sid, studentName: s.full_name, lin: s.lin, stream: s.stream_id ? streamName.get(s.stream_id) ?? "" : "",
      cat1: scores[0] ?? 0, cat2: scores[1] ?? 0, midTerm: scores[2] ?? 0, endTerm: scores[3] ?? 0,
      average: avg, grade: avg > 0 ? gradeFromBands(avg, scale.bands) : "-",
      status: avg < scale.passMark ? "At Risk" : avg >= 70 ? "Excellent" : "On Track",
      rank: 0, count: scores.length,
    };
  }).sort((a, b) => b.average - a.average);
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

export interface ReportCardRowItem {
  subject: string; assessmentName: string; assessmentId: number; mark: number; grade: string;
  weight: number; isPromotional: boolean; isPass: boolean;
}
export interface SubjectResult {
  subject: string; cells: { assessmentId: number; name: string; mark: number | null }[];
  average: number; grade: string; remark: string;
}
export interface ReportCard {
  studentId: number; classId: number; termId: number;
  promotional: ReportCardRowItem[]; contributory: ReportCardRowItem[];
  columns: { id: number; name: string; isPromotional: boolean; weight: number }[];
  subjects: SubjectResult[];
  overallAverage: number; overallGrade: string; rank: number; classSize: number;
  status: string; teacherComment: string; passMark: number; gradingSystemName: string;
  bands: GradeBand[]; totalObtained: number; totalPossible: number; promotionVerdict: string;
}

export function bandRemark(label: string, bands: GradeBand[]): string {
  const sorted = [...bands].sort((a, b) => b.min_score - a.min_score);
  const idx = sorted.findIndex((b) => b.label === label);
  const words = ["Excellent", "Very Good", "Good", "Satisfactory", "Fair", "Fail"];
  if (idx < 0) return "";
  const band = sorted[idx]!;
  if (band.is_promotional_fail || band.is_repeater) return band.is_repeater ? "Repeat" : "Fail";
  return words[Math.min(idx, words.length - 2)] ?? "";
}

export function buildTeacherComment(average: number, status: string, promotional: ReportCardRowItem[]): string {
  const passed = promotional.filter((r) => r.isPass).length;
  const total = promotional.length;
  const verdict = total > 0 ? `${passed}/${total} promotional papers passed` : "No promotional paper on record";
  const core =
    status === "Excellent" ? "A very strong term. "
    : status === "On Track" ? "Good progress; keep the momentum. "
    : status === "At Risk" ? "Performance is below expectation and needs urgent attention. "
    : "No results recorded for this term yet. ";
  const sorted = [...promotional].sort((a, b) => b.mark - a.mark);
  const strongest = sorted[0], weakest = sorted[sorted.length - 1];
  let detail = "";
  if (strongest && strongest.mark > 0) detail = `Strongest: ${strongest.subject} (${strongest.mark.toFixed(0)}%). `;
  if (weakest && weakest.mark > 0 && weakest.mark < 50) detail += `Needs extra help in ${weakest.subject} (${weakest.mark.toFixed(0)}%). `;
  return `${core}${verdict}. ${detail}Recommended next step: ${average >= 50 ? "promote to the next class." : "repeat the class."}`;
}

function termAssessments(classId: number, termId: number, data: AcademicData) {
  return data.assessments
    .filter((a) => assessmentAppliesToClass(a, classId) && a.term_id === termId)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "") || b.weight_percent - a.weight_percent);
}

export function computeReportCard(studentId: number, termId: number, data: AcademicData): ReportCard | null {
  const student = data.students.find((s) => s.id === studentId);
  if (!student || !student.class_id) return null;
  const classId = student.class_id;
  const scale = resolveScale(classId, data);
  const subjName = new Map(data.subjects.map((s) => [s.id, s.name]));
  const assessments = termAssessments(classId, termId, data).filter((a) => assessmentForStudent(a, student));
  const aIds = new Set(assessments.map((a) => a.id));
  const marks = data.marks.filter((m) => m.student_id === studentId && aIds.has(m.assessment_id));
  const hasAnyRole = assessments.some((a) => a.promotion_role !== ROLE.None);

  const entries: { a: Assessment; subject: string; subjectId: number | null }[] = [];
  for (const a of assessments) {
    const linked = data.assessmentSubjects.filter((x) => x.assessment_id === a.id);
    if (linked.length > 0) linked.forEach((l) => entries.push({ a, subject: subjName.get(l.subject_id) ?? "General", subjectId: l.subject_id }));
    else entries.push({ a, subject: (a.subject_id && subjName.get(a.subject_id)) || "General", subjectId: null });
  }
  entries.sort((x, y) => x.subject.localeCompare(y.subject) || y.a.weight_percent - x.a.weight_percent || (y.a.due_date ?? "").localeCompare(x.a.due_date ?? ""));

  const promotional: ReportCardRowItem[] = [];
  const contributory: ReportCardRowItem[] = [];
  const bySubject = new Map<string, typeof entries>();
  for (const e of entries) bySubject.set(e.subject, [...(bySubject.get(e.subject) ?? []), e]);
  for (const [subject, group] of [...bySubject.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    group.forEach((e, i) => {
      if (hasAnyRole && e.a.promotion_role === ROLE.None) return;
      const mk = marks.find((m) => m.assessment_id === e.a.id && (e.subjectId == null || m.subject_id === e.subjectId))?.mark;
      const avg = mk ?? 0;
      const isPromo = hasAnyRole ? e.a.promotion_role === ROLE.EndOfTerm || e.a.promotion_role === ROLE.PromotionExam : i === 0;
      const row: ReportCardRowItem = {
        subject, assessmentName: e.a.name, assessmentId: e.a.id, mark: Math.round(avg * 10) / 10,
        grade: avg > 0 ? gradeFromBands(avg, scale.bands) : "-", weight: e.a.weight_percent,
        isPromotional: isPromo, isPass: checkPromotionalPass(avg, scale.passMark, scale.bands),
      };
      (isPromo ? promotional : contributory).push(row);
    });
  }
  const all = [...promotional, ...contributory];
  const overallAverage = all.length ? Math.round((all.reduce((p, r) => p + r.mark, 0) / all.length) * 10) / 10 : 0;
  const overallGrade = overallAverage > 0 ? gradeFromBands(overallAverage, scale.bands) : "-";
  const status = performanceStatus(overallAverage, scale.passMark);

  // Rank within class by each student's average over the same assessments.
  const classStudents = data.students.filter((s) => s.class_id === classId && s.is_active);
  const classIds = new Set(classStudents.map((s) => s.id));
  const sums = new Map<number, { t: number; n: number }>();
  for (const m of data.marks) {
    if (!classIds.has(m.student_id) || !aIds.has(m.assessment_id)) continue;
    const cur = sums.get(m.student_id) ?? { t: 0, n: 0 };
    cur.t += m.mark ?? 0; cur.n += 1; sums.set(m.student_id, cur);
  }
  const avgs = [...sums.values()].map((v) => v.t / v.n).sort((a, b) => b - a);
  const rank = avgs.length === 0 ? 0 : avgs.filter((v) => v > overallAverage).length + 1;

  // Columns & per-subject matrix (template layout: one column per assessment).
  const colMap = new Map<number, { id: number; name: string; isPromotional: boolean; weight: number }>();
  for (const r of all) if (!colMap.has(r.assessmentId)) colMap.set(r.assessmentId, { id: r.assessmentId, name: r.assessmentName, isPromotional: r.isPromotional, weight: r.weight });
  const columns = [...colMap.values()].sort((a, b) => Number(a.isPromotional) - Number(b.isPromotional));
  const subjects: SubjectResult[] = [...new Set(all.map((r) => r.subject))].sort().map((subject) => {
    const rows = all.filter((r) => r.subject === subject);
    const cells = columns.map((c) => ({ assessmentId: c.id, name: c.name, mark: rows.find((r) => r.assessmentId === c.id)?.mark ?? null }));
    const vals = rows.map((r) => r.mark);
    const average = vals.length ? Math.round((vals.reduce((p, c) => p + c, 0) / vals.length) * 10) / 10 : 0;
    const grade = average > 0 ? gradeFromBands(average, scale.bands) : "-";
    return { subject, cells, average, grade, remark: bandRemark(grade, scale.bands) };
  });
  const totalObtained = Math.round(subjects.reduce((p, s) => p + s.average, 0) * 10) / 10;
  const totalPossible = subjects.length * 100;
  const passed = checkPromotionalPass(overallAverage, scale.passMark, scale.bands);

  return {
    studentId, classId, termId, promotional, contributory, columns, subjects,
    overallAverage, overallGrade, rank, classSize: classStudents.length, status,
    teacherComment: buildTeacherComment(overallAverage, status, promotional),
    passMark: scale.passMark, gradingSystemName: scale.system?.name ?? "", bands: scale.bands,
    totalObtained, totalPossible,
    promotionVerdict: overallAverage === 0 ? "—" : passed ? "PROMOTED" : "REPEAT",
  };
}

/** Terminal (year-end) average used for promotion, mirroring ComputeStudentAverageAsync. */
export function computeStudentAverage(studentId: number, data: AcademicData): number {
  const amap = new Map(data.assessments.map((a) => [a.id, a]));
  const tmap = new Map(data.terms.map((t) => [t.id, t]));
  const subjName = new Map(data.subjects.map((s) => [s.id, s.name]));
  const marks = data.marks.filter((m) => m.student_id === studentId && m.mark != null && amap.has(m.assessment_id));
  const termsWith = [...new Set(marks.map((m) => amap.get(m.assessment_id)!.term_id).filter((x): x is number => x != null))]
    .map((id) => tmap.get(id)).filter(Boolean) as typeof data.terms;
  termsWith.sort((a, b) => ((b.end_date ?? b.start_date ?? "").localeCompare(a.end_date ?? a.start_date ?? "")) || b.id - a.id);
  const latest = termsWith[0];
  const termMarks = latest ? marks.filter((m) => amap.get(m.assessment_id)!.term_id === latest.id) : marks;
  const hasAnyRole = termMarks.some((m) => amap.get(m.assessment_id)!.promotion_role !== ROLE.None);
  const groups = new Map<string, Mark[]>();
  for (const m of termMarks) {
    const a = amap.get(m.assessment_id)!;
    const sid = markSubjectId(m, a);
    const key = (sid && subjName.get(sid)) || "General";
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  const subjectAvgs: number[] = [];
  const byWeight = (x: Mark, y: Mark) => {
    const a = amap.get(x.assessment_id)!, b = amap.get(y.assessment_id)!;
    return b.weight_percent - a.weight_percent || (b.due_date ?? "").localeCompare(a.due_date ?? "");
  };
  for (const grp of groups.values()) {
    let mark: number | null = null;
    if (hasAnyRole) {
      const exam = [...grp].sort(byWeight).find((m) => amap.get(m.assessment_id)!.promotion_role === ROLE.PromotionExam);
      if (exam) mark = exam.mark;
      else {
        const c = grp.filter((m) => amap.get(m.assessment_id)!.promotion_role === ROLE.CountsTowardPromotion).map((m) => m.mark!);
        if (c.length) mark = c.reduce((p, v) => p + v, 0) / c.length;
      }
    } else {
      mark = [...grp].sort(byWeight)[0]?.mark ?? null;
    }
    if (mark != null) subjectAvgs.push(mark);
  }
  return subjectAvgs.length ? subjectAvgs.reduce((p, v) => p + v, 0) / subjectAvgs.length : 0;
}

export function numericSuffix(name: string): number {
  const d = name.replace(/\D/g, "");
  return d ? parseInt(d, 10) : Number.MAX_SAFE_INTEGER;
}

export function suggestNextClass(classId: number, classes: AcademicData["classes"]) {
  const cur = classes.find((c) => c.id === classId);
  if (!cur) return null;
  const n = numericSuffix(cur.name);
  return [...classes].filter((c) => c.id !== cur.id && numericSuffix(c.name) > n)
    .sort((a, b) => numericSuffix(a.name) - numericSuffix(b.name))[0] ?? null;
}

export interface PromotionRow {
  studentId: number; name: string; lin: string; classId: number | null; className: string; stream: string;
  average: number; passMark: number; grade: string; suggested: 1 | 2; status: number;
  targetClassId: number | null; targetClassName: string;
}

export function promotionOverview(data: AcademicData, classId?: number | null): PromotionRow[] {
  const cname = new Map(data.classes.map((c) => [c.id, c.name]));
  const sname = new Map(data.streams.map((s) => [s.id, s.name]));
  return data.students
    .filter((s) => s.is_active && (!classId || s.class_id === classId))
    .map((s) => {
      const scale = resolveScale(s.class_id, data);
      const avg = computeStudentAverage(s.id, data);
      const next = s.class_id ? suggestNextClass(s.class_id, data.classes) : null;
      return {
        studentId: s.id, name: s.full_name, lin: s.lin, classId: s.class_id,
        className: s.class_id ? cname.get(s.class_id) ?? "-" : "-", stream: s.stream_id ? sname.get(s.stream_id) ?? "-" : "-",
        average: Math.round(avg * 10) / 10, passMark: scale.passMark,
        grade: avg > 0 ? gradeFromBands(avg, scale.bands) : "-",
        suggested: checkPromotionalPass(avg, scale.passMark, scale.bands) ? 1 : 2,
        status: s.promotion_status, targetClassId: next?.id ?? null, targetClassName: next?.name ?? "",
      } as PromotionRow;
    })
    .sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name));
}
