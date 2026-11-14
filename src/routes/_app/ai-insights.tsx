import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AlertTriangle, Lightbulb, RefreshCw, FileDown, Mail, Printer, Sheet } from "lucide-react";
import { useAcademicData, useInvalidate } from "@/lib/db";
import { computeGradebook } from "@/lib/academics";
import { deriveInsights } from "@/lib/insights";
import { downloadCsv } from "@/lib/csv";
import { pageHead } from "@/lib/seo";
import { Loading, PageHeader, Panel } from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/ai-insights")({
  head: () => pageHead("AI Insights", "At-risk alerts and recommendations derived from live marks and assessments."),
  component: InsightsPage,
});

function InsightsPage() {
  const { data, isLoading } = useAcademicData();
  const invalidate = useInvalidate();
  const insights = useMemo(() => deriveInsights(data), [data]);
  if (isLoading) return <Loading />;

  function atRiskReport() {
    const rows: (string | number)[][] = [["Class", "Student", "LIN", "Average", "Grade"]];
    for (const c of data.classes) for (const r of computeGradebook({ classId: c.id }, data)) if (r.average < 40) rows.push([c.name, r.studentName, r.lin, r.average, r.grade]);
    downloadCsv("at-risk-students.csv", rows);
  }

  return (
    <div>
      <PageHeader title="AI Insights" subtitle={`Analyzed ${data.classes.length} class(es), ${data.subjects.length} subject(s), ${data.assessments.length} assessment(s).`}
        actions={<Button variant="outline" onClick={() => invalidate("marks", "assessments", "students")}><RefreshCw /> Refresh</Button>} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={<span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /> At-risk alerts</span>}>
          <ul className="space-y-2.5">
            {(insights.atRisk.length ? insights.atRisk : ["No at-risk students detected in current gradebook data."]).map((t, i) => <li key={i} className="rounded-lg border border-warning/30 bg-warning/8 p-3 text-sm">{t}</li>)}
          </ul>
        </Panel>
        <Panel title={<span className="flex items-center gap-2"><Lightbulb className="h-4 w-4 text-insight" /> Recommendations</span>}>
          <ul className="space-y-2.5">
            {(insights.recommendations.length ? insights.recommendations : ["No recommendations — all assessments are published and averages look healthy."]).map((t, i) => <li key={i} className="rounded-lg border p-3 text-sm">{t}</li>)}
          </ul>
        </Panel>
      </div>
      <Panel title="Automations" className="mt-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Auto icon={FileDown} title="Generate at-risk report" body="Download a list of students below 40% average." action={<Button size="sm" onClick={atRiskReport}>Download</Button>} />
          <Auto icon={Mail} title="Fee reminders" body="See parents with outstanding balances and their contacts." action={<Button size="sm" variant="outline" asChild><Link to="/defaulters">Open defaulters</Link></Button>} />
          <Auto icon={Printer} title="Bulk print report cards" body="Print every report card in a class in one go." action={<Button size="sm" variant="outline" asChild><Link to="/report-cards">Open report cards</Link></Button>} />
          <Auto icon={Sheet} title="Export gradebook" body="Download gradebook data as a spreadsheet." action={<Button size="sm" variant="outline" asChild><Link to="/gradebook">Open gradebook</Link></Button>} />
        </div>
      </Panel>
    </div>
  );
}

function Auto({ icon: Icon, title, body, action }: { icon: typeof Mail; title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-xl border p-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-insight/12 text-insight"><Icon className="h-4 w-4" /></span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 flex-1 text-xs text-muted-foreground">{body}</p>
      <div className="mt-3">{action}</div>
    </div>
  );
}
