import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, X, AlertTriangle } from "lucide-react";
import { local } from "@/lib/offline/client";
import { uploadMedia, useAcademicData, useInvalidate } from "@/lib/db";
import { useTermContext } from "@/lib/term-context";
import { errMsg } from "@/lib/format";
import { pageHead } from "@/lib/seo";
import { Loading, PageHeader } from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { StudentFields, emptyDraft, draftToStudent, generateLin, type StudentDraft } from "@/components/students/StudentForm";

export const Route = createFileRoute("/_app/enrollment")({
  head: () => pageHead("Enrollment", "Enrol a new student with guardian, residence, health and emergency details."),
  component: EnrollmentPage,
});

function EnrollmentPage() {
  const { data, isLoading } = useAcademicData();
  const { activeTerm } = useTermContext();
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const [d, setD] = useState<StudentDraft>(emptyDraft());
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  if (isLoading) return <Loading />;

  async function submit() {
    if (!activeTerm) { toast.error("No academic term is active. Activate a term under Term Management before enrolling students."); return; }
    if (!d.full_name.trim() || !d.guardian_phone.trim()) { toast.error("Please provide the student's full name and guardian phone number."); return; }
    const lin = d.lin.trim() || generateLin();
    if (data.students.some((s) => s.is_active && s.lin.toLowerCase() === lin.toLowerCase())) { toast.error(`LIN '${lin}' is already assigned to another student.`); return; }
    setBusy(true);
    try {
      const photo_path = photo ? await uploadMedia("students", photo) : null;
      const draft = { ...d, lin };
      const { error: e1 } = await local.from("enrollments").insert({
        full_name: draft.full_name.trim(), lin, date_of_birth: draft.date_of_birth || null, gender: draft.gender,
        nationality: draft.nationality, religion: draft.religion, previous_school: draft.previous_school, admission_number: lin,
        guardian_name: draft.guardian_name, guardian_relationship: draft.guardian_relationship, guardian_phone: draft.guardian_phone,
        guardian_email: draft.guardian_email, guardian_address: draft.guardian_address, has_custody_documents: draft.has_custody_documents,
        residence_proof_type: draft.residence_proof_type, residence_district: draft.residence_district, residence_zone: draft.residence_zone,
        has_immunization_card: draft.has_immunization_card, has_medical_exam_report: draft.has_medical_exam_report,
        allergies_or_conditions: draft.allergies_or_conditions, health_insurance: draft.health_insurance,
        emergency_name: draft.emergency_name, emergency_relationship: draft.emergency_relationship, emergency_phone: draft.emergency_phone,
        authorized_pickup_person: draft.authorized_pickup_person,
      });
      if (e1) throw e1;
      const { error: e2 } = await local.from("students").insert({ ...draftToStudent(draft), photo_path });
      if (e2) throw e2;
      await invalidate("students", "enrollments");
      toast.success(`${draft.full_name} enrolled (LIN ${lin}).`);
      navigate({ to: "/students" });
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Student enrollment" subtitle={activeTerm ? `Enrolling into ${activeTerm.name}` : "No active term"}
        actions={<Button variant="outline" asChild><Link to="/students">Back to students</Link></Button>} />
      {!activeTerm && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
          <p>No academic term is currently active. An administrator must create and activate a term under Term Management first.</p>
        </div>
      )}
      <div className="mb-5 flex items-center gap-4 rounded-xl border bg-card p-5">
        <div className="flex h-24 w-20 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {photo ? <img src={URL.createObjectURL(photo)} alt="Student photo preview" className="h-full w-full object-cover" /> : <Camera className="h-6 w-6 text-muted-foreground" />}
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>Pick photo</Button>
          {photo && <Button variant="ghost" onClick={() => setPhoto(null)}><X /> Clear photo</Button>}
        </div>
      </div>
      <div className="rounded-xl bg-card">
        <StudentFields d={d} setD={setD} data={data} showEnrollmentExtras />
      </div>
      <div className="mt-6 flex justify-end"><Button size="lg" onClick={submit} disabled={busy}>{busy ? "Submitting…" : "Submit enrollment"}</Button></div>
    </div>
  );
}
