import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Users, TrendingUp, AlertTriangle, Award, Search } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from "recharts";
import { useAcademicData, type AcademicData } from "@/lib/db";
import { useTermContext } from "@/lib/term-context";
import { assessmentAppliesToClass, computeGradebook, gradeFromBands, markSubjectId, resolveScale } from "@/lib/academics";
import { pageHead } from "@/lib/seo";
import { Empty, Field, FilterBar, KpiCard, Loading, NativeSelect, PageHeader, Panel, StatusBadge, Table, Td, Th } from "@/components/app/ui-kit";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/student-performance")({
  head: () => pageHead("Student Performance", "Class rankings and each student's results by subject and assessment."),
  component: PerformancePage,
});

function PerformancePage() {
  const { data, isLoading } = useAcademicData();
  const { termId } = useTermContext();
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<number | null>(null);
  const cid = Number(classId) || data.classes[0]?.id;
  const rows = useMemo(() => cid ? computeGradebook({ classId: cid, subjectId: Number(subjectId) || null, termId, streamId: Number(streamId) || null, studentQuery: q }, data) : [], [cid, subjectId, termId, streamId, q, data]);
  if (isLoading) return <Loading />;
  const subjects = data.classSubjects.filter((cs) => cs.class_id === cid).map((cs) => data.subjects.find((s) => s.id === cs.subject_id)!).filter(Boolean);
  const streams = data.classStreams.filter((cs) => cs.class_id === cid).map((cs) => data.streams.find((s) => s.id === cs.stream_id)!).filter(Boolean);
  const avg = rows.length ? rows.reduce((p, r) => p + r.average, 0) / rows.length : 0;
  const catAvg = (r: (typeof rows)[number]) => { const v = [r.cat1, r.cat2].filter(Boolean); return v.length ? v.reduce((p, c) => p + c, 0) / v.length : 0; };

  return (
    <div>
      <PageHeader title="Student Performance" subtitle="Click a student for their full breakdown." />
      <FilterBar>
        <Field label="Class"><NativeSelect value={String(cid ?? "")} onChange={(v) => { setClassId(v); setSubjectId(""); setStreamId(""); }}>{data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
        <Field label="Stream"><NativeSelect value={streamId} onChange={setStreamId}><option value="">All streams</option>{streams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect></Field>
        <Field label="Subject"><NativeSelect value={subjectId} onChange={setSubjectId}><option value="">All subjects</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect></Field>
        <Field label="Student" className="flex-1"><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Search by student name…" value={q} onChange={(e) => setQ(e.target.value)} /></div></Field>
      </FilterBar>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Total students" value={rows.length} icon={Users} />
        <KpiCard title="Class average" value={`${avg.toFixed(1)}%`} icon={TrendingUp} tone="success" />
        <KpiCard title="At risk" value={rows.filter((r) => r.status === "At Risk").length} icon={AlertTriangle} tone="danger" />
        <KpiCard title="Excellent (≥80%)" value={rows.filter((r) => r.average >= 80).length} icon={Award} tone="warning" />
      </div>
      <Panel title="Student performance summary" bodyClassName="p-0">
        {rows.length === 0 ? <Empty title="No results yet for this selection" /> : (
          <Table>
            <thead><tr><Th>Rank</Th><Th>Student</Th><Th>LIN</Th><Th>CAT avg</Th><Th>Mid term</Th><Th>End term</Th><Th>Average</Th><Th>Grade</Th><Th>Status</Th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.studentId} className="cursor-pointer hover:bg-muted/40" onClick={() => setDetail(r.studentId)}>
                  <Td className="font-semibold">{r.rank}</Td><Td className="font-medium text-primary">{r.studentName}</Td><Td className="font-mono text-xs">{r.lin}</Td>
                  <Td>{catAvg(r) ? catAvg(r).toFixed(1) : "—"}</Td><Td>{r.midTerm ? r.midTerm.toFixed(1) : "—"}</Td><Td>{r.endTerm ? r.endTerm.toFixed(1) : "—"}</Td>
                  <Td className="font-semibold">{r.average.toFixed(1)}%</Td><Td className="font-bold">{r.grade}</Td><Td><StatusBadge status={r.status} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      {detail && <DetailDialog studentId={detail} termId={termId} data={data} onClose={() => setDetail(null)} />}
    </div>
  );
}

function DetailDialog({ studentId, termId, data, onClose }: { studentId: number; termId: number | null; data: AcademicData; onClose: () => void }) {
  const s = data.students.find((x) => x.id === studentId)!;
  const scale = resolveScale(s.class_id, data);
  const amap = new Map(data.assessments.map((a) => [a.id, a]));
  const subjName = new Map(data.subjects.map((x) => [x.id, x.name]));
  const marks = data.marks.filter((m) => {
    const a = amap.get(m.assessment_id);
    return m.student_id === studentId && a && s.class_id && assessmentAppliesToClass(a, s.class_id) && (!termId || a.term_id === termId);
  });
  const bySubject = new Map<string, number[]>();
  for (const m of marks) { const k = subjName.get(markSubjectId(m, amap.get(m.assessment_id)) ?? -1) ?? "General"; bySubject.set(k, [...(bySubject.get(k) ?? []), m.mark ?? 0]); }
  const subjectData = [...bySubject.entries()].map(([subject, v]) => ({ subject, average: Math.round((v.reduce((p, c) => p + c, 0) / v.length) * 10) / 10 }));
  const timeline = [...new Set(marks.map((m) => m.assessment_id))].map((id) => amap.get(id)!).sort((a, b) => (a.due_date ?? a.created_at).localeCompare(b.due_date ?? b.created_at))
    .map((a) => { const v = marks.filter((m) => m.assessment_id === a.id).map((m) => m.mark ?? 0); return { name: a.name, score: Math.round((v.reduce((p, c) => p + c, 0) / v.length) * 10) / 10 }; });
  const tip = { background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{s.full_name} <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">{s.lin}</span></DialogTitle></DialogHeader>
        {marks.length === 0 ? <Empty title="No marks recorded for this term" /> : (
          <div className="grid gap-5">
            <div className="h-56"><ResponsiveContainer><BarChart data={subjectData}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} /><XAxis dataKey="subject" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} /><Tooltip contentStyle={tip} /><Bar dataKey="average" fill="var(--color-primary)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
            <div className="h-48"><ResponsiveContainer><LineChart data={timeline}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} /><Tooltip contentStyle={tip} /><Line type="monotone" dataKey="score" stroke="var(--color-success)" strokeWidth={2} /></LineChart></ResponsiveContainer></div>
            <Table>
              <thead><tr><Th>Subject</Th><Th>Average</Th><Th>Grade</Th></tr></thead>
              <tbody>{subjectData.map((r) => <tr key={r.subject}><Td>{r.subject}</Td><Td>{r.average.toFixed(1)}%</Td><Td className="font-bold">{gradeFromBands(r.average, scale.bands)}</Td></tr>)}</tbody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
