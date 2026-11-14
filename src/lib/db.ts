import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Student = Tables<"students">;
export type ClassRow = Tables<"classes">;
export type Stream = Tables<"streams">;
export type ClassStream = Tables<"class_streams">;
export type Subject = Tables<"subjects">;
export type ClassSubject = Tables<"class_subjects">;
export type Term = Tables<"terms">;
export type AcademicYear = Tables<"academic_years">;
export type Assessment = Tables<"assessments">;
export type AssessmentSubject = Tables<"assessment_subjects">;
export type Mark = Tables<"marks">;
export type GradingSystem = Tables<"grading_systems">;
export type GradeBand = Tables<"grade_bands">;
export type Teacher = Tables<"teachers">;
export type TermFee = Tables<"term_fees">;
export type FeePayment = Tables<"fee_payments">;
export type StudentCredit = Tables<"student_credits">;
export type BudgetLine = Tables<"budget_lines">;
export type SchoolSettings = Tables<"school_settings">;
export type HeadTeacherComment = Tables<"head_teacher_comments">;
export type TerminationLog = Tables<"termination_logs">;
export type Enrollment = Tables<"enrollments">;
export type InviteCode = Tables<"invite_codes">;

type TableName =
  | "students" | "classes" | "streams" | "class_streams" | "subjects" | "class_subjects"
  | "terms" | "academic_years" | "assessments" | "assessment_subjects" | "marks"
  | "grading_systems" | "grade_bands" | "teachers" | "term_fees" | "fee_payments"
  | "student_credits" | "budget_lines" | "head_teacher_comments" | "termination_logs"
  | "enrollments" | "invite_codes";

const ORDER: Partial<Record<TableName, string>> = {
  students: "full_name", classes: "name", streams: "name", subjects: "name",
  terms: "id", academic_years: "id", assessments: "id", marks: "id",
  grading_systems: "name", grade_bands: "min_score", teachers: "full_name",
  term_fees: "id", fee_payments: "id", student_credits: "id", budget_lines: "id",
  head_teacher_comments: "id", termination_logs: "id", enrollments: "id", invite_codes: "id",
};

/** Reads every row of a table, paging past the 1000-row API limit. */
export async function fetchAll<T>(table: TableName): Promise<T[]> {
  const pageSize = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    let q = supabase.from(table).select("*").range(from, from + pageSize - 1);
    const col = ORDER[table];
    if (col) q = q.order(col, { ascending: true });
    const { data, error } = await q;
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

export function useTable<T>(table: TableName, enabled = true) {
  return useQuery({
    queryKey: ["table", table],
    queryFn: () => fetchAll<T>(table),
    enabled,
    staleTime: 30_000,
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (...tables: TableName[]) =>
    Promise.all(tables.map((t) => qc.invalidateQueries({ queryKey: ["table", t] })));
}

export const useStudents = () => useTable<Student>("students");
export const useClasses = () => useTable<ClassRow>("classes");
export const useStreams = () => useTable<Stream>("streams");
export const useClassStreams = () => useTable<ClassStream>("class_streams");
export const useSubjects = () => useTable<Subject>("subjects");
export const useClassSubjects = () => useTable<ClassSubject>("class_subjects");
export const useTerms = () => useTable<Term>("terms");
export const useAcademicYears = () => useTable<AcademicYear>("academic_years");
export const useAssessments = () => useTable<Assessment>("assessments");
export const useAssessmentSubjects = () => useTable<AssessmentSubject>("assessment_subjects");
export const useMarks = () => useTable<Mark>("marks");
export const useGradingSystems = () => useTable<GradingSystem>("grading_systems");
export const useGradeBands = () => useTable<GradeBand>("grade_bands");
export const useTeachers = () => useTable<Teacher>("teachers");
export const useTermFees = () => useTable<TermFee>("term_fees");
export const useFeePayments = () => useTable<FeePayment>("fee_payments");
export const useStudentCredits = () => useTable<StudentCredit>("student_credits");
export const useBudgetLines = () => useTable<BudgetLine>("budget_lines");
export const useHeadTeacherComments = () => useTable<HeadTeacherComment>("head_teacher_comments");
export const useTerminationLogs = (enabled = true) => useTable<TerminationLog>("termination_logs", enabled);
export const useEnrollments = () => useTable<Enrollment>("enrollments");
export const useInviteCodes = (enabled = true) => useTable<InviteCode>("invite_codes", enabled);

export function useSchoolSettings() {
  return useQuery({
    queryKey: ["school_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("school_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data as SchoolSettings | null;
    },
    staleTime: 60_000,
  });
}

/** Signed URL for a private school-media object (student photo, school logo). */
export function useMediaUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["media", path],
    enabled: !!path,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("school-media").createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export async function uploadMedia(folder: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("school-media").upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return path;
}

/** Bundle of the academic tables most pages need together. */
export function useAcademicData() {
  const students = useStudents();
  const classes = useClasses();
  const streams = useStreams();
  const classStreams = useClassStreams();
  const subjects = useSubjects();
  const classSubjects = useClassSubjects();
  const terms = useTerms();
  const years = useAcademicYears();
  const assessments = useAssessments();
  const assessmentSubjects = useAssessmentSubjects();
  const marks = useMarks();
  const gradingSystems = useGradingSystems();
  const gradeBands = useGradeBands();
  const all = [students, classes, streams, classStreams, subjects, classSubjects, terms, years, assessments, assessmentSubjects, marks, gradingSystems, gradeBands];
  const isLoading = all.some((q) => q.isLoading);
  const error = all.find((q) => q.error)?.error;
  return {
    isLoading,
    error,
    data: {
      students: students.data ?? [],
      classes: classes.data ?? [],
      streams: streams.data ?? [],
      classStreams: classStreams.data ?? [],
      subjects: subjects.data ?? [],
      classSubjects: classSubjects.data ?? [],
      terms: terms.data ?? [],
      years: years.data ?? [],
      assessments: assessments.data ?? [],
      assessmentSubjects: assessmentSubjects.data ?? [],
      marks: marks.data ?? [],
      gradingSystems: gradingSystems.data ?? [],
      gradeBands: gradeBands.data ?? [],
    },
  };
}
export type AcademicData = ReturnType<typeof useAcademicData>["data"];
