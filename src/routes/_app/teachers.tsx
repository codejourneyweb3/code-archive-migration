import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { local } from "@/lib/offline/client";
import { useInvalidate, useTeachers, type Teacher } from "@/lib/db";
import { errMsg } from "@/lib/format";
import { pageHead } from "@/lib/seo";
import { Empty, Field, Loading, PageHeader, Panel, Table, Td, Th } from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/teachers")({
  head: () => pageHead("Teachers", "Register teachers with their subjects, classes and next of kin."),
  component: TeachersPage,
});

function TeachersPage() {
  const { data: teachers = [], isLoading } = useTeachers();
  const invalidate = useInvalidate();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Teacher | "new" | null>(null);
  if (isLoading) return <Loading />;
  const list = teachers.filter((t) => `${t.full_name} ${t.email ?? ""} ${t.subjects_taught ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  async function remove(t: Teacher) {
    if (!confirm(`Remove ${t.full_name}?`)) return;
    const { error } = await local.from("teachers").delete().eq("id", t.id);
    if (error) { toast.error(errMsg(error)); return; }
    invalidate("teachers", "classes");
  }

  return (
    <div>
      <PageHeader title="Teachers" subtitle={`${teachers.length} registered`} actions={<Button onClick={() => setEditing("new")}><Plus /> Add teacher</Button>} />
      <Panel bodyClassName="p-0" title={<div className="relative w-72"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Search teachers…" value={q} onChange={(e) => setQ(e.target.value)} /></div>}>
        {list.length === 0 ? <Empty title="No teachers found" /> : (
          <Table>
            <thead><tr><Th>Name</Th><Th>Contact</Th><Th>Subjects</Th><Th>Classes</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className="hover:bg-muted/40">
                  <Td className="font-semibold">{t.full_name}</Td>
                  <Td><p>{t.phone || "—"}</p><p className="text-xs text-muted-foreground">{t.email}</p></Td>
                  <Td className="max-w-[220px]">{t.subjects_taught || "—"}</Td>
                  <Td>{t.classes_taught || "—"}</Td>
                  <Td className="space-x-1">{t.is_registered_teacher && <Badge variant="success">Registered</Badge>}{t.is_student_teacher && <Badge variant="warning">Student teacher</Badge>}</Td>
                  <Td className="text-right">
                    <Button size="icon" variant="ghost" aria-label={`Edit ${t.full_name}`} onClick={() => setEditing(t)}><Pencil /></Button>
                    <Button size="icon" variant="danger-ghost" aria-label={`Delete ${t.full_name}`} onClick={() => remove(t)}><Trash2 /></Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      {editing && <TeacherDialog teacher={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TeacherDialog({ teacher, onClose }: { teacher: Teacher | null; onClose: () => void }) {
  const invalidate = useInvalidate();
  const [f, setF] = useState({
    full_name: teacher?.full_name ?? "", email: teacher?.email ?? "", phone: teacher?.phone ?? "",
    subjects_taught: teacher?.subjects_taught ?? "", classes_taught: teacher?.classes_taught ?? "",
    next_of_kin_name: teacher?.next_of_kin_name ?? "", next_of_kin_relationship: teacher?.next_of_kin_relationship ?? "",
    next_of_kin_phone: teacher?.next_of_kin_phone ?? "", previous_schools: teacher?.previous_schools ?? "",
    is_registered_teacher: teacher?.is_registered_teacher ?? false, is_student_teacher: teacher?.is_student_teacher ?? false,
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  async function save() {
    if (!f.full_name.trim()) { toast.error("Full name is required."); return; }
    const { error } = teacher ? await local.from("teachers").update(f).eq("id", teacher.id) : await local.from("teachers").insert(f);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Teacher saved."); invalidate("teachers"); onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{teacher ? "Edit teacher" : "Register teacher"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" className="sm:col-span-2"><Input value={f.full_name} onChange={set("full_name")} /></Field>
          <Field label="Email"><Input type="email" value={f.email} onChange={set("email")} /></Field>
          <Field label="Phone"><Input value={f.phone} onChange={set("phone")} /></Field>
          <Field label="Subjects taught (comma separated)"><Input value={f.subjects_taught} onChange={set("subjects_taught")} /></Field>
          <Field label="Classes taught (comma separated)"><Input value={f.classes_taught} onChange={set("classes_taught")} /></Field>
          <Field label="Next of kin"><Input value={f.next_of_kin_name} onChange={set("next_of_kin_name")} /></Field>
          <Field label="Relationship"><Input value={f.next_of_kin_relationship} onChange={set("next_of_kin_relationship")} /></Field>
          <Field label="Next of kin phone"><Input value={f.next_of_kin_phone} onChange={set("next_of_kin_phone")} /></Field>
          <Field label="Previous schools (comma separated)"><Input value={f.previous_schools} onChange={set("previous_schools")} /></Field>
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2"><Checkbox checked={f.is_registered_teacher} onCheckedChange={(v) => setF({ ...f, is_registered_teacher: !!v })} /> Registered with the teachers' board</label>
          <label className="flex items-center gap-2"><Checkbox checked={f.is_student_teacher} onCheckedChange={(v) => setF({ ...f, is_student_teacher: !!v })} /> Student teacher</label>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
