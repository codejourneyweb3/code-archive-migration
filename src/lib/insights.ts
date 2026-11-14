import type { AcademicData } from "./db";
import { completionPercent, computeGradebook } from "./academics";

/** Rule-based insights from the desktop AiInsightsViewModel / DashboardViewModel. */
export function deriveInsights(data: AcademicData) {
  const atRisk: string[] = [];
  const recommendations: string[] = [];
  const subjName = new Map(data.subjects.map((s) => [s.id, s.name]));
  for (const cls of data.classes) {
    const subjIds = data.classSubjects.filter((cs) => cs.class_id === cls.id).map((cs) => cs.subject_id);
    const ids = subjIds.length ? subjIds : data.subjects.map((s) => s.id);
    for (const sid of ids) {
      const rows = computeGradebook({ classId: cls.id, subjectId: sid }, data);
      if (rows.length === 0) continue;
      const risk = rows.filter((r) => r.average < 40);
      if (risk.length) atRisk.push(`${risk.length} student(s) in ${cls.name} are below 40% in ${subjName.get(sid)}.`);
      const avg = rows.reduce((p, r) => p + r.average, 0) / rows.length;
      if (avg < 50) recommendations.push(`Recommend remedial sessions for ${cls.name} ${subjName.get(sid)} cohort (class average ${avg.toFixed(1)}%).`);
    }
  }
  const cname = new Map(data.classes.map((c) => [c.id, c.name]));
  for (const a of data.assessments.filter((x) => !x.is_published)) {
    const pctDone = completionPercent(a, data);
    if (pctDone < 100) recommendations.push(`Marks entry for '${a.name}' (${a.is_school_wide ? "All Classes" : cname.get(a.class_id)}) is ${pctDone}% — follow up with the entrant.`);
  }
  return { atRisk, recommendations };
}
