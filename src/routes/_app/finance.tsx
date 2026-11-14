import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Wallet, Target, AlertCircle, Percent, Users, Clock, XCircle, Receipt } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useBudgetLines, useClasses, useFeePayments, useStudents, useTermFees, useTerms } from "@/lib/db";
import { useTermContext } from "@/lib/term-context";
import { cohortSummaries, feeRegister } from "@/lib/finance";
import { fmtDate, ugx } from "@/lib/format";
import { pageHead } from "@/lib/seo";
import { Empty, KpiCard, Loading, PageHeader, Panel, StatusBadge, Table, Td, Th } from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/finance")({
  head: () => pageHead("Financial Dashboard", "Fees collected, expected and outstanding by term and class."),
  component: FinancePage,
});

const PIE = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

function FinancePage() {
  const { termId, term } = useTermContext();
  const { data: students = [], isLoading } = useStudents();
  const { data: termFees = [] } = useTermFees();
  const { data: payments = [] } = useFeePayments();
  const { data: classes = [] } = useClasses();
  const { data: budget = [] } = useBudgetLines();
  const { data: terms = [] } = useTerms();

  const m = useMemo(() => {
    const reg = feeRegister({ students, termFees, payments }, termId);
    const expected = reg.reduce((p, r) => p + r.expected, 0);
    const collected = payments.filter((p) => !termId || p.term_id === termId).reduce((s, p) => s + p.amount, 0);
    const cohorts = cohortSummaries({ students, termFees, payments }, classes, termId).slice(1);
    return {
      reg, expected, collected, outstanding: Math.max(0, expected - reg.reduce((p, r) => p + Math.min(r.paid, r.expected), 0)),
      partial: reg.filter((r) => r.status === "Partial").length, unpaid: reg.filter((r) => r.status === "Unpaid").length,
      count: payments.filter((p) => !termId || p.term_id === termId).length,
      byClass: cohorts.map((c) => ({ name: c.label, Collected: c.collected, Outstanding: Math.max(0, c.expected - c.collected) })),
    };
  }, [students, termFees, payments, classes, termId]);

  if (isLoading) return <Loading />;
  const sname = new Map(students.map((s) => [s.id, s]));
  const cname = new Map(classes.map((c) => [c.id, c.name]));
  const tname = new Map(terms.map((t) => [t.id, t.name]));
  const recent = payments.filter((p) => !termId || p.term_id === termId).slice().sort((a, b) => b.payment_date.localeCompare(a.payment_date)).slice(0, 10);
  const rate = m.expected ? (m.collected / m.expected) * 100 : 0;
  const budgetData = budget.map((b) => ({ name: b.category, value: b.budgeted })).filter((b) => b.value > 0);
  const tip = { background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 };

  return (
    <div>
      <PageHeader title="Financial Dashboard" subtitle={term?.name ?? "All terms"} actions={<Button variant="outline" asChild><Link to="/defaulters">View defaulters</Link></Button>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Total collected" value={ugx(m.collected)} subtitle="Payments received" icon={Wallet} tone="success" />
        <KpiCard title="Total expected" value={ugx(m.expected)} subtitle="Based on term fees" icon={Target} />
        <KpiCard title="Outstanding fees" value={ugx(m.outstanding)} subtitle="Unpaid balance" icon={AlertCircle} tone="danger" />
        <KpiCard title="Collection rate" value={`${rate.toFixed(1)}%`} subtitle="Of expected fees" icon={Percent} tone="finance" />
        <KpiCard title="Active students" value={m.reg.length} icon={Users} />
        <KpiCard title="Partial payments" value={m.partial} icon={Clock} tone="warning" />
        <KpiCard title="Unpaid" value={m.unpaid} icon={XCircle} tone="danger" />
        <KpiCard title="Total payments" value={m.count} icon={Receipt} tone="insight" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Fee collection by class" className="xl:col-span-2">
          {m.byClass.length === 0 ? <Empty title="No fee data yet" hint="Set term fees under Term Management." /> : (
            <div className="h-72"><ResponsiveContainer><BarChart data={m.byClass}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} /><Tooltip contentStyle={tip} formatter={(v: number) => ugx(v)} /><Legend /><Bar dataKey="Collected" stackId="a" fill="var(--color-success)" /><Bar dataKey="Outstanding" stackId="a" fill="var(--color-destructive)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
          )}
        </Panel>
        <Panel title="Budget breakdown">
          {budgetData.length === 0 ? <Empty title="No budget lines" /> : (
            <div className="h-72"><ResponsiveContainer><PieChart><Pie data={budgetData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>{budgetData.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip contentStyle={tip} formatter={(v: number) => ugx(v)} /><Legend /></PieChart></ResponsiveContainer></div>
          )}
        </Panel>
      </div>
      <Panel title="Recent transactions" bodyClassName="p-0" className="mt-6">
        {recent.length === 0 ? <Empty title="No payments recorded" /> : (
          <Table>
            <thead><tr><Th>Student</Th><Th>Class</Th><Th>Term</Th><Th>Amount</Th><Th>Date</Th><Th>Status</Th></tr></thead>
            <tbody>{recent.map((p) => { const s = sname.get(p.student_id); const r = m.reg.find((x) => x.student.id === p.student_id); return (
              <tr key={p.id}><Td className="font-medium">{s?.full_name ?? "—"}</Td><Td>{s?.class_id ? cname.get(s.class_id) : "—"}</Td><Td>{p.term_id ? tname.get(p.term_id) : "—"}</Td><Td className="font-semibold">{ugx(p.amount)}</Td><Td>{fmtDate(p.payment_date)}</Td><Td><StatusBadge status={r?.status ?? "N/A"} /></Td></tr>
            ); })}</tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
