import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, PiggyBank, Wallet, Scale, Percent } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBudgetLines, useInvalidate, type BudgetLine } from "@/lib/db";
import { errMsg, ugx } from "@/lib/format";
import { pageHead } from "@/lib/seo";
import { Empty, Field, FilterBar, KpiCard, Loading, NativeSelect, PageHeader, Panel, ProgressBar, StatusBadge, Table, Td, Th } from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/budget")({
  head: () => pageHead("Budget", "Budget lines per financial year with spending and utilisation."),
  component: BudgetPage,
});

const statusOf = (b: BudgetLine) => { const u = b.budgeted ? (b.spent / b.budgeted) * 100 : 0; return u > 100 ? "Over budget" : u >= 85 ? "Near limit" : "On Track"; };

function BudgetPage() {
  const { data: lines = [], isLoading } = useBudgetLines();
  const invalidate = useInvalidate();
  const years = [...new Set(lines.map((l) => l.financial_year).filter(Boolean))].sort().reverse();
  const [year, setYear] = useState("");
  const [editing, setEditing] = useState<BudgetLine | "new" | null>(null);
  if (isLoading) return <Loading />;
  const list = lines.filter((l) => !year || l.financial_year === year);
  const total = list.reduce((p, l) => p + l.budgeted, 0), spent = list.reduce((p, l) => p + l.spent, 0);
  async function remove(l: BudgetLine) {
    if (!confirm(`Delete "${l.category}"?`)) return;
    const { error } = await supabase.from("budget_lines").delete().eq("id", l.id);
    if (error) { toast.error(errMsg(error)); return; }
    invalidate("budget_lines");
  }
  return (
    <div>
      <PageHeader title="Budget" actions={<Button onClick={() => setEditing("new")}><Plus /> Add budget line</Button>} />
      <FilterBar><Field label="Financial year"><NativeSelect value={year} onChange={setYear}><option value="">All years</option>{years.map((y) => <option key={y}>{y}</option>)}</NativeSelect></Field></FilterBar>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Total budget" value={ugx(total)} icon={PiggyBank} />
        <KpiCard title="Spent" value={ugx(spent)} icon={Wallet} tone="warning" />
        <KpiCard title="Remaining" value={ugx(total - spent)} icon={Scale} tone="success" />
        <KpiCard title="Utilisation" value={`${total ? ((spent / total) * 100).toFixed(1) : "0.0"}%`} icon={Percent} tone="finance" />
      </div>
      <Panel title="Budget line items" bodyClassName="p-0">
        {list.length === 0 ? <Empty title="No budget lines" /> : (
          <Table>
            <thead><tr><Th>Category</Th><Th>Year</Th><Th>Budgeted</Th><Th>Spent</Th><Th>Remaining</Th><Th className="w-44">Utilisation</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>{list.map((l) => { const u = l.budgeted ? (l.spent / l.budgeted) * 100 : 0; return (
              <tr key={l.id}><Td className="font-medium">{l.category}</Td><Td>{l.financial_year}</Td><Td>{ugx(l.budgeted)}</Td><Td>{ugx(l.spent)}</Td><Td>{ugx(l.budgeted - l.spent)}</Td>
                <Td><div className="flex items-center gap-2"><ProgressBar value={u} tone={u > 100 ? "danger" : u >= 85 ? "warning" : "success"} /><span className="w-12 text-xs">{u.toFixed(0)}%</span></div></Td>
                <Td><StatusBadge status={statusOf(l)} /></Td>
                <Td className="whitespace-nowrap text-right"><Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEditing(l)}><Pencil /></Button><Button size="icon" variant="danger-ghost" aria-label="Delete" onClick={() => remove(l)}><Trash2 /></Button></Td></tr>
            ); })}</tbody>
          </Table>
        )}
      </Panel>
      {editing && <LineDialog line={editing === "new" ? null : editing} defaultYear={year || years[0] || String(new Date().getFullYear())} onClose={() => setEditing(null)} />}
    </div>
  );
}

function LineDialog({ line, defaultYear, onClose }: { line: BudgetLine | null; defaultYear: string; onClose: () => void }) {
  const invalidate = useInvalidate();
  const [f, setF] = useState({ category: line?.category ?? "", budgeted: String(line?.budgeted ?? ""), spent: String(line?.spent ?? "0"), financial_year: line?.financial_year ?? defaultYear });
  async function save() {
    if (!f.category.trim()) { toast.error("Category is required."); return; }
    const row = { category: f.category.trim(), budgeted: Number(f.budgeted) || 0, spent: Number(f.spent) || 0, financial_year: f.financial_year.trim() };
    const { error } = line ? await supabase.from("budget_lines").update(row).eq("id", line.id) : await supabase.from("budget_lines").insert(row);
    if (error) { toast.error(errMsg(error)); return; }
    invalidate("budget_lines"); onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{line ? "Edit budget line" : "Add budget line"}</DialogTitle></DialogHeader>
        <Field label="Category"><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="e.g. Salaries" /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Budgeted"><Input type="number" value={f.budgeted} onChange={(e) => setF({ ...f, budgeted: e.target.value })} /></Field>
          <Field label="Spent"><Input type="number" value={f.spent} onChange={(e) => setF({ ...f, spent: e.target.value })} /></Field>
          <Field label="Financial year"><Input value={f.financial_year} onChange={(e) => setF({ ...f, financial_year: e.target.value })} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
