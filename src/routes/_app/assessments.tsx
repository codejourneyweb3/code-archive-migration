import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, PenLine, CheckCircle2, Globe2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAcademicData, useInvalidate, type Assessment } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { useTermContext } from "@/lib/term-context";
import { PROMOTION_ROLES, assessmentScope, assessmentSubjectIds, completionPercent, roleLabel, streamIdsOf } from "@/lib/academics";
import { errMsg, fmtDate } from "@/lib/format";
import { pageHead } from "@/lib/seo";
import { Empty, Field, FilterBar, Loading, NativeSelect, PageHeader, Panel, ProgressBar, Table, Td, Th } from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/assessments")({
  head: () => pageHead("Assessments", "Create school, class and stream assessments and track marks entry."),
  component: AssessmentsPage,
});

const SCOPE_LABEL = { Single: "Single subject", AllInClass: "Multi-subject", SpecificSubjects: "Selected subjects", AllInSchool: "Entire school", Stream: "Stream" } as const;

function AssessmentsPage() {
  const { data, isLoading } = useAcademicData();
  const { termId } = useTermContext();
  const invalidate = useInvalidate();
  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [open, setOpen] = useState(false);

  const cname = useMemo(() => new Map(data.classes.map((c) => [c.id, c.name])), [data.classes]);
  const subjName = useMemo(() => new Map(data.subjects.map((s) => [s.id, s.name])), [data.subjects]);
  const strName = useMemo(() => new Map(data.streams.map((s) => [s.id, s.name])), [data.streams]);

  const classSubjects = classId ? data.classSubjects.filter((cs) => cs.class_id === Number(classId)).map((cs) => cs.subject_id) : data.subjects.map((s) => s.id);
  const classStreams = classId ? data.classStreams.filter((cs) => cs.class_id === Number(classId)).map((cs) => cs.stream_id) : data.streams.map((s) => s.id);

  const list = data.assessments
    .filter((a) => (!termId || a.term_id === termId))
    .filter((a) => !classId || a.is_school_wide || a.class_id === Number(classId))
    .filter((a) => !subjectId || assessmentSubjectIds(a, data).includes(Number(subjectId)))
    .filter((a) => !streamId || a.is_class_wide || a.is_school_wide || streamIdsOf(a).includes(Number(streamId)))
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);

  if (isLoading) return <Loading />;

  async function toggle(a: Assessment, field: "is_verified" | "is_published", v: boolean) {
    const { error } = await supabase.from("assessments").update(field === "is_verified" ? { is_verified: v } : { is_published: v }).eq("id", a.id);
    if (error) { toast.error(errMsg(error)); return; }
    invalidate("assessments");
  }
  async function remove(a: Assessment) {
    if (!confirm(`Delete "${a.name}" and all its marks?`)) return;
    const { error } = await supabase.from("assessments").delete().eq("id", a.id);
    if (error) { toast.error(errMsg(error)); return; }
    invalidate("assessments", "marks", "assessment_subjects");
  }

  return (
    <div>
      <PageHeader title="Assessments" subtitle="Newest first. Completion counts every student × subject the paper covers."
        actions={<Button onClick={() => setOpen(true)}><Plus /> Create assessment</Button>} />
      <FilterBar>
        <Field label="Class"><NativeSelect value={classId} onChange={(v) => { setClassId(v); setStreamId(""); setSubjectId(""); }}><option value="">All classes</option>{data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
        <Field label="Stream"><NativeSelect value={streamId} onChange={setStreamId}><option value="">All streams</option>{classStreams.map((id) => <option key={id} value={id}>{strName.get(id)}</option>)}</NativeSelect></Field>
        <Field label="Subject"><NativeSelect value={subjectId} onChange={setSubjectId}><option value="">All subjects</option>{classSubjects.map((id) => <option key={id} value={id}>{subjName.get(id)}</option>)}</NativeSelect></Field>
      </FilterBar>
      <Panel bodyClassName="p-0" title={`${list.length} assessment${list.length === 1 ? "" : "s"} this term`}>
        {list.length === 0 ? <Empty title="No assessments for this term" hint="Create one, or switch term in the top bar." /> : (
          <Table>
            <thead><tr><Th>Assessment</Th><Th>Class</Th><Th>Subjects</Th><Th>Role</Th><Th>Weight</Th><Th>Due</Th><Th className="w-40">Marks entered</Th><Th>Verified</Th><Th>Published</Th><Th /></tr></thead>
            <tbody>
              {list.map((a) => {
                const pctDone = completionPercent(a, data);
                const subs = assessmentSubjectIds(a, data).map((id) => subjName.get(id)).filter(Boolean);
                const scope = assessmentScope(a);
                return (
                  <tr key={a.id} className="hover:bg-muted/40">
                    <Td><p className="font-semibold">{a.name}</p><p className="text-xs text-muted-foreground">{SCOPE_LABEL[scope]}{a.author_name ? ` · by ${a.author_name}` : ""}</p></Td>
                    <Td>{a.is_school_wide ? <span className="flex items-center gap-1"><Globe2 className="h-3.5 w-3.5" /> All classes</span> : cname.get(a.class_id)}{scope === "Stream" && <p className="text-xs text-muted-foreground">{streamIdsOf(a).map((id) => strName.get(id)).join(", ")}</p>}</Td>
                    <Td className="max-w-[220px] text-xs">{subs.join(", ") || "—"}</Td>
                    <Td><Badge variant={a.promotion_role === 2 || a.promotion_role === 3 ? "info" : a.promotion_role === 0 ? "muted" : "outline"}>{roleLabel(a.promotion_role)}</Badge></Td>
                    <Td>{a.weight_percent}%</Td>
                    <Td className="whitespace-nowrap">{fmtDate(a.due_date)}</Td>
                    <Td><div className="flex items-center gap-2"><ProgressBar value={pctDone} tone={pctDone >= 100 ? "success" : pctDone > 0 ? "primary" : "warning"} /><span className="w-9 text-xs">{pctDone}%</span></div></Td>
                    <Td><Switch checked={a.is_verified} onCheckedChange={(v) => toggle(a, "is_verified", v)} aria-label="Verified" /></Td>
                    <Td><Switch checked={a.is_published} onCheckedChange={(v) => toggle(a, "is_published", v)} aria-label="Published" /></Td>
                    <Td className="whitespace-nowrap text-right">
                      <Button size="icon" variant="ghost" asChild aria-label="Enter marks"><Link to="/marks-entry" search={{ assessment: a.id }}><PenLine /></Link></Button>
                      <Button size="icon" variant="danger-ghost" aria-label="Delete assessment" onClick={() => remove(a)}><Trash2 /></Button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>
      {open && <CreateDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

type Scope = "school" | "class" | "stream";
type Granularity = "single" | "all" | "specific";

function CreateDialog({ onClose }: { onClose: () => void }) {
  const { data } = useAcademicData();
  const { profile, user } = useAuth();
  const { termId, terms, activeTerm } = useTermContext();
  const invalidate = useInvalidate();
  const [scope, setScope] = useState<Scope | null>(null);
  const [name, setName] = useState("");
  const [classId, setClassId] = useState("");
  const [streamIds, setStreamIds] = useState<number[]>([]);
  const [gran, setGran] = useState<Granularity>("single");
  const [subjectId, setSubjectId] = useState("");
  const [specific, setSpecific] = useState<number[]>([]);
  const [role, setRole] = useState("0");
  const [weight, setWeight] = useState("0");
  const [due, setDue] = useState("");
  const [term, setTerm] = useState(String(activeTerm?.id ?? termId ?? ""));
  const [busy, setBusy] = useState(false);

  const classSubjectIds = scope === "school" ? data.subjects.map((s) => s.id) : data.classSubjects.filter((cs) => cs.class_id === Number(classId)).map((cs) => cs.subject_id);
  const classStreams = data.classStreams.filter((cs) => cs.class_id === Number(classId)).map((cs) => data.streams.find((s) => s.id === cs.stream_id)!).filter(Boolean);
  const sname = (id: number) => data.subjects.find((s) => s.id === id)?.name;

  async function create() {
    if (!name.trim()) { toast.error("Give the assessment a name."); return; }
    if (data.classes.length === 0) { toast.error("No class exists yet. Create a class under Classes first."); return; }
    if (!term) { toast.error("No term exists yet. Create a term under Term Management first."); return; }
    if (scope !== "school" && !classId) { toast.error("Select a class."); return; }
    if (scope === "stream" && streamIds.length === 0) { toast.error("Select at least one stream for this assessment."); return; }
    const multi = scope === "school" || gran !== "single";
    const subjectIds = scope === "school" ? data.subjects.map((s) => s.id) : gran === "all" ? classSubjectIds : gran === "specific" ? specific : [];
    if (multi && subjectIds.length === 0) { toast.error("A multi-subject assessment needs at least one subject."); return; }
    if (!multi && !subjectId) { toast.error("Select the subject."); return; }
    setBusy(true);
    try {
      let yearId = data.years[0]?.id;
      if (!yearId) {
        const y = due ? new Date(due).getFullYear() : new Date().getFullYear();
        const { data: ins, error } = await supabase.from("academic_years").insert({ name: `${y}-${y + 1}` }).select("id").single();
        if (error) throw error; yearId = ins.id;
      }
      const { data: a, error } = await supabase.from("assessments").insert({
        name: name.trim(), class_id: scope === "school" ? data.classes[0]!.id : Number(classId),
        subject_id: multi ? null : Number(subjectId), academic_year_id: yearId, term_id: Number(term),
        stream_id: scope === "stream" ? streamIds[0] ?? null : null, stream_ids: scope === "stream" ? streamIds : [],
        is_class_wide: scope !== "stream", is_school_wide: scope === "school",
        weight_percent: Number(weight) || 0, due_date: due || null, promotion_role: Number(role),
        author_user_id: user?.id ?? null, author_name: profile?.full_name || user?.email || null,
      }).select("id").single();
      if (error) throw error;
      if (multi) {
        const { error: e2 } = await supabase.from("assessment_subjects").insert(subjectIds.map((sid) => ({ assessment_id: a.id, subject_id: sid })));
        if (e2) throw e2;
      }
      await invalidate("assessments", "assessment_subjects", "academic_years");
      toast.success("Assessment created."); onClose();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>Create assessment</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {([["school", "Entire school"], ["class", "Class"], ["stream", "Stream"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setScope(k)} className={cn("rounded-lg border p-3 text-sm font-medium transition-colors", scope === k ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted")}>
              {scope === k && <CheckCircle2 className="mx-auto mb-1 h-4 w-4" />}{l}
            </button>
          ))}
        </div>
        {scope && (
          <div className="grid gap-4 animate-in fade-in">
            <Field label="Assessment name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mid-term exam" /></Field>
            {scope !== "school" && (
              <Field label="Class"><NativeSelect value={classId} onChange={(v) => { setClassId(v); setStreamIds([]); setSubjectId(""); setSpecific([]); }}><option value="">Select class</option>{data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
            )}
            {scope === "stream" && classId && (
              <Field label="Streams">
                {classStreams.length === 0 ? <p className="text-xs text-muted-foreground">This class has no streams.</p> : (
                  <div className="flex flex-wrap gap-3">{classStreams.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm"><Checkbox checked={streamIds.includes(s.id)} onCheckedChange={(v) => setStreamIds(v ? [...streamIds, s.id] : streamIds.filter((x) => x !== s.id))} />{s.name}</label>
                  ))}</div>
                )}
              </Field>
            )}
            {scope === "school" ? <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Covers every subject in every class.</p> : classId && (
              <>
                <Field label="Subjects">
                  <NativeSelect value={gran} onChange={(v) => setGran(v as Granularity)}>
                    <option value="single">One subject</option><option value="all">All subjects in the class</option><option value="specific">Selected subjects</option>
                  </NativeSelect>
                </Field>
                {gran === "single" && <Field label="Subject"><NativeSelect value={subjectId} onChange={setSubjectId}><option value="">Select subject</option>{classSubjectIds.map((id) => <option key={id} value={id}>{sname(id)}</option>)}</NativeSelect></Field>}
                {gran === "specific" && <div className="flex flex-wrap gap-3">{classSubjectIds.map((id) => <label key={id} className="flex items-center gap-2 text-sm"><Checkbox checked={specific.includes(id)} onCheckedChange={(v) => setSpecific(v ? [...specific, id] : specific.filter((x) => x !== id))} />{sname(id)}</label>)}</div>}
                {classSubjectIds.length === 0 && <p className="text-xs text-warning">This class has no subjects yet — add them under Classes.</p>}
              </>
            )}
            <Field label="Counts toward"><NativeSelect value={role} onChange={setRole}>{PROMOTION_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</NativeSelect></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Weight %"><Input type="number" min={0} max={100} value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
              <Field label="Due date"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
              <Field label="Term"><NativeSelect value={term} onChange={setTerm}>{terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</NativeSelect></Field>
            </div>
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={create} disabled={!scope || busy}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
