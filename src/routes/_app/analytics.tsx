import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { TrendingUp, Trophy, AlertTriangle, Activity } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAcademicData } from "@/lib/db";
import { useTermContext } from "@/lib/term-context";
import { computeGradebook } from "@/lib/academics";
import { pageHead } from "@/lib/seo";
import { Empty, Field, FilterBar, KpiCard, Loading, NativeSelect, PageHeader, Panel, Table, Td, Th } from "@/components/app/ui-kit";

export const Route = createFileRoute("/_app/analytics")({
  head: () => pageHead("Analytics", "School-wide performance: class comparison, term trends and at-risk counts."),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data, isLoading } = useAcademicData();
  const { termId, terms } = useTermContext();
  const [subjectId, setSubjectId] = useState("");
  const sid = Number(subjectId) || null;

  const { classes, trend, schoolAvg } = useMemo(() => {
    const avgFor = (classId: number, tId: number | null) => {
      const rows = computeGradebook({ classId, subjectId: sid, termId: tId }, data);
      return { rows, avg: rows.length ? rows.reduce((p, r) => p + r.average, 0) / rows.length : 0 };
    };
    const idx = terms.findIndex((t) => t.id === termId);
    const prev = idx > 0 ? terms[idx - 1] : null;
    const classes = data.classes.map((c) => {
      const cur = avgFor(c.id, termId);
      const before = prev ? avgFor(c.id, prev.id).avg : 0;
      return { name: c.name, students: cur.rows.length, average: Math.round(cur.avg * 10) / 10, atRisk: cur.rows.filter((r) => r.status === "At Risk").length, excellent: cur.rows.filter((r) => r.status === "Excellent").length, trend: prev && before ? cur.avg - before : null };
    }).filter((c) => c.students > 0);
    const trend = terms.map((t) => {
      const vals = data.classes.map((c) => avgFor(c.id, t.id)).filter((x) => x.rows.length);
      return { term: t.name, average: vals.length ? Math.round((vals.reduce((p, v) => p + v.avg, 0) / vals.length) * 10) / 10 : null };
    });
    const schoolAvg = classes.length ? classes.reduce((p, c) => p + c.average, 0) / classes.length : 0;
    return { classes, trend, schoolAvg };
  }, [data, termId, terms, sid]);

  if (isLoading) return <Loading />;
  const best = [...classes].sort((a, b) => b.average - a.average)[0];
  const worst = [...classes].sort((a, b) => a.average - b.average)[0];
  const tIdx = trend.findIndex((t) => t.term === terms.find((x) => x.id === termId)?.name);
  const curT = trend[tIdx]?.average, prevT = trend[tIdx - 1]?.average;
  const tDelta = tIdx > 0 && curT != null && prevT != null ? curT - prevT : null;
  const tip = { background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 };
  const color = (v: number) => (v >= 70 ? "var(--color-success)" : v >= 50 ? "var(--color-warning)" : "var(--color-destructive)");

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Performance across classes for the selected term." />
      <FilterBar>
        <Field label="Subject"><NativeSelect value={subjectId} onChange={setSubjectId}><option value="">All subjects</option>{data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect></Field>
      </FilterBar>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="School average" value={classes.length ? `${schoolAvg.toFixed(1)}%` : "—"} icon={TrendingUp} />
        <KpiCard title="Best class" value={best?.name ?? "—"} subtitle={best ? `${best.average}%` : undefined} icon={Trophy} tone="success" />
        <KpiCard title="Needs attention" value={worst?.name ?? "—"} subtitle={worst ? `${worst.average}%` : undefined} icon={AlertTriangle} tone="danger" />
        <KpiCard title="Term trend" value={tDelta == null ? "—" : `${tDelta >= 0 ? "+" : ""}${tDelta.toFixed(1)}%`} subtitle="vs previous term" icon={Activity} tone="insight" />
      </div>
      {classes.length === 0 ? <Panel><Empty title="No marks recorded for this term" /></Panel> : (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Class performance comparison">
              <div className="h-72"><ResponsiveContainer><BarChart data={classes}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 12 }} /><Tooltip contentStyle={tip} /><Bar dataKey="average" radius={[6, 6, 0, 0]}>{classes.map((c) => <Cell key={c.name} fill={color(c.average)} />)}</Bar></BarChart></ResponsiveContainer></div>
              <div className="mt-2 flex gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-success" />Above 70%</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-warning" />50–70%</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-destructive" />Below 50%</span></div>
            </Panel>
            <Panel title="Term-over-term trend">
              <div className="h-72"><ResponsiveContainer><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" /><XAxis dataKey="term" tick={{ fontSize: 12 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 12 }} /><Tooltip contentStyle={tip} /><Line type="monotone" dataKey="average" name="School average" stroke="var(--color-primary)" strokeWidth={2.5} connectNulls /></LineChart></ResponsiveContainer></div>
            </Panel>
          </div>
          <Panel title="Class breakdown" bodyClassName="p-0" className="mt-6">
            <Table>
              <thead><tr><Th>Class</Th><Th>Students</Th><Th>Average</Th><Th>At risk</Th><Th>Excellent</Th><Th>Trend</Th></tr></thead>
              <tbody>{classes.map((c) => (
                <tr key={c.name}><Td className="font-semibold">{c.name}</Td><Td>{c.students}</Td><Td>{c.average.toFixed(1)}%</Td><Td className="text-destructive">{c.atRisk}</Td><Td className="text-success">{c.excellent}</Td>
                  <Td>{c.trend == null ? "—" : <span className={c.trend >= 0 ? "text-success" : "text-destructive"}>{c.trend >= 0 ? "▲" : "▼"} {Math.abs(c.trend).toFixed(1)}%</span>}</Td></tr>
              ))}</tbody>
            </Table>
          </Panel>
        </>
      )}
    </div>
  );
}
