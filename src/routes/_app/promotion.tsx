import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowUpCircle, Repeat, ArrowRightLeft, RotateCcw, Zap } from "lucide-react";
import { local } from "@/lib/offline/client";
import { useAcademicData, useInvalidate } from "@/lib/db";
import { PROMOTION_STATUS, promotionOverview, promotionStatusLabel, type PromotionRow } from "@/lib/academics";
import { errMsg } from "@/lib/format";
import { pageHead } from "@/lib/seo";
import { Empty, Field, FilterBar, KpiCard, Loading, NativeSelect, PageHeader, Panel, StatusBadge, Table, Td, Th } from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/promotion")({
  head: () => pageHead("Promotion", "End-of-year promotion: promote, repeat or shift students based on their terminal average."),
  component: PromotionPage,
});

function PromotionPage() {
  const { data, isLoading } = useAcademicData();
  const invalidate = useInvalidate();
  const [classId, setClassId] = useState("");
  const [targets, setTargets] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => promotionOverview(data, Number(classId) || null), [data, classId]);
  if (isLoading) return <Loading />;

  const now = () => new Date().toISOString();
  async function promote(r: PromotionRow) {
    const dest = Number(targets[r.studentId] ?? r.targetClassId) || null;
    const { error } = await local.from("students").update({ promotion_status: PROMOTION_STATUS.Promoted, promoted_to_class_id: dest, promotion_processed_at: now(), ...(dest ? { class_id: dest, stream_id: null } : {}) }).eq("id", r.studentId);
    if (error) throw error;
  }
  async function repeat(r: PromotionRow) {
    const { error } = await local.from("students").update({ promotion_status: PROMOTION_STATUS.Repeat, promoted_to_class_id: null, promotion_processed_at: now() }).eq("id", r.studentId);
    if (error) throw error;
  }
  async function shift(r: PromotionRow) {
    const dest = Number(targets[r.studentId]);
    if (!dest) { toast.error("Choose the class to shift to."); return; }
    const { error } = await local.from("students").update({ promotion_status: PROMOTION_STATUS.Shifted, promoted_to_class_id: dest, class_id: dest, stream_id: null, promotion_processed_at: now() }).eq("id", r.studentId);
    if (error) throw error;
  }
  async function reset(r: PromotionRow) {
    const { error } = await local.from("students").update({ promotion_status: PROMOTION_STATUS.Pending, promoted_to_class_id: null, promotion_processed_at: null }).eq("id", r.studentId);
    if (error) throw error;
  }
  const run = (fn: (r: PromotionRow) => Promise<void>, r: PromotionRow) => async () => { try { await fn(r); await invalidate("students"); } catch (e) { toast.error(errMsg(e)); } };

  async function processAll() {
    const pending = rows.filter((r) => r.status === PROMOTION_STATUS.Pending);
    if (!pending.length) { toast.info("No pending students."); return; }
    if (!confirm(`Process ${pending.length} pending student(s)? Those at or above the pass mark are promoted, the rest repeat.`)) return;
    setBusy(true);
    try { for (const r of pending) await (r.suggested === 1 ? promote(r) : repeat(r)); toast.success(`Processed ${pending.length} student(s).`); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); invalidate("students"); }
  }

  const count = (s: number) => rows.filter((r) => r.status === s).length;
  return (
    <div>
      <PageHeader title="Promotion" subtitle="Suggestion uses each student's terminal-term average against the class grading system."
        actions={<Button onClick={processAll} disabled={busy}><Zap /> Process all pending</Button>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Pending" value={count(0)} icon={ArrowUpCircle} tone="warning" />
        <KpiCard title="Promoted" value={count(1)} icon={ArrowUpCircle} tone="success" />
        <KpiCard title="Repeating" value={count(2)} icon={Repeat} tone="danger" />
        <KpiCard title="Shifted" value={count(3)} icon={ArrowRightLeft} />
      </div>
      <FilterBar><Field label="Class"><NativeSelect value={classId} onChange={setClassId}><option value="">All classes</option>{data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field></FilterBar>
      <Panel bodyClassName="p-0">
        {rows.length === 0 ? <Empty title="No active students" /> : (
          <Table>
            <thead><tr><Th>Student</Th><Th>Class</Th><Th>Average</Th><Th>Pass mark</Th><Th>Grade</Th><Th>Suggested</Th><Th>Status</Th><Th>Target class</Th><Th className="text-right">Actions</Th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.studentId} className="hover:bg-muted/40">
                <Td><p className="font-medium">{r.name}</p><p className="font-mono text-xs text-muted-foreground">{r.lin}</p></Td>
                <Td>{r.className}{r.stream !== "-" ? ` · ${r.stream}` : ""}</Td>
                <Td className="font-semibold">{r.average ? `${r.average}%` : "—"}</Td><Td>{r.passMark}%</Td><Td className="font-bold">{r.grade}</Td>
                <Td><StatusBadge status={r.suggested === 1 ? "Promoted" : "Repeat"} /></Td>
                <Td><StatusBadge status={promotionStatusLabel(r.status)} /></Td>
                <Td><NativeSelect value={targets[r.studentId] ?? String(r.targetClassId ?? "")} onChange={(v) => setTargets({ ...targets, [r.studentId]: v })} className="w-32"><option value="">{r.targetClassName ? "—" : "Final class"}</option>{data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Td>
                <Td className="whitespace-nowrap text-right">
                  {r.status === PROMOTION_STATUS.Pending ? <>
                    <Button size="sm" variant="success" onClick={run(promote, r)}>Promote</Button>
                    <Button size="sm" variant="outline" className="ml-1" onClick={run(repeat, r)}>Repeat</Button>
                    <Button size="sm" variant="ghost" className="ml-1" onClick={run(shift, r)}>Shift</Button>
                  </> : <Button size="sm" variant="ghost" onClick={run(reset, r)}><RotateCcw /> Reset</Button>}
                </Td>
              </tr>
            ))}</tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
