import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Printer, Search, Wallet, Target, AlertCircle, Percent } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClasses, useFeePayments, useInvalidate, useSchoolSettings, useStudentCredits, useStudents, useTermFees, type FeePayment, type Student } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { useTermContext } from "@/lib/term-context";
import { availableCredit, expectedFor, feeRegister, overpaymentFor, paidBy } from "@/lib/finance";
import { errMsg, fmtDateTime, ugx } from "@/lib/format";
import { pageHead } from "@/lib/seo";
import { Empty, Field, FilterBar, KpiCard, Loading, NativeSelect, PageHeader, Panel, StatusBadge, Table, Td, Th } from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { PrintArea } from "@/components/reports/PrintArea";

export const Route = createFileRoute("/_app/fees")({
  head: () => pageHead("Fee Collection", "Record fee payments, see each student's balance and print payment slips."),
  component: FeesPage,
});

function FeesPage() {
  const { termId, term } = useTermContext();
  const { data: students = [], isLoading } = useStudents();
  const { data: classes = [] } = useClasses();
  const { data: termFees = [] } = useTermFees();
  const { data: payments = [] } = useFeePayments();
  const { data: credits = [] } = useStudentCredits();
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [pay, setPay] = useState<Student | "pick" | null>(null);
  const [slip, setSlip] = useState<Student | null>(null);

  const rows = useMemo(() => feeRegister({ students, termFees, payments }, termId, Number(classId) || null)
    .filter((r) => (!status || r.status === status) && (!q || `${r.student.full_name} ${r.student.lin}`.toLowerCase().includes(q.toLowerCase()))), [students, termFees, payments, termId, classId, status, q]);
  if (isLoading) return <Loading />;
  const cname = new Map(classes.map((c) => [c.id, c.name]));
  const expected = rows.reduce((p, r) => p + r.expected, 0), collected = rows.reduce((p, r) => p + r.paid, 0);

  return (
    <div>
      <PageHeader title="Fee Collection" subtitle={term?.name ?? "All terms"} actions={<Button onClick={() => setPay("pick")} disabled={!termId}><Plus /> Record payment</Button>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Total expected" value={ugx(expected)} icon={Target} />
        <KpiCard title="Collected" value={ugx(collected)} icon={Wallet} tone="success" />
        <KpiCard title="Outstanding" value={ugx(Math.max(0, expected - collected))} icon={AlertCircle} tone="danger" />
        <KpiCard title="Collection rate" value={`${expected ? ((collected / expected) * 100).toFixed(1) : "0.0"}%`} icon={Percent} tone="finance" />
      </div>
      <FilterBar>
        <Field label="Class"><NativeSelect value={classId} onChange={setClassId}><option value="">All classes</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
        <Field label="Status"><NativeSelect value={status} onChange={setStatus}><option value="">All</option><option>Paid</option><option>Partial</option><option>Unpaid</option><option>N/A</option></NativeSelect></Field>
        <Field label="Search" className="flex-1"><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or LIN" /></div></Field>
      </FilterBar>
      <Panel title="Fee collection register" bodyClassName="p-0">
        {rows.length === 0 ? <Empty title="No students match" /> : (
          <Table>
            <thead><tr><Th>Student</Th><Th>LIN</Th><Th>Class</Th><Th>Expected</Th><Th>Paid</Th><Th>Balance</Th><Th>Credit</Th><Th>Status</Th><Th className="text-right">Action</Th></tr></thead>
            <tbody>{rows.map((r) => { const cr = availableCredit(r.student.id, credits); return (
              <tr key={r.student.id} className="hover:bg-muted/40">
                <Td className="font-medium">{r.student.full_name}</Td><Td className="font-mono text-xs">{r.student.lin}</Td><Td>{r.student.class_id ? cname.get(r.student.class_id) : "—"}</Td>
                <Td>{ugx(r.expected)}</Td><Td className="text-success">{ugx(r.paid)}</Td><Td className={r.balance > 0 ? "font-semibold text-destructive" : ""}>{ugx(r.balance)}</Td>
                <Td>{cr > 0 ? <span className="text-primary">{ugx(cr)}</span> : "—"}</Td><Td><StatusBadge status={r.status} /></Td>
                <Td className="whitespace-nowrap text-right">
                  <Button size="sm" variant="soft" onClick={() => setPay(r.student)} disabled={!termId}>Record</Button>
                  <Button size="sm" variant="ghost" onClick={() => setSlip(r.student)}><Printer /> Slip</Button>
                </Td>
              </tr>
            ); })}</tbody>
          </Table>
        )}
      </Panel>
      {pay && termId && <PaymentDialog initial={pay === "pick" ? null : pay} termId={termId} onClose={() => setPay(null)} onSaved={(s) => setSlip(s)} />}
      {slip && <PrintArea onDone={() => setSlip(null)}><PaymentSlip student={slip} termId={termId} payments={payments.filter((p) => p.student_id === slip.id && (!termId || p.term_id === termId))} expected={expectedFor(slip, termFees, termId)} className={slip.class_id ? cname.get(slip.class_id) ?? "" : ""} termName={term?.name ?? ""} /></PrintArea>}
    </div>
  );
}

function PaymentDialog({ initial, termId, onClose, onSaved }: { initial: Student | null; termId: number; onClose: () => void; onSaved: (s: Student) => void }) {
  const { data: students = [] } = useStudents();
  const { data: termFees = [] } = useTermFees();
  const { data: payments = [] } = useFeePayments();
  const { data: credits = [] } = useStudentCredits();
  const { user } = useAuth();
  const invalidate = useInvalidate();
  const [student, setStudent] = useState<Student | null>(initial);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [printAfter, setPrintAfter] = useState(true);
  const [busy, setBusy] = useState(false);
  const expected = student ? expectedFor(student, termFees, termId) : 0;
  const paid = student ? paidBy(student.id, payments, termId) : 0;

  async function save() {
    if (!student) { toast.error("Choose a student."); return; }
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter an amount greater than zero."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("fee_payments").insert({ student_id: student.id, amount: amt, term_id: termId, recorded_by: user?.id ?? null, description: desc || null });
      if (error) throw error;
      // Carry any overpayment forward as a credit (one open credit per student per term).
      const unapplied = credits.filter((c) => c.student_id === student.id && !c.applied_at && c.from_term_id !== termId).reduce((s, c) => s + c.amount, 0);
      const over = overpaymentFor(expected, paid + amt, unapplied);
      if (over > 0) {
        const open = credits.find((c) => c.student_id === student.id && c.from_term_id === termId && !c.applied_at);
        if (open) await supabase.from("student_credits").update({ amount: over }).eq("id", open.id);
        else await supabase.from("student_credits").insert({ student_id: student.id, from_term_id: termId, amount: over, description: "Overpayment carry-forward" });
      }
      await invalidate("fee_payments", "student_credits");
      toast.success(`Payment of ${ugx(amt)} recorded for ${student.full_name}.`);
      onClose();
      if (printAfter) onSaved(student);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
        {!student ? (
          <Command className="rounded-lg border">
            <CommandInput placeholder="Search student by name or LIN…" />
            <CommandList className="max-h-64">
              <CommandEmpty>No student found.</CommandEmpty>
              {students.filter((s) => s.is_active).map((s) => <CommandItem key={s.id} value={`${s.full_name} ${s.lin}`} onSelect={() => setStudent(s)}>{s.full_name}<span className="ml-2 font-mono text-xs text-muted-foreground">{s.lin}</span></CommandItem>)}
            </CommandList>
          </Command>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
              <div><p className="font-semibold">{student.full_name}</p><p className="text-xs text-muted-foreground">Expected {ugx(expected)} · Paid {ugx(paid)} · Balance {ugx(expected - paid)}</p></div>
              {!initial && <Button size="sm" variant="ghost" onClick={() => setStudent(null)}>Change</Button>}
            </div>
            <Field label="Amount (UGX)"><Input type="number" min={0} autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="Description (optional)"><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Bank slip 00123" /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={printAfter} onChange={(e) => setPrintAfter(e.target.checked)} /> Print payment slip after saving</label>
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={!student || busy}>Save payment</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentSlip({ student, payments, expected, className, termName }: { student: Student; termId: number | null; payments: FeePayment[]; expected: number; className: string; termName: string }) {
  const { data: settings } = useSchoolSettings();
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  return (
    <div className="slip-sheet px-[14mm] py-[12mm] text-[12px]">
      <div className="flex items-start justify-between border-b-2 border-gold pb-3">
        <div><p className="font-serif text-[20px] font-bold uppercase text-navy">{settings?.school_name}</p><p className="text-[11px] text-navy/70">{settings?.school_address} {settings?.school_phone}</p></div>
        <p className="text-[16px] font-extrabold tracking-wider text-navy">FEE PAYMENT SLIP</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <p><b className="text-navy">Student:</b> {student.full_name}</p><p><b className="text-navy">LIN:</b> {student.lin}</p>
        <p><b className="text-navy">Class:</b> {className}</p><p><b className="text-navy">Term:</b> {termName}</p>
      </div>
      <table className="mt-3 w-full border-collapse">
        <thead><tr className="bg-navy text-left text-navy-foreground"><th className="px-2 py-1">Date</th><th className="px-2 py-1">Description</th><th className="px-2 py-1 text-right">Amount</th></tr></thead>
        <tbody>{payments.map((p) => <tr key={p.id} className="border-b border-navy/15"><td className="px-2 py-1">{fmtDateTime(p.payment_date)}</td><td className="px-2 py-1">{p.description || "Fee payment"}</td><td className="px-2 py-1 text-right">{ugx(p.amount)}</td></tr>)}</tbody>
      </table>
      <div className="mt-3 ml-auto w-64 space-y-1 text-right">
        <p>Expected: <b>{ugx(expected)}</b></p><p>Paid: <b>{ugx(paid)}</b></p><p className="text-[14px]">Balance: <b>{ugx(expected - paid)}</b></p>
      </div>
      <div className="mt-10 grid grid-cols-2 gap-10 text-center text-[11px]"><div className="border-t border-navy/50 pt-1">Bursar</div><div className="border-t border-navy/50 pt-1">Parent / guardian</div></div>
    </div>
  );
}
