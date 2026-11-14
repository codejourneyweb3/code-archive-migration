import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Users, TrendingUp, ClipboardList, Wallet, UserPlus, PenLine, FileText, Receipt, Sparkles, AlertTriangle, Activity } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAcademicData, useFeePayments, useTerminationLogs } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { useTermContext } from "@/lib/term-context";
import { computeGradebook } from "@/lib/academics";
import { deriveInsights } from "@/lib/insights";
import { mayAccess } from "@/lib/pages";
import { fmtDate, ugx } from "@/lib/format";
import { pageHead } from "@/lib/seo";
import { KpiCard, Loading, PageHeader, Panel } from "@/components/app/ui-kit";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => pageHead("Dashboard", "School overview: students, average scores, assessments, revenue and insights."),
  component: Dashboard,
});

function Dashboard() {
  const { profile, isAdmin, allowedPages } = useAuth();
  const { termId } = useTermContext();
  const { data, isLoading } = useAcademicData();
  const { data: payments = [] } = useFeePayments();
  const { data: logs = [] } = useTerminationLogs(isAdmin);

  const stats = useMemo(() => {
    const active = data.students.filter((s) => s.is_active);
    let total = 0, count = 0, rowsN = 0;
    const perClass: { name: string; average: number }[] = [];
    for (const c of data.classes) {
      const rows = computeGradebook({ classId: c.id, termId }, data);
      if (rows.length) {
        const avg = rows.reduce((p, r) => p + r.average, 0) / rows.length;
        total += avg; count++; rowsN += rows.length;
        perClass.push({ name: c.name, average: Math.round(avg * 10) / 10 });
      }
    }
    const revenue = payments.filter((p) => !termId || p.term_id === termId).reduce((s, p) => s + p.amount, 0);
    return { active: active.length, avg: count ? total / count : 0, rowsN, perClass, revenue };
  }, [data, payments, termId]);

  const insights = useMemo(() => deriveInsights(data), [data]);

  const activity = useMemo(() => {
    const items: { when: string; text: string; icon: typeof Users }[] = [];
    const sname = new Map(data.students.map((s) => [s.id, s.full_name]));
    payments.slice(-4).forEach((p) => items.push({ when: p.payment_date, text: `Fee payment of ${ugx(p.amount)} from ${sname.get(p.student_id) ?? "a student"}`, icon: Receipt }));
    data.students.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3).forEach((s) => items.push({ when: s.created_at, text: `New student enrolled: ${s.full_name}`, icon: UserPlus }));
    data.assessments.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 2).forEach((a) => items.push({ when: a.created_at, text: `Assessment created: ${a.name}`, icon: ClipboardList }));
    logs.slice(-2).forEach((l) => items.push({ when: l.logged_at, text: `Student record closed: ${l.student_name_at_termination}`, icon: Activity }));
    return items.sort((a, b) => b.when.localeCompare(a.when)).slice(0, 7);
  }, [data, payments, logs]);

  if (isLoading) return <Loading />;
  const can = (t: Parameters<typeof mayAccess>[0]) => mayAccess(t, isAdmin, allowedPages);
  const actions = [
    { tag: "Enrollment" as const, label: "Enroll student", to: "/enrollment", icon: UserPlus },
    { tag: "MarksEntry" as const, label: "Enter marks", to: "/marks-entry", icon: PenLine },
    { tag: "FeeCollection" as const, label: "Collect fees", to: "/fees", icon: Receipt },
    { tag: "ReportCards" as const, label: "Report cards", to: "/report-cards", icon: FileText },
    { tag: "Assessments" as const, label: "New assessment", to: "/assessments", icon: ClipboardList },
    { tag: "AiInsights" as const, label: "AI insights", to: "/ai-insights", icon: Sparkles },
  ].filter((a) => can(a.tag));

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Welcome back${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Total Students" value={stats.active.toLocaleString()} subtitle="active, registered" icon={Users} />
        <KpiCard title="Avg Score" value={stats.rowsN ? `${stats.avg.toFixed(1)}%` : "—"} subtitle={stats.rowsN ? `across ${stats.rowsN} records` : "no marks entered"} icon={TrendingUp} tone="success" />
        <KpiCard title="Assessments" value={data.assessments.length.toLocaleString()} subtitle="created" icon={ClipboardList} tone="warning" />
        <KpiCard title="Revenue" value={stats.revenue > 0 ? ugx(stats.revenue) : "—"} subtitle={stats.revenue > 0 ? "collected this term" : "no payments recorded"} icon={Wallet} tone="finance" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Class performance (selected term)" className="xl:col-span-2">
          {stats.perClass.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No marks recorded for this term yet.</p> : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.perClass}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                  <Bar dataKey="average" name="Average %" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
        <Panel title="Quick actions">
          <div className="grid grid-cols-2 gap-3">
            {actions.map((a) => (
              <Link key={a.label} to={a.to as "/dashboard"} className="flex flex-col items-center gap-2 rounded-xl border bg-background p-4 text-center text-xs font-medium transition-colors hover:border-primary/40 hover:bg-accent">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><a.icon className="h-5 w-5" /></span>
                {a.label}
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Recent activity">
          {activity.length === 0 ? <p className="text-sm text-muted-foreground">No activity recorded yet.</p> : (
            <ul className="space-y-4">
              {activity.map((a, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><a.icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1"><p className="text-sm">{a.text}</p><p className="text-xs text-muted-foreground">{fmtDate(a.when)}</p></div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-insight" /> AI insights</span>} actions={can("AiInsights") ? <Link to="/ai-insights" className="text-xs font-medium text-primary hover:underline">View all</Link> : undefined}>
          <ul className="space-y-3">
            {[...insights.atRisk.slice(0, 3).map((t) => ({ t, risk: true })), ...insights.recommendations.slice(0, 3).map((t) => ({ t, risk: false }))].map((x, i) => (
              <li key={i} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                {x.risk ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /> : <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
                {x.t}
              </li>
            ))}
            {insights.atRisk.length + insights.recommendations.length === 0 && <li className="text-sm text-muted-foreground">No insights yet — all assessments are published and averages look healthy.</li>}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
