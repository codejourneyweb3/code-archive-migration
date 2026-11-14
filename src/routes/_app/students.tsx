import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { UserPlus, Search, Eye, Pencil, ArrowRightLeft, Ban, RotateCcw, Users, UserCheck, UserX, Upload } from "lucide-react";
import { local } from "@/lib/offline/client";
import { uploadMedia, useAcademicData, useInvalidate, useMediaUrl, type Student } from "@/lib/db";
import { TERMINATION_REASONS, terminationLabel } from "@/lib/academics";
import { errMsg, fmtDate, initials } from "@/lib/format";
import { pageHead } from "@/lib/seo";
import { Empty, Field, FilterBar, KpiCard, Loading, NativeSelect, PageHeader, Panel, Table, Td, Th } from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StudentFields, draftToStudent, studentToDraft } from "@/components/students/StudentForm";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/students")({
  validateSearch: z.object({ q: z.string().optional() }),
  head: () => pageHead("Students", "Student records: enrol, view, edit, shift class, terminate and restore."),
  component: StudentsPage,
});

const dotClass = (s: Student) => !s.is_active ? (s.termination_reason === 3 ? "bg-destructive" : s.termination_reason === 2 ? "bg-warning" : "bg-primary") : "bg-success";

function StudentsPage() {
  const search = Route.useSearch();
  const { data, isLoading } = useAcademicData();
  const invalidate = useInvalidate();
  const [q, setQ] = useState(search.q ?? "");
  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [status, setStatus] = useState("active");
  const [view, setView] = useState<Student | null>(null);
  const [edit, setEdit] = useState<Student | null>(null);
  const [shift, setShift] = useState<Student | null>(null);
  const [term, setTerm] = useState<Student | null>(null);

  const cname = useMemo(() => new Map(data.classes.map((c) => [c.id, c.name])), [data.classes]);
  const sname = useMemo(() => new Map(data.streams.map((s) => [s.id, s.name])), [data.streams]);
  const list = data.students.filter((s) =>
    (status === "all" || (status === "active" ? s.is_active : !s.is_active)) &&
    (!classId || s.class_id === Number(classId)) && (!streamId || s.stream_id === Number(streamId)) &&
    (!q || `${s.full_name} ${s.lin}`.toLowerCase().includes(q.toLowerCase())));

  if (isLoading) return <Loading />;
  const active = data.students.filter((s) => s.is_active);

  async function restore(s: Student) {
    const { error } = await local.from("students").update({ is_active: true, termination_reason: 0, termination_date: null }).eq("id", s.id);
    if (error) { toast.error(error.message.includes("students_active_lin_unique") ? `Another active student already uses LIN ${s.lin}.` : errMsg(error)); return; }
    toast.success(`${s.full_name} restored.`); invalidate("students");
  }

  return (
    <div>
      <PageHeader title="Students" subtitle="Overview of student records" actions={<Button asChild><Link to="/enrollment"><UserPlus /> Add student</Link></Button>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Active students" value={active.length} icon={Users} />
        <KpiCard title="Boys" value={active.filter((s) => s.gender === "Male").length} icon={UserCheck} tone="success" />
        <KpiCard title="Girls" value={active.filter((s) => s.gender === "Female").length} icon={UserCheck} tone="insight" />
        <KpiCard title="Inactive" value={data.students.length - active.length} icon={UserX} tone="danger" />
      </div>
      <FilterBar>
        <Field label="Class"><NativeSelect value={classId} onChange={(v) => { setClassId(v); setStreamId(""); }}><option value="">All classes</option>{data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
        <Field label="Stream"><NativeSelect value={streamId} onChange={setStreamId}><option value="">All streams</option>{(classId ? data.classStreams.filter((cs) => cs.class_id === Number(classId)).map((cs) => data.streams.find((s) => s.id === cs.stream_id)!) : data.streams).filter(Boolean).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect></Field>
        <Field label="Status"><NativeSelect value={status} onChange={setStatus}><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option></NativeSelect></Field>
        <div className="w-6" />
        <Field label="Search" className="min-w-[240px] flex-1"><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Name or LIN" value={q} onChange={(e) => setQ(e.target.value)} /></div></Field>
      </FilterBar>
      <Panel bodyClassName="p-0" title={`${list.length} student${list.length === 1 ? "" : "s"}`}>
        {list.length === 0 ? <Empty title="No students match" hint="Adjust the filters or enrol a new student." /> : (
          <Table>
            <thead><tr><Th>Status</Th><Th>Student</Th><Th>LIN</Th><Th>Class / stream</Th><Th>Gender</Th><Th>Guardian</Th><Th className="text-right">Actions</Th></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="hover:bg-muted/40">
                  <Td>
                    <div className="flex items-center gap-2"><span className={cn("h-2.5 w-2.5 rounded-full", dotClass(s))} /><span className="text-xs font-medium">{s.is_active ? "Active" : "Inactive"}</span></div>
                    {!s.is_active && <p className="ml-4 text-[11px] text-muted-foreground">{terminationLabel(s.termination_reason)}{s.termination_date ? ` · ${new Date(s.termination_date).getFullYear()}` : ""}</p>}
                  </Td>
                  <Td className="font-semibold">{s.full_name}</Td>
                  <Td className="font-mono text-xs">{s.lin}</Td>
                  <Td>{s.class_id ? cname.get(s.class_id) : "—"}{s.stream_id ? ` · ${sname.get(s.stream_id)}` : ""}</Td>
                  <Td>{s.gender || "—"}</Td>
                  <Td><p>{s.guardian_name || "—"}</p><p className="text-xs text-muted-foreground">{s.guardian_phone}</p></Td>
                  <Td className="whitespace-nowrap text-right">
                    {s.is_active ? <>
                      <Button size="sm" variant="ghost" onClick={() => setShift(s)}><ArrowRightLeft /> Shift</Button>
                      <Button size="sm" variant="ghost" onClick={() => setView(s)}><Eye /> View</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEdit(s)}><Pencil /> Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => setTerm(s)}><Ban /> Terminate</Button>
                    </> : <Button size="sm" onClick={() => restore(s)}><RotateCcw /> Restore</Button>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      {view && <ViewDialog s={view} onClose={() => setView(null)} cname={cname} sname={sname} />}
      {edit && <EditDialog s={edit} onClose={() => setEdit(null)} />}
      {shift && <ShiftDialog s={shift} onClose={() => setShift(null)} />}
      {term && <TerminateDialog s={term} onClose={() => setTerm(null)} />}
    </div>
  );
}

function ViewDialog({ s, onClose, cname, sname }: { s: Student; onClose: () => void; cname: Map<number, string>; sname: Map<number, string> }) {
  const { data: photo } = useMediaUrl(s.photo_path);
  const rows: [string, string | null | undefined][] = [
    ["LIN", s.lin], ["Class", s.class_id ? cname.get(s.class_id) : null], ["Stream", s.stream_id ? sname.get(s.stream_id) : null],
    ["Date of birth", fmtDate(s.date_of_birth)], ["Gender", s.gender], ["Enrolled", fmtDate(s.created_at)],
    ["Guardian", s.guardian_name], ["Relationship", s.guardian_relationship], ["Guardian phone", s.guardian_phone], ["Guardian email", s.guardian_email], ["Address", s.guardian_address],
    ["Custody documents", s.has_custody_documents ? "On file" : "No"], ["Proof of residence", s.residence_proof_type], ["District", s.residence_district], ["Zone / village", s.residence_zone],
    ["Immunization card", s.has_immunization_card ? "On file" : "No"], ["Medical report", s.has_medical_exam_report ? "On file" : "No"], ["Allergies / conditions", s.allergies_or_conditions], ["Health insurance", s.health_insurance],
    ["Emergency contact", s.emergency_name], ["Emergency relationship", s.emergency_relationship], ["Emergency phone", s.emergency_phone], ["Authorized pickup", s.authorized_pickup_person],
  ];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Student details</DialogTitle></DialogHeader>
        <div className="flex items-center gap-4">
          <div className="flex h-24 w-20 items-center justify-center overflow-hidden rounded-lg border bg-muted text-lg font-bold text-muted-foreground">
            {photo ? <img src={photo} alt={s.full_name} className="h-full w-full object-cover" /> : initials(s.full_name)}
          </div>
          <div><p className="text-lg font-semibold">{s.full_name}</p><p className="text-sm text-muted-foreground">{s.is_active ? "Active" : `Inactive — ${terminationLabel(s.termination_reason)}`}</p></div>
        </div>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-sm">{v || "—"}</dd></div>)}
        </dl>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ s, onClose }: { s: Student; onClose: () => void }) {
  const { data } = useAcademicData();
  const invalidate = useInvalidate();
  const [d, setD] = useState(studentToDraft(s as unknown as Record<string, unknown>));
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!d.full_name.trim() || !d.lin.trim()) { toast.error("Name and LIN are required."); return; }
    if (data.students.some((x) => x.id !== s.id && x.is_active && x.lin.toLowerCase() === d.lin.trim().toLowerCase())) { toast.error("That LIN belongs to another active student."); return; }
    setBusy(true);
    try {
      const photo_path = photo ? await uploadMedia("students", photo) : s.photo_path;
      const { error } = await local.from("students").update({ ...draftToStudent(d), photo_path }).eq("id", s.id);
      if (error) throw error;
      toast.success("Student updated."); invalidate("students"); onClose();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>Edit {s.full_name}</DialogTitle></DialogHeader>
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"><Upload className="h-4 w-4" />{photo ? photo.name : "Replace photo"}<input type="file" accept="image/*" hidden onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></label>
        <StudentFields d={d} setD={setD} data={data} />
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>Save changes</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShiftDialog({ s, onClose }: { s: Student; onClose: () => void }) {
  const { data } = useAcademicData();
  const invalidate = useInvalidate();
  const [classId, setClassId] = useState(s.class_id ? String(s.class_id) : "");
  const [streamId, setStreamId] = useState(s.stream_id ? String(s.stream_id) : "");
  const streams = data.classStreams.filter((cs) => cs.class_id === Number(classId)).map((cs) => data.streams.find((x) => x.id === cs.stream_id)!).filter(Boolean);
  async function save() {
    if (!classId) { toast.error("Choose a class."); return; }
    const changedClass = Number(classId) !== s.class_id;
    const { error } = await local.from("students").update({
      class_id: Number(classId), stream_id: streamId ? Number(streamId) : null,
      ...(changedClass ? { promotion_status: 3, promoted_to_class_id: Number(classId), promotion_processed_at: new Date().toISOString() } : {}),
    }).eq("id", s.id);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success(`${s.full_name} moved.`); invalidate("students"); onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Shift {s.full_name}</DialogTitle></DialogHeader>
        <Field label="Class"><NativeSelect value={classId} onChange={(v) => { setClassId(v); setStreamId(""); }}><option value="">Select</option>{data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
        <Field label="Stream"><NativeSelect value={streamId} onChange={setStreamId}><option value="">No stream</option>{streams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</NativeSelect></Field>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Shift</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TerminateDialog({ s, onClose }: { s: Student; onClose: () => void }) {
  const invalidate = useInvalidate();
  const [reason, setReason] = useState("1");
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    const date = new Date().toISOString().slice(0, 10);
    const { error } = await local.from("students").update({ is_active: false, termination_reason: Number(reason), termination_date: date }).eq("id", s.id);
    if (!error) await local.from("termination_logs").insert({ student_id: s.id, student_name_at_termination: s.full_name, termination_reason: Number(reason), termination_date: date });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success(`${s.full_name} marked inactive.`); invalidate("students", "termination_logs"); onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Terminate {s.full_name}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">The record is kept and can be restored later.</p>
        <Field label="Reason"><NativeSelect value={reason} onChange={setReason}>{TERMINATION_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</NativeSelect></Field>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="destructive" onClick={run} disabled={busy}>Terminate</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
