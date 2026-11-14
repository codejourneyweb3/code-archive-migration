import type { ReactNode } from "react";
import { Field, NativeSelect } from "@/components/app/ui-kit";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import type { AcademicData } from "@/lib/db";

export interface StudentDraft {
  full_name: string; lin: string; class_id: string; stream_id: string; date_of_birth: string; gender: string;
  nationality: string; religion: string; previous_school: string;
  guardian_name: string; guardian_relationship: string; guardian_phone: string; guardian_email: string; guardian_address: string;
  has_custody_documents: boolean; residence_proof_type: string; residence_district: string; residence_zone: string;
  has_immunization_card: boolean; has_medical_exam_report: boolean; allergies_or_conditions: string; health_insurance: string;
  emergency_name: string; emergency_relationship: string; emergency_phone: string; authorized_pickup_person: string;
}

export const emptyDraft = (): StudentDraft => ({
  full_name: "", lin: "", class_id: "", stream_id: "", date_of_birth: "", gender: "", nationality: "", religion: "", previous_school: "",
  guardian_name: "", guardian_relationship: "", guardian_phone: "", guardian_email: "", guardian_address: "",
  has_custody_documents: false, residence_proof_type: "", residence_district: "", residence_zone: "",
  has_immunization_card: false, has_medical_exam_report: false, allergies_or_conditions: "", health_insurance: "",
  emergency_name: "", emergency_relationship: "", emergency_phone: "", authorized_pickup_person: "",
});

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-xl border p-5">
      <legend className="px-2 text-sm font-semibold">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

export function StudentFields({ d, setD, data, showEnrollmentExtras }: { d: StudentDraft; setD: (d: StudentDraft) => void; data: Pick<AcademicData, "classes" | "streams" | "classStreams">; showEnrollmentExtras?: boolean }) {
  const t = (k: keyof StudentDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD({ ...d, [k]: e.target.value });
  const b = (k: keyof StudentDraft) => (v: boolean | "indeterminate") => setD({ ...d, [k]: !!v });
  const streams = d.class_id ? data.classStreams.filter((cs) => cs.class_id === Number(d.class_id)).map((cs) => data.streams.find((s) => s.id === cs.stream_id)!).filter(Boolean) : [];
  return (
    <div className="space-y-5">
      <Section title="Student">
        <Field label="Full name *"><Input value={d.full_name} onChange={t("full_name")} /></Field>
        <Field label="LIN (leave blank to auto-generate)"><Input value={d.lin} onChange={t("lin")} className="font-mono" /></Field>
        <Field label="Class">
          <NativeSelect value={d.class_id} onChange={(v) => setD({ ...d, class_id: v, stream_id: "" })}>
            <option value="">Select class</option>{data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Stream">
          <NativeSelect value={d.stream_id} onChange={(v) => setD({ ...d, stream_id: v })} disabled={!streams.length}>
            <option value="">{streams.length ? "Select stream" : "No streams"}</option>{streams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Date of birth"><Input type="date" value={d.date_of_birth} onChange={t("date_of_birth")} /></Field>
        <Field label="Gender">
          <NativeSelect value={d.gender} onChange={(v) => setD({ ...d, gender: v })}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></NativeSelect>
        </Field>
        {showEnrollmentExtras && <>
          <Field label="Nationality"><Input value={d.nationality} onChange={t("nationality")} /></Field>
          <Field label="Religion"><Input value={d.religion} onChange={t("religion")} /></Field>
          <Field label="Previous school (if any)"><Input value={d.previous_school} onChange={t("previous_school")} /></Field>
        </>}
      </Section>
      <Section title="Parent / guardian">
        <Field label="Guardian full name"><Input value={d.guardian_name} onChange={t("guardian_name")} /></Field>
        <Field label="Relationship to student"><Input value={d.guardian_relationship} onChange={t("guardian_relationship")} /></Field>
        <Field label="Contact number *"><Input value={d.guardian_phone} onChange={t("guardian_phone")} /></Field>
        <Field label="Email"><Input type="email" value={d.guardian_email} onChange={t("guardian_email")} /></Field>
        <Field label="Residential address" className="lg:col-span-2"><Input value={d.guardian_address} onChange={t("guardian_address")} /></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><Checkbox checked={d.has_custody_documents} onCheckedChange={b("has_custody_documents")} /> Custody documents on file</label>
      </Section>
      <Section title="Residence">
        <Field label="Proof of residence">
          <NativeSelect value={d.residence_proof_type} onChange={(v) => setD({ ...d, residence_proof_type: v })}><option value="">Select</option><option>Utility Bill</option><option>LC1 Letter</option><option>Lease Agreement</option></NativeSelect>
        </Field>
        <Field label="District"><Input value={d.residence_district} onChange={t("residence_district")} /></Field>
        <Field label="Zone / Village"><Input value={d.residence_zone} onChange={t("residence_zone")} /></Field>
      </Section>
      <Section title="Health">
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={d.has_immunization_card} onCheckedChange={b("has_immunization_card")} /> Immunization card on file</label>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={d.has_medical_exam_report} onCheckedChange={b("has_medical_exam_report")} /> Medical exam report on file</label>
        <div />
        <Field label="Allergies / chronic conditions" className="lg:col-span-2"><Textarea rows={2} value={d.allergies_or_conditions} onChange={t("allergies_or_conditions")} /></Field>
        <Field label="Health insurance information"><Input value={d.health_insurance} onChange={t("health_insurance")} /></Field>
      </Section>
      <Section title="Emergency & pickup">
        <Field label="Emergency contact name"><Input value={d.emergency_name} onChange={t("emergency_name")} /></Field>
        <Field label="Relationship to student"><Input value={d.emergency_relationship} onChange={t("emergency_relationship")} /></Field>
        <Field label="Phone number"><Input value={d.emergency_phone} onChange={t("emergency_phone")} /></Field>
        <Field label="Authorized pickup person(s)" className="lg:col-span-3"><Input value={d.authorized_pickup_person} onChange={t("authorized_pickup_person")} /></Field>
      </Section>
    </div>
  );
}

const nn = (s: string) => (s.trim() ? s.trim() : null);
/** Maps the form draft onto student table columns. */
export function draftToStudent(d: StudentDraft) {
  return {
    full_name: d.full_name.trim(), lin: d.lin.trim(), admission_number: d.lin.trim(),
    class_id: d.class_id ? Number(d.class_id) : null, stream_id: d.stream_id ? Number(d.stream_id) : null,
    date_of_birth: d.date_of_birth || null, gender: nn(d.gender),
    guardian_name: nn(d.guardian_name), guardian_relationship: nn(d.guardian_relationship), guardian_phone: nn(d.guardian_phone),
    guardian_email: nn(d.guardian_email), guardian_address: nn(d.guardian_address), has_custody_documents: d.has_custody_documents,
    residence_proof_type: nn(d.residence_proof_type), residence_district: nn(d.residence_district), residence_zone: nn(d.residence_zone),
    has_immunization_card: d.has_immunization_card, has_medical_exam_report: d.has_medical_exam_report,
    allergies_or_conditions: nn(d.allergies_or_conditions), health_insurance: nn(d.health_insurance),
    emergency_name: nn(d.emergency_name), emergency_relationship: nn(d.emergency_relationship), emergency_phone: nn(d.emergency_phone),
    authorized_pickup_person: nn(d.authorized_pickup_person),
  };
}

export function studentToDraft(s: Record<string, unknown>): StudentDraft {
  const d = emptyDraft();
  for (const k of Object.keys(d) as (keyof StudentDraft)[]) {
    const v = s[k];
    if (typeof d[k] === "boolean") (d[k] as boolean) = !!v;
    else (d[k] as string) = v == null ? "" : String(v);
  }
  return d;
}

export const generateLin = () => "LIN-" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
