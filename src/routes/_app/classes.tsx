import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Star } from "lucide-react";
import { local } from "@/lib/offline/client";
import {
  useAcademicData, useInvalidate, useTeachers, type ClassRow, type GradingSystem,
} from "@/lib/db";
import { errMsg } from "@/lib/format";
import { pageHead } from "@/lib/seo";
import { Empty, Field, Loading, NativeSelect, PageHeader, Panel, Table, Td, Th } from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/classes")({
  head: () => pageHead("Classes", "Set up grading systems, classes, streams and subjects."),
  component: ClassesPage,
});

function ClassesPage() {
  const { data, isLoading } = useAcademicData();
  const { data: teachers = [] } = useTeachers();
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState<ClassRow | "new" | null>(null);
  const [gsOpen, setGsOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; body: string; run: () => Promise<void> } | null>(null);

  if (isLoading) return <Loading />;
  const tname = new Map(teachers.map((t) => [t.id, t.full_name]));
  const gname = new Map(data.gradingSystems.map((g) => [g.id, g.name]));

  async function setDefault(g: GradingSystem) {
    await local.from("grading_systems").update({ is_default: false }).neq("id", g.id);
    const { error } = await local.from("grading_systems").update({ is_default: true }).eq("id", g.id);
    if (error) { toast.error(errMsg(error)); return; }
    invalidate("grading_systems");
  }

  return (
    <div>
      <PageHeader title="Classes" subtitle="Grading systems, classes, streams and subjects."
        actions={<>
          <Button variant="outline" onClick={() => setGsOpen(true)}><Plus /> Grading system</Button>
          <Button onClick={() => data.gradingSystems.length === 0 ? (toast.info("Create a grading system first."), setGsOpen(true)) : setEditing("new")}><Plus /> New class</Button>
        </>} />

      <Panel title="Grading systems" className="mb-6">
        {data.gradingSystems.length === 0 ? <Empty title="No grading systems yet" hint="A grading system defines grade bands (e.g. A: 80–100) and the pass mark used for promotion." /> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.gradingSystems.map((g) => {
              const bands = data.gradeBands.filter((b) => b.grading_system_id === g.id).sort((a, b) => b.min_score - a.min_score);
              return (
                <div key={g.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{g.name} {g.is_default && <Badge variant="info" className="ml-1">Default</Badge>}</p>
                      <p className="text-xs text-muted-foreground">Pass mark {g.pass_mark}%</p>
                    </div>
                    <div className="flex gap-1">
                      {!g.is_default && <Button size="icon" variant="ghost" aria-label="Make default" onClick={() => setDefault(g)}><Star /></Button>}
                      <Button size="icon" variant="danger-ghost" aria-label="Delete grading system" onClick={() => setConfirm({ title: `Delete ${g.name}?`, body: "Classes using it fall back to the school default.", run: async () => { const { error } = await local.from("grading_systems").delete().eq("id", g.id); if (error) throw error; await invalidate("grading_systems", "grade_bands", "classes"); } })}><Trash2 /></Button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {bands.map((b) => (
                      <span key={b.id} className={`rounded-md px-2 py-0.5 text-xs font-medium ${b.is_promotional_pass ? "bg-success/12 text-success" : b.is_repeater ? "bg-warning/18 text-warning-foreground" : "bg-destructive/10 text-destructive"}`}>
                        {b.label} - {b.min_score}-{b.max_score}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title={`Classes (${data.classes.length})`} bodyClassName="p-0">
        {data.classes.length === 0 ? <Empty title="No classes yet" hint="Create your first class, then add streams and subjects." /> : (
          <Table>
            <thead><tr><Th>Class</Th><Th>Class teacher</Th><Th>Grading system</Th><Th>Streams</Th><Th>Subjects</Th><Th>Students</Th><Th className="text-right">Actions</Th></tr></thead>
            <tbody>
              {data.classes.map((c) => {
                const streams = data.classStreams.filter((cs) => cs.class_id === c.id).map((cs) => data.streams.find((s) => s.id === cs.stream_id)?.name).filter(Boolean);
                const subjects = data.classSubjects.filter((cs) => cs.class_id === c.id).map((cs) => data.subjects.find((s) => s.id === cs.subject_id)?.name).filter(Boolean);
                return (
                  <tr key={c.id} className="hover:bg-muted/40">
                    <Td className="font-semibold">{c.name}</Td>
                    <Td>{c.class_teacher_id ? tname.get(c.class_teacher_id) : <span className="text-muted-foreground">—</span>}</Td>
                    <Td>{c.grading_system_id ? gname.get(c.grading_system_id) : <span className="text-muted-foreground">School default</span>}</Td>
                    <Td><div className="flex flex-wrap gap-1">{streams.map((s) => <Badge key={s} variant="muted">{s}</Badge>)}</div></Td>
                    <Td className="max-w-xs"><div className="flex flex-wrap gap-1">{subjects.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}</div></Td>
                    <Td>{data.students.filter((s) => s.class_id === c.id && s.is_active).length}</Td>
                    <Td className="text-right">
                      <Button size="icon" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}><Pencil /></Button>
                      <Button size="icon" variant="danger-ghost" aria-label={`Delete ${c.name}`} onClick={() => setConfirm({ title: `Delete ${c.name}?`, body: "Its assessments and marks are deleted; students are left without a class.", run: async () => { const { error } = await local.from("classes").delete().eq("id", c.id); if (error) throw error; await invalidate("classes", "class_streams", "class_subjects", "assessments", "marks", "students"); } })}><Trash2 /></Button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>

      {editing && <ClassDialog cls={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {gsOpen && <GradingSystemDialog onClose={() => setGsOpen(false)} />}
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{confirm?.title}</AlertDialogTitle><AlertDialogDescription>{confirm?.body}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => { try { await confirm?.run(); toast.success("Deleted."); } catch (e) { toast.error(errMsg(e)); } setConfirm(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClassDialog({ cls, onClose }: { cls: ClassRow | null; onClose: () => void }) {
  const { data } = useAcademicData();
  const { data: teachers = [] } = useTeachers();
  const invalidate = useInvalidate();
  const [name, setName] = useState(cls?.name ?? "");
  const [teacherId, setTeacherId] = useState(cls?.class_teacher_id ? String(cls.class_teacher_id) : "");
  const [gsId, setGsId] = useState(cls?.grading_system_id ? String(cls.grading_system_id) : String(data.gradingSystems.find((g) => g.is_default)?.id ?? ""));
  const [classId, setClassId] = useState<number | null>(cls?.id ?? null);
  const [newStream, setNewStream] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [busy, setBusy] = useState(false);

  const streams = classId ? data.classStreams.filter((cs) => cs.class_id === classId).map((cs) => data.streams.find((s) => s.id === cs.stream_id)!).filter(Boolean) : [];
  const subjects = classId ? data.classSubjects.filter((cs) => cs.class_id === classId).map((cs) => data.subjects.find((s) => s.id === cs.subject_id)!).filter(Boolean) : [];

  async function save(close: boolean) {
    if (!name.trim()) { toast.error("Class name is required."); return null; }
    setBusy(true);
    try {
      const row = { name: name.trim(), class_teacher_id: teacherId ? Number(teacherId) : null, grading_system_id: gsId ? Number(gsId) : null };
      let id = classId;
      if (id) { const { error } = await local.from("classes").update(row).eq("id", id); if (error) throw error; }
      else { const { data: ins, error } = await local.from("classes").insert(row).select("id").single(); if (error) throw error; id = ins.id; setClassId(id); }
      await invalidate("classes");
      if (close) { toast.success("Class saved."); onClose(); }
      return id;
    } catch (e) { toast.error(errMsg(e)); return null; } finally { setBusy(false); }
  }

  async function addStream() {
    const n = newStream.trim(); if (!n) return;
    const id = classId ?? (await save(false)); if (!id) return;
    let stream = data.streams.find((s) => s.name.toLowerCase() === n.toLowerCase());
    if (!stream) { const { data: ins, error } = await local.from("streams").insert({ name: n }).select("*").single(); if (error) { toast.error(errMsg(error)); return; } stream = ins; }
    const { error } = await local.from("class_streams").upsert({ class_id: id, stream_id: stream.id });
    if (error) { toast.error(errMsg(error)); return; }
    setNewStream(""); invalidate("streams", "class_streams");
  }
  async function addSubject() {
    const n = newSubject.trim(); if (!n) return;
    const id = classId ?? (await save(false)); if (!id) return;
    let subj = data.subjects.find((s) => s.name.toLowerCase() === n.toLowerCase());
    if (!subj) { const { data: ins, error } = await local.from("subjects").insert({ name: n }).select("*").single(); if (error) { toast.error(errMsg(error)); return; } subj = ins; }
    const { error } = await local.from("class_subjects").upsert({ class_id: id, subject_id: subj.id });
    if (error) { toast.error(errMsg(error)); return; }
    setNewSubject(""); invalidate("subjects", "class_subjects");
  }
  async function removeStream(sid: number) { await local.from("class_streams").delete().eq("class_id", classId!).eq("stream_id", sid); invalidate("class_streams"); }
  async function removeSubject(sid: number) { await local.from("class_subjects").delete().eq("class_id", classId!).eq("subject_id", sid); invalidate("class_subjects"); }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{cls ? `Edit ${cls.name}` : "New class"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <Field label="Class name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. P5 or S.3" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Class teacher">
              <NativeSelect value={teacherId} onChange={setTeacherId}><option value="">None</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}</NativeSelect>
            </Field>
            <Field label="Grading system">
              <NativeSelect value={gsId} onChange={setGsId}><option value="">School default</option>{data.gradingSystems.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</NativeSelect>
            </Field>
          </div>
          <Field label="Streams">
            <div className="flex flex-wrap gap-1.5">{streams.map((s) => <Chip key={s.id} label={s.name} onRemove={() => removeStream(s.id)} />)}</div>
            <div className="flex gap-2">
              <Input list="stream-names" value={newStream} onChange={(e) => setNewStream(e.target.value)} placeholder="e.g. Blue" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStream())} />
              <datalist id="stream-names">{data.streams.map((s) => <option key={s.id} value={s.name} />)}</datalist>
              <Button type="button" variant="outline" onClick={addStream}>Add</Button>
            </div>
          </Field>
          <Field label="Subjects">
            <div className="flex flex-wrap gap-1.5">{subjects.map((s) => <Chip key={s.id} label={s.name} onRemove={() => removeSubject(s.id)} />)}</div>
            <div className="flex gap-2">
              <Input list="subject-names" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="e.g. Mathematics" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSubject())} />
              <datalist id="subject-names">{data.subjects.map((s) => <option key={s.id} value={s.name} />)}</datalist>
              <Button type="button" variant="outline" onClick={addSubject}>Add</Button>
            </div>
          </Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={() => save(true)} disabled={busy}>Save class</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-0.5 text-xs font-medium">
      {label}<button type="button" aria-label={`Remove ${label}`} onClick={onRemove} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
    </span>
  );
}

interface BandDraft { label: string; min: string; max: string; kind: "pass" | "repeat" | "fail" }
const DEFAULT_BANDS: BandDraft[] = [
  { label: "A", min: "80", max: "100", kind: "pass" }, { label: "B", min: "70", max: "79", kind: "pass" },
  { label: "C", min: "60", max: "69", kind: "pass" }, { label: "D", min: "50", max: "59", kind: "pass" },
  { label: "E", min: "40", max: "49", kind: "repeat" }, { label: "F", min: "0", max: "39", kind: "fail" },
];

function GradingSystemDialog({ onClose }: { onClose: () => void }) {
  const { data } = useAcademicData();
  const invalidate = useInvalidate();
  const [name, setName] = useState("");
  const [passMark, setPassMark] = useState("50");
  const [isDefault, setIsDefault] = useState(data.gradingSystems.length === 0);
  const [bands, setBands] = useState<BandDraft[]>(DEFAULT_BANDS);
  const [busy, setBusy] = useState(false);
  const upd = (i: number, p: Partial<BandDraft>) => setBands(bands.map((b, k) => (k === i ? { ...b, ...p } : b)));

  async function save() {
    if (!name.trim()) { toast.error("Name is required."); return; }
    const clean = bands.filter((b) => b.label.trim());
    for (const b of clean) if (isNaN(Number(b.min)) || isNaN(Number(b.max)) || Number(b.min) > Number(b.max)) { toast.error(`Band ${b.label}: invalid range.`); return; }
    setBusy(true);
    try {
      if (isDefault) await local.from("grading_systems").update({ is_default: false }).neq("id", 0);
      const { data: gs, error } = await local.from("grading_systems").insert({ name: name.trim(), pass_mark: Number(passMark) || 50, is_default: isDefault }).select("id").single();
      if (error) throw error;
      if (clean.length) {
        const { error: e2 } = await local.from("grade_bands").insert(clean.map((b) => ({
          grading_system_id: gs.id, label: b.label.trim(), min_score: Number(b.min), max_score: Number(b.max),
          is_promotional_pass: b.kind === "pass", is_repeater: b.kind === "repeat", is_promotional_fail: b.kind === "fail",
        })));
        if (e2) throw e2;
      }
      await invalidate("grading_systems", "grade_bands");
      toast.success("Grading system created.");
      onClose();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>New grading system</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Primary Standard" /></Field>
          <Field label="Pass mark (%)"><Input type="number" value={passMark} onChange={(e) => setPassMark(e.target.value)} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={isDefault} onCheckedChange={(v) => setIsDefault(!!v)} /> School default</label>
        <div className="rounded-lg border">
          <div className="grid grid-cols-[1fr_90px_90px_150px_36px] gap-2 border-b bg-muted/50 px-3 py-2 table-head"><span>Grade</span><span>Min</span><span>Max</span><span>Promotion</span><span /></div>
          {bands.map((b, i) => (
            <div key={i} className="grid grid-cols-[1fr_90px_90px_150px_36px] items-center gap-2 border-b px-3 py-2 last:border-0">
              <Input value={b.label} onChange={(e) => upd(i, { label: e.target.value })} />
              <Input type="number" value={b.min} onChange={(e) => upd(i, { min: e.target.value })} />
              <Input type="number" value={b.max} onChange={(e) => upd(i, { max: e.target.value })} />
              <NativeSelect value={b.kind} onChange={(v) => upd(i, { kind: v as BandDraft["kind"] })}>
                <option value="pass">Pass (promote)</option><option value="repeat">Repeat</option><option value="fail">Fail</option>
              </NativeSelect>
              <Button size="icon" variant="danger-ghost" aria-label="Remove band" onClick={() => setBands(bands.filter((_, k) => k !== i))}><X /></Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-fit" onClick={() => setBands([...bands, { label: "", min: "0", max: "0", kind: "pass" }])}><Plus /> Add band</Button>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
