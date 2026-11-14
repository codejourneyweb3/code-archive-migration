import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye, Printer, FileText, Save } from "lucide-react";
import { local } from "@/lib/offline/client";
import {
  useAcademicData, useFeePayments, useHeadTeacherComments, useInvalidate, useMediaUrl, useSchoolSettings, useTeachers, useTermFees,
  type AcademicData, type SchoolSettings,
} from "@/lib/db";
import { useTermContext } from "@/lib/term-context";
import { ROLE, assessmentAppliesToClass, assessmentForStudent, computeReportCard, gradeFromBands, markSubjectId, resolveScale, type ReportCard } from "@/lib/academics";
import { expectedFor, feeStatus, paidBy } from "@/lib/finance";
import { errMsg } from "@/lib/format";
import { pageHead } from "@/lib/seo";
import { Empty, Field, FilterBar, Loading, NativeSelect, PageHeader, Panel, StatusBadge, Table, Td, Th } from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PrintArea } from "@/components/reports/PrintArea";
import { MidTermSlip, ReportCardSheet, type SheetContext, type SlipRow } from "@/components/reports/ReportCardSheet";

export const Route = createFileRoute("/_app/report-cards")({
  head: () => pageHead("Report Cards", "Preview, print and save A4 report cards and mid-term slips as PDF."),
  component: ReportCardsPage,
});

interface Ctx { data: AcademicData; settings: SchoolSettings | null | undefined; logoUrl?: string | null | undefined; termName: string; yearName: string; teacherName: (id: number | null) => string; comment: (sid: number) => string }

function useSheetCtx(studentId: number, c: Ctx): SheetContext {
  const s = c.data.students.find((x) => x.id === studentId)!;
  const { data: photoUrl } = useMediaUrl(s.photo_path);
  const cls = c.data.classes.find((x) => x.id === s.class_id);
  return {
    settings: c.settings, logoUrl: c.logoUrl, photoUrl, student: s, className: cls?.name ?? "", streamName: c.data.streams.find((x) => x.id === s.stream_id)?.name ?? "",
    termName: c.termName, yearName: c.yearName, classTeacher: c.teacherName(cls?.class_teacher_id ?? null), headComment: c.comment(s.id),
  };
}

function CardFor({ studentId, termId, c }: { studentId: number; termId: number; c: Ctx }) {
  const rc = useMemo(() => computeReportCard(studentId, termId, c.data), [studentId, termId, c.data]);
  const ctx = useSheetCtx(studentId, c);
  if (!rc) return null;
  return <ReportCardSheet rc={rc} ctx={ctx} />;
}

function slipFor(studentId: number, termId: number, data: AcademicData) {
  const s = data.students.find((x) => x.id === studentId)!;
  const scale = resolveScale(s.class_id, data);
  const subjName = new Map(data.subjects.map((x) => [x.id, x.name]));
  const as = data.assessments.filter((a) => s.class_id && assessmentAppliesToClass(a, s.class_id) && a.term_id === termId && a.promotion_role !== ROLE.EndOfTerm && a.promotion_role !== ROLE.PromotionExam && assessmentForStudent(a, s));
  const amap = new Map(as.map((a) => [a.id, a]));
  const marks = data.marks.filter((m) => m.student_id === studentId && amap.has(m.assessment_id));
  const columns = [...new Set(as.map((a) => a.name))];
  const subjects = new Map<string, { name: string; mark: number | null }[]>();
  for (const m of marks) { const k = subjName.get(markSubjectId(m, amap.get(m.assessment_id)) ?? -1) ?? "General"; subjects.set(k, [...(subjects.get(k) ?? []), { name: amap.get(m.assessment_id)!.name, mark: m.mark }]); }
  const rows: SlipRow[] = [...subjects.entries()].sort().map(([subject, ms]) => { const v = ms.map((x) => x.mark ?? 0); const avg = v.reduce((p, c) => p + c, 0) / v.length; return { subject, marks: ms, average: avg, grade: gradeFromBands(avg, scale.bands) }; });
  const average = rows.length ? rows.reduce((p, r) => p + r.average, 0) / rows.length : 0;
  return { rows, columns, average, grade: average ? gradeFromBands(average, scale.bands) : "-" };
}

function SlipFor({ studentId, termId, c, rank, classSize }: { studentId: number; termId: number; c: Ctx; rank: number; classSize: number }) {
  const ctx = useSheetCtx(studentId, c);
  const slip = useMemo(() => slipFor(studentId, termId, c.data), [studentId, termId, c.data]);
  return <MidTermSlip ctx={ctx} {...slip} rank={rank} classSize={classSize} />;
}

function ReportCardsPage() {
  const { data, isLoading } = useAcademicData();
  const { termId, term } = useTermContext();
  const { data: settings } = useSchoolSettings();
  const { data: logoUrl } = useMediaUrl(settings?.logo_path);
  const { data: teachers = [] } = useTeachers();
  const { data: comments = [] } = useHeadTeacherComments();
  const { data: termFees = [] } = useTermFees();
  const { data: payments = [] } = useFeePayments();
  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [feeFilter, setFeeFilter] = useState("");
  const [mode, setMode] = useState<"cards" | "slips">("cards");
  const [preview, setPreview] = useState<number | null>(null);
  const [printIds, setPrintIds] = useState<number[] | null>(null);

  const cid = Number(classId) || data.classes[0]?.id;
  const rows = useMemo(() => {
    if (!termId || !cid) return [];
    return data.students.filter((s) => s.is_active && s.class_id === cid && (!streamId || s.stream_id === Number(streamId))).map((s) => {
      const rc = computeReportCard(s.id, termId, data) as ReportCard;
      const expected = expectedFor(s, termFees, termId), paid = paidBy(s.id, payments, termId);
      return { s, rc, fee: feeStatus(expected, paid) };
    }).filter((r) => !feeFilter || r.fee === feeFilter).sort((a, b) => b.rc.overallAverage - a.rc.overallAverage);
  }, [data, termId, cid, streamId, termFees, payments, feeFilter]);

  if (isLoading) return <Loading />;
  if (!termId || !term) return <Panel><Empty title="No term selected" hint="Create a term under Term Management first." /></Panel>;

  const c: Ctx = {
    data, settings, logoUrl, termName: term.name,
    yearName: data.years.find((y) => y.id === data.assessments.find((a) => a.term_id === termId)?.academic_year_id)?.name ?? data.years[0]?.name ?? String(new Date().getFullYear()),
    teacherName: (id) => teachers.find((t) => t.id === id)?.full_name ?? "",
    comment: (sid) => comments.find((x) => x.student_id === sid && x.term_id === termId)?.comment ?? "",
  };
  const streams = data.classStreams.filter((cs) => cs.class_id === cid).map((cs) => data.streams.find((s) => s.id === cs.stream_id)!).filter(Boolean);

  return (
    <div>
      <PageHeader title="Report Cards" subtitle={`${term.name} · print opens your browser's print dialog — choose a printer or "Save as PDF".`}
        actions={<Button onClick={() => rows.length ? setPrintIds(rows.map((r) => r.s.id)) : toast.info("No students to print.")}><Printer /> Print all {mode === "slips" ? "slips" : "cards"}</Button>} />
      <FilterBar>
        <Field label="Class"><NativeSelect value={String(cid ?? "")} onChange={(v) => { setClassId(v); setStreamId(""); }}>{data.classes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</NativeSelect></Field>
        <Field label="Stream"><NativeSelect value={streamId} onChange={setStreamId}><option value="">All streams</option>{streams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect></Field>
        <Field label="Fee status"><NativeSelect value={feeFilter} onChange={setFeeFilter}><option value="">Any</option><option>Paid</option><option>Partial</option><option>Unpaid</option><option>N/A</option></NativeSelect></Field>
        <div className="ml-auto"><Tabs value={mode} onValueChange={(v) => setMode(v as "cards" | "slips")}><TabsList><TabsTrigger value="cards">Report cards</TabsTrigger><TabsTrigger value="slips">Mid-term slips</TabsTrigger></TabsList></Tabs></div>
      </FilterBar>
      <Panel bodyClassName="p-0">
        {rows.length === 0 ? <Empty title="No students in this class" /> : (
          <Table>
            <thead><tr><Th>Rank</Th><Th>Student</Th><Th>LIN</Th><Th>Average</Th><Th>Grade</Th><Th>Status</Th><Th>Fees</Th><Th className="text-right">Actions</Th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={r.s.id} className="hover:bg-muted/40">
                <Td className="font-semibold">{r.rc.overallAverage ? i + 1 : "—"}</Td><Td className="font-medium">{r.s.full_name}</Td><Td className="font-mono text-xs">{r.s.lin}</Td>
                <Td>{r.rc.overallAverage ? `${r.rc.overallAverage}%` : "—"}</Td><Td className="font-bold">{r.rc.overallGrade}</Td><Td><StatusBadge status={r.rc.status} /></Td><Td><StatusBadge status={r.fee} /></Td>
                <Td className="whitespace-nowrap text-right">
                  <Button size="sm" variant="ghost" onClick={() => setPreview(r.s.id)}><Eye /> Preview</Button>
                  <Button size="sm" variant="ghost" onClick={() => setPrintIds([r.s.id])}><Printer /> Print</Button>
                </Td>
              </tr>
            ))}</tbody>
          </Table>
        )}
      </Panel>

      {preview && (
        <Dialog open onOpenChange={(o) => !o && setPreview(null)}>
          <DialogContent className="max-h-[94vh] max-w-[980px] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> {mode === "slips" ? "Mid-term slip" : "Report card"} preview</DialogTitle></DialogHeader>
            <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
              <div className="overflow-x-auto rounded-lg bg-muted p-3"><div className="origin-top-left">{mode === "slips"
                ? <SlipFor studentId={preview} termId={termId} c={c} rank={rows.findIndex((r) => r.s.id === preview) + 1} classSize={rows.length} />
                : <CardFor studentId={preview} termId={termId} c={c} />}</div></div>
              <div className="space-y-3">
                <Button className="w-full" onClick={() => setPrintIds([preview])}><Printer /> Print / Save PDF</Button>
                {mode === "cards" && <HeadComment studentId={preview} termId={termId} initial={c.comment(preview)} headName={settings?.head_teacher_name ?? ""} />}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {printIds && <PrintArea onDone={() => setPrintIds(null)}>
        {printIds.map((id) => mode === "slips"
          ? <SlipFor key={id} studentId={id} termId={termId} c={c} rank={rows.findIndex((r) => r.s.id === id) + 1} classSize={rows.length} />
          : <CardFor key={id} studentId={id} termId={termId} c={c} />)}
      </PrintArea>}
    </div>
  );
}

function HeadComment({ studentId, termId, initial, headName }: { studentId: number; termId: number; initial: string; headName: string }) {
  const invalidate = useInvalidate();
  const [text, setText] = useState(initial);
  useEffect(() => setText(initial), [initial]);
  async function save() {
    const { data: existing } = await local.from("head_teacher_comments").select("id").eq("student_id", studentId).eq("term_id", termId).maybeSingle();
    const row = { student_id: studentId, term_id: termId, comment: text, head_teacher_name: headName };
    const { error } = existing ? await local.from("head_teacher_comments").update(row).eq("id", existing.id) : await local.from("head_teacher_comments").insert(row);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Remark saved."); invalidate("head_teacher_comments");
  }
  return (
    <div className="rounded-lg border p-3">
      <p className="mb-2 text-sm font-semibold">Head teacher's remark</p>
      <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a remark for this term…" />
      <Button size="sm" variant="outline" className="mt-2 w-full" onClick={save}><Save /> Save remark</Button>
    </div>
  );
}

