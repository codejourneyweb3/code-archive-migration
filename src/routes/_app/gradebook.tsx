import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { useAcademicData } from "@/lib/db";
import { useTermContext } from "@/lib/term-context";
import { computeGradebook } from "@/lib/academics";
import { downloadCsv } from "@/lib/csv";
import { pageHead } from "@/lib/seo";
import { Empty, Field, FilterBar, Loading, NativeSelect, PageHeader, Panel, StatusBadge, Table, Td, Th } from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/gradebook")({
  head: () => pageHead("Gradebook", "Consolidated marks per student with averages, grades, rank and status."),
  component: GradebookPage,
});

const n1 = (v: number) => (v ? v.toFixed(1) : "—");

function GradebookPage() {
  const { data, isLoading } = useAcademicData();
  const { termId, term } = useTermContext();
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [yearId, setYearId] = useState("");
  const [q, setQ] = useState("");
  const cid = Number(classId) || data.classes[0]?.id;

  const rows = useMemo(() => cid ? computeGradebook({ classId: cid, subjectId: Number(subjectId) || null, termId, streamId: Number(streamId) || null, yearId: Number(yearId) || null, studentQuery: q }, data) : [], [cid, subjectId, termId, streamId, yearId, q, data]);
  if (isLoading) return <Loading />;
  const cls = data.classes.find((c) => c.id === cid);
  const subjects = data.classSubjects.filter((cs) => cs.class_id === cid).map((cs) => data.subjects.find((s) => s.id === cs.subject_id)!).filter(Boolean);
  const streams = data.classStreams.filter((cs) => cs.class_id === cid).map((cs) => data.streams.find((s) => s.id === cs.stream_id)!).filter(Boolean);

  function exportCsv() {
    downloadCsv(`gradebook-${cls?.name ?? "class"}-${term?.name ?? "all"}.csv`, [
      ["Rank", "Student", "LIN", "Stream", "CAT 1", "CAT 2", "Mid term", "End term", "Average", "Grade", "Status"],
      ...rows.map((r) => [r.rank, r.studentName, r.lin, r.stream, r.cat1, r.cat2, r.midTerm, r.endTerm, r.average, r.grade, r.status]),
    ]);
  }

  return (
    <div>
      <PageHeader title="Gradebook" subtitle={`${cls?.name ?? "No class"} · ${term?.name ?? "All terms"}`} actions={<Button variant="outline" onClick={exportCsv} disabled={!rows.length}><Download /> Export CSV</Button>} />
      <FilterBar>
        <Field label="Class"><NativeSelect value={String(cid ?? "")} onChange={(v) => { setClassId(v); setSubjectId(""); setStreamId(""); }}>{data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
        <Field label="Subject"><NativeSelect value={subjectId} onChange={setSubjectId}><option value="">All subjects</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect></Field>
        <Field label="Stream"><NativeSelect value={streamId} onChange={setStreamId}><option value="">All streams</option>{streams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect></Field>
        <Field label="Academic year"><NativeSelect value={yearId} onChange={setYearId}><option value="">All years</option>{data.years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</NativeSelect></Field>
        <Field label="Student" className="flex-1"><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" /></div></Field>
      </FilterBar>
      <Panel bodyClassName="p-0">
        {rows.length === 0 ? <Empty title="No marks yet" hint="Marks appear here once they are entered for this class and term." /> : (
          <Table>
            <thead><tr><Th>Rank</Th><Th>Student</Th><Th>LIN</Th><Th>Stream</Th><Th>CAT 1</Th><Th>CAT 2</Th><Th>Mid term</Th><Th>End term</Th><Th>Average</Th><Th>Grade</Th><Th>Status</Th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.studentId} className="hover:bg-muted/40">
                  <Td className="font-semibold">{r.rank}</Td><Td className="font-medium">{r.studentName}</Td><Td className="font-mono text-xs">{r.lin}</Td><Td>{r.stream || "—"}</Td>
                  <Td>{n1(r.cat1)}</Td><Td>{n1(r.cat2)}</Td><Td>{n1(r.midTerm)}</Td><Td>{n1(r.endTerm)}</Td>
                  <Td className="font-semibold">{r.average.toFixed(1)}%</Td><Td className="font-bold">{r.grade}</Td><Td><StatusBadge status={r.status} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
