import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Save, Eraser } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAcademicData, useInvalidate, type Mark } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { useTermContext } from "@/lib/term-context";
import { assessmentScope, assessmentSubjectIds, completionPercent, gradeFromBands, resolveScale, rosterFor, streamIdsOf } from "@/lib/academics";
import { errMsg } from "@/lib/format";
import { pageHead } from "@/lib/seo";
import { Empty, Field, FilterBar, Loading, NativeSelect, PageHeader, Panel, ProgressBar, Table, Td, Th } from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/marks-entry")({
  validateSearch: z.object({ assessment: z.number().optional() }),
  head: () => pageHead("Marks Entry", "Enter marks per class, assessment and subject; grades follow the class grading system."),
  component: MarksEntryPage,
});

function MarksEntryPage() {
  const search = Route.useSearch();
  const { data, isLoading } = useAcademicData();
  const { user } = useAuth();
  const { termId } = useTermContext();
  const invalidate = useInvalidate();
  const [classId, setClassId] = useState("");
  const [assessmentId, setAssessmentId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [draft, setDraft] = useState<Record<number, { mark: string; remarks: string }>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (search.assessment && data.assessments.length && !assessmentId) {
      const a = data.assessments.find((x) => x.id === search.assessment);
      if (a) { setClassId(String(a.class_id)); setAssessmentId(String(a.id)); }
    }
  }, [search.assessment, data.assessments, assessmentId]);

  const cid = Number(classId);
  const assessments = data.assessments.filter((a) => (!termId || a.term_id === termId || a.id === search.assessment) && cid && (a.is_school_wide || a.class_id === cid));
  const a = data.assessments.find((x) => x.id === Number(assessmentId));
  const multi = a ? a.subject_id == null : false;
  const subjOptions = a ? assessmentSubjectIds(a, data).filter((sid) => !a.is_school_wide || data.classSubjects.some((cs) => cs.class_id === cid && cs.subject_id === sid) || !data.classSubjects.some((cs) => cs.class_id === cid)) : [];
  const streamOptions = a && assessmentScope(a) === "Stream" ? streamIdsOf(a) : [];
  const effSubject = multi ? (subjectId ? Number(subjectId) : null) : a?.subject_id ?? null;
  const scale = resolveScale(cid, data);

  const roster = useMemo(() => {
    if (!a) return [];
    return rosterFor(a, data, cid).filter((s) => !streamId || s.stream_id === Number(streamId)).sort((x, y) => x.full_name.localeCompare(y.full_name));
  }, [a, data, cid, streamId]);

  const existing = useMemo(() => {
    const m = new Map<number, Mark>();
    if (!a) return m;
    for (const mk of data.marks) if (mk.assessment_id === a.id && (multi ? mk.subject_id === effSubject : mk.subject_id == null)) m.set(mk.student_id, mk);
    return m;
  }, [a, data.marks, multi, effSubject]);

  useEffect(() => {
    const d: Record<number, { mark: string; remarks: string }> = {};
    for (const s of roster) { const e = existing.get(s.id); d[s.id] = { mark: e?.mark != null ? String(e.mark) : "", remarks: e?.remarks ?? "" }; }
    setDraft(d);
  }, [roster, existing]);

  if (isLoading) return <Loading />;
  const ready = a && (!multi || effSubject);

  async function saveAll() {
    if (!a || !ready) return;
    const updates: { id: number; mark: number | null; grade: string | null; remarks: string | null; entered_by: string | null; entered_at: string; student_id: number; assessment_id: number; subject_id: number | null }[] = [];
    const inserts: Omit<(typeof updates)[number], "id">[] = [];
    for (const s of roster) {
      const v = draft[s.id]; if (!v) continue;
      const e = existing.get(s.id);
      if (v.mark.trim() === "" && !e) continue;
      const num = v.mark.trim() === "" ? null : Number(v.mark);
      if (num != null && (isNaN(num) || num < 0 || num > 100)) { toast.error(`${s.full_name}: marks must be between 0 and 100.`); return; }
      if (e && e.mark === num && (e.remarks ?? "") === v.remarks) continue;
      const row = { mark: num, grade: num != null ? gradeFromBands(num, scale.bands) : null, remarks: v.remarks || null, entered_by: user?.id ?? null, entered_at: new Date().toISOString(), student_id: s.id, assessment_id: a.id, subject_id: multi ? effSubject : null };
      if (e) updates.push({ id: e.id, ...row }); else inserts.push(row);
    }
    if (!updates.length && !inserts.length) { toast.info("No changes to save."); return; }
    setBusy(true);
    try {
      if (updates.length) { const { error } = await supabase.from("marks").upsert(updates, { onConflict: "id" }); if (error) throw error; }
      if (inserts.length) { const { error } = await supabase.from("marks").insert(inserts); if (error) throw error; }
      const { data: fresh } = await supabase.from("marks").select("*").eq("assessment_id", a.id);
      const pctDone = completionPercent(a, { ...data, marks: fresh ?? [] });
      await supabase.from("assessments").update({ marks_entered_percent: pctDone }).eq("id", a.id);
      await invalidate("marks", "assessments");
      toast.success(`Saved ${updates.length + inserts.length} mark(s).`);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  async function clear(studentId: number) {
    const e = existing.get(studentId);
    if (!e) { setDraft({ ...draft, [studentId]: { mark: "", remarks: "" } }); return; }
    const { error } = await supabase.from("marks").delete().eq("id", e.id);
    if (error) { toast.error(errMsg(error)); return; }
    invalidate("marks");
  }

  const entered = roster.filter((s) => draft[s.id]?.mark?.trim()).length;

  return (
    <div>
      <PageHeader title="Marks Entry" subtitle={scale.system ? `Grading: ${scale.system.name} · pass mark ${scale.passMark}%` : "Grading: default A–F scale"}
        actions={<Button onClick={saveAll} disabled={!ready || busy}><Save /> {busy ? "Saving…" : "Save marks"}</Button>} />
      <FilterBar>
        <Field label="Class"><NativeSelect value={classId} onChange={(v) => { setClassId(v); setAssessmentId(""); setSubjectId(""); setStreamId(""); }}><option value="">Select class</option>{data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
        <Field label="Assessment" className="min-w-[220px]"><NativeSelect value={assessmentId} onChange={(v) => { setAssessmentId(v); setSubjectId(""); setStreamId(""); }} disabled={!classId}><option value="">Select assessment</option>{assessments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</NativeSelect></Field>
        {streamOptions.length > 0 && <Field label="Stream"><NativeSelect value={streamId} onChange={setStreamId}><option value="">All target streams</option>{streamOptions.map((id) => <option key={id} value={id}>{data.streams.find((s) => s.id === id)?.name}</option>)}</NativeSelect></Field>}
        {multi && <Field label="Subject"><NativeSelect value={subjectId} onChange={setSubjectId}><option value="">Select subject</option>{subjOptions.map((id) => <option key={id} value={id}>{data.subjects.find((s) => s.id === id)?.name}</option>)}</NativeSelect></Field>}
      </FilterBar>
      {!ready ? <Panel><Empty title="Choose what to mark" hint="Pick a class and an assessment (and a subject for multi-subject papers) to load the class list." /></Panel> : (
        <Panel bodyClassName="p-0" title={`${roster.length} students`} actions={<div className="flex w-56 items-center gap-2 text-xs text-muted-foreground"><ProgressBar value={roster.length ? (entered * 100) / roster.length : 0} tone="success" />{entered}/{roster.length}</div>}>
          {roster.length === 0 ? <Empty title="No students in this class or stream" /> : (
            <Table>
              <thead><tr><Th className="w-12">#</Th><Th>LIN</Th><Th>Student</Th><Th className="w-32">Mark (0–100)</Th><Th className="w-20">Grade</Th><Th>Remarks</Th><Th className="w-12" /></tr></thead>
              <tbody>
                {roster.map((s, i) => {
                  const v = draft[s.id] ?? { mark: "", remarks: "" };
                  const n = v.mark.trim() === "" ? null : Number(v.mark);
                  const bad = n != null && (isNaN(n) || n < 0 || n > 100);
                  return (
                    <tr key={s.id}>
                      <Td className="text-muted-foreground">{i + 1}</Td>
                      <Td className="font-mono text-xs">{s.lin}</Td>
                      <Td className="font-medium">{s.full_name}</Td>
                      <Td><Input inputMode="decimal" aria-label={`Mark for ${s.full_name}`} aria-invalid={bad} className={bad ? "border-destructive" : ""} value={v.mark} onChange={(e) => setDraft({ ...draft, [s.id]: { ...v, mark: e.target.value } })} /></Td>
                      <Td className="font-semibold">{n != null && !bad ? gradeFromBands(n, scale.bands) : "—"}</Td>
                      <Td><Input value={v.remarks} aria-label={`Remarks for ${s.full_name}`} onChange={(e) => setDraft({ ...draft, [s.id]: { ...v, remarks: e.target.value } })} /></Td>
                      <Td><Button size="icon" variant="ghost" aria-label="Clear mark" onClick={() => clear(s.id)}><Eraser /></Button></Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Panel>
      )}
    </div>
  );
}
