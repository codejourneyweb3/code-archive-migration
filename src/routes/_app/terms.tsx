import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CalendarCheck2, Users, Wallet, Receipt } from "lucide-react";
import { local } from "@/lib/offline/client";
import { useClasses, useFeePayments, useInvalidate, useStudents, useTermFees, useTerms, type Term } from "@/lib/db";
import { feeRegister } from "@/lib/finance";
import { errMsg, fmtDate, ugx } from "@/lib/format";
import { pageHead } from "@/lib/seo";
import { Empty, Field, KpiCard, Loading, NativeSelect, PageHeader, Panel, Table, Td, Th } from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/terms")({
  head: () => pageHead("Term Management", "Create academic terms, choose the active term and set term fees per class."),
  component: TermsPage,
});

const today = () => new Date().toISOString().slice(0, 10);
const hasEnded = (t: Term) => !!t.end_date && t.end_date < today();

function TermsPage() {
  const { data: terms = [], isLoading } = useTerms();
  const { data: classes = [] } = useClasses();
  const { data: termFees = [] } = useTermFees();
  const { data: students = [] } = useStudents();
  const { data: payments = [] } = useFeePayments();
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState<Term | "new" | null>(null);
  const [feeTerm, setFeeTerm] = useState<string>("");
  const [feeDraft, setFeeDraft] = useState<Record<number, string>>({});

  const selTermId = Number(feeTerm) || terms.find((t) => t.is_active)?.id || terms[terms.length - 1]?.id || null;
  const kpi = useMemo(() => {
    const rows = feeRegister({ students, termFees, payments }, selTermId);
    return { students: rows.length, expected: rows.reduce((p, r) => p + r.expected, 0), collected: rows.reduce((p, r) => p + r.paid, 0) };
  }, [students, termFees, payments, selTermId]);

  if (isLoading) return <Loading />;

  async function activate(t: Term) {
    const { error } = await local.rpc("set_active_term", { _term_id: t.id });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success(`${t.name} is now the active term.`); invalidate("terms");
  }
  async function deactivate(t: Term) {
    const { error } = await local.from("terms").update({ is_active: false }).eq("id", t.id);
    if (error) { toast.error(errMsg(error)); return; }
    invalidate("terms");
  }
  async function remove(t: Term) {
    if (!confirm(`Delete ${t.name}? Fees for this term are removed.`)) return;
    const { error } = await local.from("terms").delete().eq("id", t.id);
    if (error) { toast.error(errMsg(error)); return; }
    invalidate("terms", "term_fees");
  }
  async function setFee(classId: number) {
    if (!selTermId) return;
    const amount = Number(feeDraft[classId]);
    if (isNaN(amount) || amount < 0) { toast.error("Enter a valid amount."); return; }
    const { error } = await local.from("term_fees").upsert({ term_id: selTermId, class_id: classId, amount }, { onConflict: "term_id,class_id" });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Fee saved."); invalidate("term_fees");
  }

  return (
    <div>
      <PageHeader title="Term Management" subtitle="Only one term is active at a time. Enrollment requires an active term."
        actions={<Button onClick={() => setEditing("new")}><Plus /> Create term</Button>} />
      <Panel title="Terms" bodyClassName="p-0" className="mb-6">
        {terms.length === 0 ? <Empty title="No terms yet" hint="Create Term 1 to start recording assessments and fees." /> : (
          <Table>
            <thead><tr><Th>Term</Th><Th>Start</Th><Th>End</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
            <tbody>
              {terms.map((t) => {
                const ended = hasEnded(t);
                return (
                  <tr key={t.id}>
                    <Td className="font-semibold">{t.name}</Td>
                    <Td>{fmtDate(t.start_date)}</Td>
                    <Td>{fmtDate(t.end_date)}</Td>
                    <Td>{t.is_active ? <Badge variant="success">Active</Badge> : ended ? <Badge variant="muted">Ended</Badge> : <Badge variant="outline">Inactive</Badge>}</Td>
                    <Td className="space-x-1 text-right">
                      {!t.is_active && !ended && <Button size="sm" variant="success" onClick={() => activate(t)}><CalendarCheck2 /> Set active</Button>}
                      {t.is_active && !ended && <Button size="sm" variant="outline" onClick={() => deactivate(t)}>Deactivate</Button>}
                      <Button size="icon" variant="ghost" aria-label={`Edit ${t.name}`} onClick={() => setEditing(t)}><Pencil /></Button>
                      <Button size="icon" variant="danger-ghost" aria-label={`Delete ${t.name}`} onClick={() => remove(t)}><Trash2 /></Button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>

      {terms.length > 0 && (
        <Panel title="Term fees by class" actions={
          <NativeSelect value={String(selTermId ?? "")} onChange={setFeeTerm} aria-label="Fee term">
            {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </NativeSelect>}>
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <KpiCard title="Active students" value={kpi.students} icon={Users} />
            <KpiCard title="Expected fees" value={ugx(kpi.expected)} icon={Wallet} tone="finance" />
            <KpiCard title="Collected" value={ugx(kpi.collected)} icon={Receipt} tone="success" />
          </div>
          {classes.length === 0 ? <Empty title="No classes yet" /> : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {classes.map((c) => {
                const current = termFees.find((f) => f.term_id === selTermId && f.class_id === c.id);
                return (
                  <div key={c.id} className="flex items-end gap-2 rounded-lg border p-3">
                    <Field label={`${c.name} — fee amount`} className="flex-1">
                      <Input type="number" min={0} placeholder={current ? String(current.amount) : "0"} value={feeDraft[c.id] ?? ""} onChange={(e) => setFeeDraft({ ...feeDraft, [c.id]: e.target.value })} />
                    </Field>
                    <Button variant="outline" onClick={() => setFee(c.id)}>Set</Button>
                    <span className="pb-2 text-xs text-muted-foreground">{current ? ugx(current.amount) : "not set"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}
      {editing && <TermDialog term={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TermDialog({ term, onClose }: { term: Term | null; onClose: () => void }) {
  const invalidate = useInvalidate();
  const [name, setName] = useState(term?.name ?? "");
  const [start, setStart] = useState(term?.start_date ?? "");
  const [end, setEnd] = useState(term?.end_date ?? "");
  async function save() {
    if (!name.trim()) { toast.error("Name is required."); return; }
    if (start && end && end < start) { toast.error("End date must be after start date."); return; }
    const row = { name: name.trim(), start_date: start || null, end_date: end || null };
    const { error } = term ? await local.from("terms").update(row).eq("id", term.id) : await local.from("terms").insert(row);
    if (error) { toast.error(errMsg(error)); return; }
    invalidate("terms"); onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{term ? "Edit term" : "Create term"}</DialogTitle></DialogHeader>
        <Field label="Term name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Term 1, 2026" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start date"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="End date"><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
