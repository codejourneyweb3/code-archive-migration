import { GraduationCap, MapPin, Phone } from "lucide-react";
import type { ReportCard } from "@/lib/academics";
import { bandRemark } from "@/lib/academics";
import type { SchoolSettings, Student } from "@/lib/db";
import { fmtDate } from "@/lib/format";

export interface SheetContext {
  settings: SchoolSettings | null | undefined; logoUrl?: string | null | undefined; photoUrl?: string | null | undefined;
  student: Student; className: string; streamName: string; termName: string; yearName: string;
  classTeacher: string; headComment: string;
}

/** A4 report card laid out after the school's printed template. */
export function ReportCardSheet({ rc, ctx }: { rc: ReportCard; ctx: SheetContext }) {
  const s = ctx.student;
  const school = ctx.settings?.school_name || "School";
  const bandsDesc = [...rc.bands].sort((a, b) => b.min_score - a.min_score);
  const info: [string, string][] = [["Student name", s.full_name], ["LIN / Adm. no.", s.lin], ["Class", `${ctx.className}${ctx.streamName ? ` ${ctx.streamName}` : ""}`], ["Term", ctx.termName], ["Academic year", ctx.yearName]];
  const info2: [string, string][] = [["Date of birth", fmtDate(s.date_of_birth)], ["Gender", s.gender || "—"], ["Guardian", s.guardian_name || "—"], ["Report date", fmtDate(new Date().toISOString())]];
  return (
    <div className="a4-sheet flex flex-col overflow-hidden border border-navy/20 px-[12mm] pb-[8mm] pt-[10mm] text-[11px] leading-snug shadow-card">
      <div className="absolute left-0 top-0 h-3 w-full bg-navy" />
      <div className="absolute left-0 top-3 h-1 w-1/3 bg-gold" />
      <header className="flex items-start gap-5">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-gold bg-navy/5">
          {ctx.logoUrl ? <img src={ctx.logoUrl} alt="School logo" className="h-full w-full object-contain" /> : <GraduationCap className="h-12 w-12 text-navy" />}
        </div>
        <div className="flex-1 text-center">
          <h1 className="font-serif text-[26px] font-bold uppercase leading-tight tracking-wide text-navy">{school}</h1>
          {ctx.settings?.motto && <p className="mt-1 font-serif text-[12px] italic text-navy/80">{ctx.settings.motto}</p>}
          <div className="mt-2 flex items-center justify-center gap-3"><span className="h-px w-16 bg-gold" /><span className="text-[20px] font-extrabold tracking-wider text-navy">REPORT CARD</span><span className="h-px w-16 bg-gold" /></div>
        </div>
        <div className="flex w-24 shrink-0 flex-col items-center gap-2">
          <div className="w-full rounded-b-md bg-navy px-2 py-2 text-center text-[9px] font-semibold uppercase leading-tight text-navy-foreground">Academic year<br /><span className="text-[11px]">{ctx.yearName}</span></div>
          <div className="flex h-28 w-24 items-center justify-center overflow-hidden rounded-md border border-navy/30 bg-navy/5 text-[10px] text-navy/50">
            {ctx.photoUrl ? <img src={ctx.photoUrl} alt={s.full_name} className="h-full w-full object-cover" /> : "Photo"}
          </div>
        </div>
      </header>

      <section className="mt-3 grid grid-cols-2 gap-x-8">
        {[info, info2].map((list, i) => (
          <dl key={i} className="space-y-1.5">{list.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[110px_10px_1fr] items-end"><dt className="font-bold uppercase text-navy">{k}</dt><span>:</span><dd className="border-b border-navy/30 pb-0.5 uppercase">{v}</dd></div>
          ))}</dl>
        ))}
      </section>

      <section className="mt-4 overflow-hidden rounded-md border border-navy/40">
        <div className="bg-navy py-1.5 text-center text-[12px] font-bold uppercase tracking-wide text-navy-foreground">{rc.promotional.length ? "Examination results" : "Assessment results"}</div>
        <table className="w-full border-collapse">
          <thead><tr className="bg-navy/5 text-[10px] font-bold uppercase text-navy">
            <th className="border border-navy/20 px-2 py-1.5 text-left">Subject</th>
            {rc.columns.map((c) => <th key={c.id} className="border border-navy/20 px-1 py-1.5 text-center">{c.name}<br /><span className="font-normal normal-case">({c.isPromotional ? "exam" : `${c.weight || "—"}%`})</span></th>)}
            <th className="border border-navy/20 px-1 py-1.5 text-center">Average (%)</th><th className="border border-navy/20 px-1 py-1.5 text-center">Grade</th><th className="border border-navy/20 px-1 py-1.5 text-center">Remark</th>
          </tr></thead>
          <tbody>
            {rc.subjects.length === 0 && <tr><td colSpan={rc.columns.length + 4} className="py-6 text-center text-navy/60">No results recorded for this term.</td></tr>}
            {rc.subjects.map((r) => (
              <tr key={r.subject}>
                <td className="border border-navy/20 px-2 py-1.5">{r.subject}</td>
                {r.cells.map((c) => <td key={c.assessmentId} className="border border-navy/20 px-1 py-1.5 text-center">{c.mark == null ? "—" : c.mark}</td>)}
                <td className="border border-navy/20 px-1 py-1.5 text-center font-semibold">{r.average.toFixed(1)}</td>
                <td className="border border-navy/20 px-1 py-1.5 text-center font-bold">{r.grade}</td>
                <td className="border border-navy/20 px-1 py-1.5 text-center">{r.remark}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-3 grid grid-cols-5 divide-x divide-navy/20 rounded-md border border-navy/30 bg-navy/5 text-center">
        {[["Total marks", `${rc.totalObtained.toLocaleString()} / ${rc.totalPossible.toLocaleString()}`], ["Overall average", `${rc.overallAverage}%`], ["Overall grade", rc.overallGrade], ["Position in class", rc.rank ? `${rc.rank} / ${rc.classSize}` : "—"], ["Status", rc.promotionVerdict]].map(([k, v]) => (
          <div key={k} className="px-2 py-2"><p className="text-[9px] font-bold uppercase text-navy/80">{k}</p><p className="text-[13px] font-bold text-navy">{v}</p></div>
        ))}
      </section>

      <section className="mt-3 grid grid-cols-2 gap-4">
        <div className="overflow-hidden rounded-md border border-navy/30">
          <div className="bg-navy px-3 py-1 text-[11px] font-bold uppercase text-navy-foreground">Class teacher's comments</div>
          <p className="min-h-[90px] px-3 py-2">{rc.teacherComment}</p>
        </div>
        <div className="overflow-hidden rounded-md border border-navy/30">
          <div className="bg-navy px-3 py-1 text-[11px] font-bold uppercase text-navy-foreground">Grading key {rc.gradingSystemName && <span className="font-normal normal-case">· {rc.gradingSystemName} (pass {rc.passMark}%)</span>}</div>
          <table className="w-full text-center">
            <thead><tr className="text-[9px] font-bold uppercase text-navy"><th className="py-1">Grade</th><th>Range (%)</th><th>Remark</th></tr></thead>
            <tbody>{(bandsDesc.length ? bandsDesc : [{ label: "A", min_score: 80, max_score: 100 }, { label: "B", min_score: 70, max_score: 79 }, { label: "C", min_score: 60, max_score: 69 }, { label: "D", min_score: 50, max_score: 59 }, { label: "E", min_score: 40, max_score: 49 }, { label: "F", min_score: 0, max_score: 39 }]).map((b) => (
              <tr key={b.label} className="border-t border-navy/10"><td className="py-0.5 font-semibold">{b.label}</td><td>{b.min_score} – {b.max_score}</td><td>{bandRemark(b.label, rc.bands) || "—"}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="mt-3 overflow-hidden rounded-md border border-navy/30">
        <div className="bg-navy/5 px-3 py-1 text-[11px] font-bold uppercase text-navy">Head teacher's remark</div>
        <p className="min-h-[36px] px-3 py-2 text-navy">{ctx.headComment || " "}</p>
      </section>

      <section className="mt-auto grid grid-cols-3 gap-6 pt-6 text-center text-[10px]">
        {[["Head teacher's signature", ctx.settings?.head_teacher_name || ""], ["Class teacher's signature", ctx.classTeacher], ["Date", fmtDate(new Date().toISOString())]].map(([k, v]) => (
          <div key={k}><p className="font-bold uppercase text-navy">{k}</p><div className="mx-auto mt-7 w-4/5 border-b border-navy/50" /><p className="mt-1 font-semibold">{v}</p></div>
        ))}
      </section>

      <footer className="-mx-[12mm] -mb-[8mm] mt-4 flex items-center justify-center gap-8 bg-navy px-6 py-2.5 text-[10px] text-navy-foreground">
        {ctx.settings?.school_address && <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{ctx.settings.school_address}</span>}
        {ctx.settings?.school_phone && <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{ctx.settings.school_phone}</span>}
        {!ctx.settings?.school_address && !ctx.settings?.school_phone && <span>{school}</span>}
      </footer>
    </div>
  );
}

export interface SlipRow { subject: string; marks: { name: string; mark: number | null }[]; average: number; grade: string }

/** Compact mid-term progress slip. */
export function MidTermSlip({ ctx, rows, columns, average, grade, rank, classSize }: { ctx: SheetContext; rows: SlipRow[]; columns: string[]; average: number; grade: string; rank: number; classSize: number }) {
  return (
    <div className="slip-sheet border border-navy/20 px-[12mm] py-[8mm] text-[11px] shadow-card">
      <div className="flex items-center justify-between border-b-2 border-gold pb-2">
        <div><p className="font-serif text-[18px] font-bold uppercase text-navy">{ctx.settings?.school_name || "School"}</p><p className="text-[10px] italic text-navy/70">{ctx.settings?.motto}</p></div>
        <div className="text-right"><p className="text-[14px] font-extrabold tracking-wider text-navy">MID-TERM PROGRESS SLIP</p><p>{ctx.termName}</p></div>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {[["Name", ctx.student.full_name], ["LIN", ctx.student.lin], ["Class", `${ctx.className} ${ctx.streamName}`], ["Position", rank ? `${rank} / ${classSize}` : "—"]].map(([k, v]) => <p key={k}><span className="font-bold uppercase text-navy">{k}: </span>{v}</p>)}
      </div>
      <table className="mt-2 w-full border-collapse">
        <thead><tr className="bg-navy text-[10px] uppercase text-navy-foreground"><th className="px-2 py-1 text-left">Subject</th>{columns.map((c) => <th key={c} className="px-1 py-1">{c}</th>)}<th className="px-1 py-1">Avg</th><th className="px-1 py-1">Grade</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.subject} className="border-b border-navy/15"><td className="px-2 py-1">{r.subject}</td>{columns.map((c) => <td key={c} className="text-center">{r.marks.find((m) => m.name === c)?.mark ?? "—"}</td>)}<td className="text-center font-semibold">{r.average.toFixed(1)}</td><td className="text-center font-bold">{r.grade}</td></tr>
        ))}</tbody>
      </table>
      <p className="mt-2 text-right font-bold text-navy">Average: {average.toFixed(1)}% · Grade {grade}</p>
    </div>
  );
}
