import { useEffect, useLayoutEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TourStep { target: string; title: string; body: string }

export const TOUR_STEPS: TourStep[] = [
  { target: "Dashboard", title: "Dashboard", body: "Your school at a glance: students, average scores, assessments, revenue and live insights." },
  { target: "Assessments", title: "Assessments", body: "Create exams and tests for a class, a stream, or the whole school, and set how each counts toward term results and promotion." },
  { target: "MarksEntry", title: "Marks Entry", body: "Pick a class, assessment and subject, then type marks. Grades are worked out from the class grading system." },
  { target: "Gradebook", title: "Gradebook", body: "Consolidated marks per student with averages, grades, rank and status." },
  { target: "Students", title: "Students", body: "Enrol, view, edit, shift, terminate and restore students." },
  { target: "Teachers", title: "Teachers", body: "Register teachers and their subjects, classes and next of kin." },
  { target: "Classes", title: "Classes", body: "Set up grading systems, classes, streams and subjects." },
  { target: "TermManagement", title: "Term Management", body: "Create terms and choose which one is active." },
  { target: "ReportCards", title: "Report Cards", body: "Preview A4 report cards and mid-term slips, then print or save them as PDF." },
  { target: "FeeCollection", title: "Fee Collection", body: "Record payments, see balances per student and print payment slips." },
  { target: "AiInsights", title: "AI Insights", body: "At-risk alerts and recommendations drawn from your live marks and assessments." },
  { target: "SchoolSettings", title: "School Settings", body: "School name, motto, logo, head teacher, and staff invite codes." },
  { target: "term-selector", title: "Term selector", body: "Switch the term used across every page." },
  { target: "global-search", title: "Global search", body: "Jump to any student, teacher, class or page. Shortcut: Ctrl + K." },
  { target: "theme-toggle", title: "Theme", body: "Switch between light and dark mode." },
];

export function TourOverlay({ steps, onDone }: { steps: TourStep[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[i]!;

  useLayoutEffect(() => {
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    el?.scrollIntoView({ block: "nearest" });
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onDone(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  const pad = 6;
  const below = rect ? rect.top < 140 : false;
  const right = rect ? rect.left < 300 : false;
  const cardStyle: React.CSSProperties = rect
    ? right ? { top: Math.max(16, Math.min(window.innerHeight - 240, rect.top - 10)), left: rect.right + 20 }
      : below ? { top: rect.bottom + 16, left: Math.max(16, Math.min(window.innerWidth - 360, rect.left - 120)) }
      : { top: rect.top - 220, left: rect.left }
    : { top: "40%", left: "50%", transform: "translate(-50%,-50%)" };

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-label="App tour">
      {rect ? (
        <div className="pointer-events-none absolute rounded-lg ring-2 ring-primary transition-all duration-300"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px var(--overlay)" }} />
      ) : <div className="absolute inset-0" style={{ background: "var(--overlay)" }} />}
      <div className="absolute w-[340px] animate-in fade-in slide-in-from-bottom-2 rounded-xl border bg-popover p-5 shadow-pop" style={cardStyle}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-primary">Step {i + 1} of {steps.length}</p>
            <h3 className="mt-1 text-base font-semibold">{step.title}</h3>
          </div>
          <button aria-label="Close tour" onClick={onDone} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
        <div className="mt-4 flex gap-1">{steps.map((_, k) => <span key={k} className={`h-1.5 flex-1 rounded-full ${k <= i ? "bg-primary" : "bg-muted"}`} />)}</div>
        <div className="mt-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onDone}>Skip tour</Button>
          <div className="flex gap-2">
            {i > 0 && <Button variant="outline" size="sm" onClick={() => setI(i - 1)}>Back</Button>}
            <Button size="sm" onClick={() => (i + 1 < steps.length ? setI(i + 1) : onDone())}>{i + 1 < steps.length ? "Next" : "Finish"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
