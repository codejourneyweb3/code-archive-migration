import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useClasses, useFeePayments, useStudents, useTermFees } from "@/lib/db";
import { useTermContext } from "@/lib/term-context";
import { cohortSummaries, defaulters } from "@/lib/finance";
import { downloadCsv } from "@/lib/csv";
import { ugx } from "@/lib/format";
import { pageHead } from "@/lib/seo";
import { Empty, Field, FilterBar, Loading, NativeSelect, PageHeader, Panel, ProgressBar, StatusBadge, Table, Td, Th } from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/defaulters")({
  head: () => pageHead("Defaulters", "Students with outstanding fee balances and per-class collection cohorts."),
  component: DefaultersPage,
});

function DefaultersPage() {
  const { termId, term } = useTermContext();
  const { data: students = [], isLoading } = useStudents();
  const { data: classes = [] } = useClasses();
  const { data: termFees = [] } = useTermFees();
  const { data: payments = [] } = useFeePayments();
  const [classId, setClassId] = useState("");
  const [minBal, setMinBal] = useState("");
  const d = { students, termFees, payments };
  const list = useMemo(() => defaulters(d, termId, Number(classId) || null, minBal ? Number(minBal) : null), [students, termFees, payments, termId, classId, minBal]); // eslint-disable-line react-hooks/exhaustive-deps
  const cohorts = useMemo(() => cohortSummaries(d, classes, termId), [students, termFees, payments, classes, termId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (isLoading) return <Loading />;
  const cname = new Map(classes.map((c) => [c.id, c.name]));
  const days = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return (
    <div>
      <PageHeader title="Defaulters" subtitle={term?.name ?? "All terms"} actions={<Button variant="outline" disabled={!list.length} onClick={() => downloadCsv("defaulters.csv", [["Student", "LIN", "Class", "Expected", "Paid", "Balance"], ...list.map((r) => [r.student.full_name, r.student.lin, r.student.class_id ? cname.get(r.student.class_id) : "", r.expected, r.paid, r.balance])])}><Download /> Export CSV</Button>} />
      <Panel title="Cohort summary" bodyClassName="p-0" className="mb-6">
        <Table>
          <thead><tr><Th>Cohort</Th><Th>Students</Th><Th>Paid</Th><Th>Partial</Th><Th>Unpaid</Th><Th>Expected</Th><Th>Collected</Th><Th className="w-48">Collection</Th></tr></thead>
          <tbody>{cohorts.map((c) => { const r = c.expected ? (c.collected / c.expected) * 100 : 0; return (
            <tr key={c.label} className={c.classId == null ? "bg-muted/40 font-semibold" : ""}><Td>{c.label}</Td><Td>{c.total}</Td><Td className="text-success">{c.paid}</Td><Td className="text-warning">{c.partial}</Td><Td className="text-destructive">{c.unpaid}</Td><Td>{ugx(c.expected)}</Td><Td>{ugx(c.collected)}</Td>
              <Td><div className="flex items-center gap-2"><ProgressBar value={r} tone={r >= 80 ? "success" : r >= 50 ? "warning" : "danger"} /><span className="w-12 text-xs">{r.toFixed(0)}%</span></div></Td></tr>
          ); })}</tbody>
        </Table>
      </Panel>
      <FilterBar>
        <Field label="Class"><NativeSelect value={classId} onChange={setClassId}><option value="">All classes</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
        <Field label="Minimum balance (UGX)"><Input type="number" value={minBal} onChange={(e) => setMinBal(e.target.value)} placeholder="0" /></Field>
      </FilterBar>
      <Panel title={`${list.length} defaulter${list.length === 1 ? "" : "s"}`} bodyClassName="p-0">
        {list.length === 0 ? <Empty title="No outstanding balances" /> : (
          <Table>
            <thead><tr><Th>Student</Th><Th>LIN</Th><Th>Class</Th><Th>Expected</Th><Th>Paid</Th><Th>Balance</Th><Th>Status</Th><Th>Days enrolled</Th></tr></thead>
            <tbody>{list.map((r) => (
              <tr key={r.student.id}><Td className="font-medium">{r.student.full_name}</Td><Td className="font-mono text-xs">{r.student.lin}</Td><Td>{r.student.class_id ? cname.get(r.student.class_id) : "—"}</Td><Td>{ugx(r.expected)}</Td><Td>{ugx(r.paid)}</Td><Td className="font-semibold text-destructive">{ugx(r.balance)}</Td><Td><StatusBadge status={r.status} /></Td><Td>{days(r.student.created_at)}</Td></tr>
            ))}</tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
