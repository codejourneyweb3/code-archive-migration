import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, KeyRound, Trash2, Upload, GraduationCap, ShieldOff, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { local } from "@/lib/offline/client";
import { uploadMedia, useInviteCodes, useInvalidate, useMediaUrl, useSchoolSettings } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { GRANTABLE, PAGES, parseAllowed, type PageTag } from "@/lib/pages";
import { errMsg, fmtDate } from "@/lib/format";
import { pageHead } from "@/lib/seo";
import { Empty, Field, Loading, PageHeader, Panel, Table, Td, Th } from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_app/settings")({
  head: () => pageHead("School Settings", "School profile, logo, head teacher, staff invite codes and account access."),
  component: SettingsPage,
});

const label = (t: PageTag) => PAGES.find((p) => p.tag === t)?.label ?? t;
const PRESETS: { name: string; pages: PageTag[] }[] = [
  { name: "Full access", pages: [] },
  { name: "Marks entry only", pages: ["MarksEntry", "Gradebook"] },
  { name: "Academics", pages: ["Dashboard", "Assessments", "MarksEntry", "Gradebook", "StudentPerformance", "ReportCards"] },
  { name: "Bursar", pages: ["FinDashboard", "FeeCollection", "Students"] },
];

function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="School Settings" subtitle="Branding shown on the sidebar, report cards and slips." />
      <SchoolProfile />
      <Invites />
      <Accounts />
    </div>
  );
}

function SchoolProfile() {
  const { data: s, isLoading } = useSchoolSettings();
  const { data: logoUrl } = useMediaUrl(s?.logo_path);
  const qc = useQueryClient();
  const [f, setF] = useState({ school_name: "", motto: "", school_address: "", school_phone: "", head_teacher_name: "" });
  const [logo, setLogo] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (s) setF({ school_name: s.school_name, motto: s.motto, school_address: s.school_address, school_phone: s.school_phone, head_teacher_name: s.head_teacher_name }); }, [s]);
  if (isLoading) return <Loading />;
  async function save() {
    try {
      const logo_path = logo ? await uploadMedia("branding", logo) : s?.logo_path ?? null;
      const { error } = await local.from("school_settings").upsert({ id: 1, ...f, logo_path, updated_at: new Date().toISOString() });
      if (error) throw error;
      setLogo(null); toast.success("School settings saved."); qc.invalidateQueries({ queryKey: ["school_settings"] });
    } catch (e) { toast.error(errMsg(e)); }
  }
  const preview = logo ? URL.createObjectURL(logo) : logoUrl;
  return (
    <Panel title="School profile" actions={<Button onClick={save}><Save /> Save</Button>}>
      <div className="grid gap-6 md:grid-cols-[160px_1fr]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border bg-muted">{preview ? <img src={preview} alt="School logo" className="h-full w-full object-contain" /> : <GraduationCap className="h-10 w-10 text-muted-foreground" />}</div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload /> Upload logo</Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="School name"><Input value={f.school_name} onChange={(e) => setF({ ...f, school_name: e.target.value })} /></Field>
          <Field label="Motto"><Input value={f.motto} onChange={(e) => setF({ ...f, motto: e.target.value })} /></Field>
          <Field label="Address"><Input value={f.school_address} onChange={(e) => setF({ ...f, school_address: e.target.value })} /></Field>
          <Field label="Phone"><Input value={f.school_phone} onChange={(e) => setF({ ...f, school_phone: e.target.value })} /></Field>
          <Field label="Head teacher"><Input value={f.head_teacher_name} onChange={(e) => setF({ ...f, head_teacher_name: e.target.value })} /></Field>
        </div>
      </div>
    </Panel>
  );
}

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = () => Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => chars[n % chars.length]).join("");
  return `${pick()}-${pick()}`;
}

function Invites() {
  const { user } = useAuth();
  const { data: codes = [], isLoading } = useInviteCodes();
  const invalidate = useInvalidate();
  const [lbl, setLbl] = useState("");
  const [pages, setPages] = useState<PageTag[]>([]);
  async function generate() {
    const code = genCode();
    const expires = new Date(Date.now() + 30 * 86400000).toISOString();
    const { error } = await local.from("invite_codes").insert({ code, label: lbl || null, allowed_pages: pages.length ? pages.join(",") : null, created_by: user?.id ?? null, expires_at: expires, role: "data_entrant" });
    if (error) { toast.error(errMsg(error)); return; }
    await navigator.clipboard?.writeText(code).catch(() => {});
    toast.success(`Invite code ${code} created and copied.`);
    setLbl(""); invalidate("invite_codes");
  }
  async function revoke(id: number) {
    const { error } = await local.from("invite_codes").delete().eq("id", id);
    if (error) { toast.error(errMsg(error)); return; }
    invalidate("invite_codes");
  }
  const signupLink = (code: string) => `${window.location.origin}/signup?code=${code}`;
  return (
    <Panel title="Staff invite codes">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <Field label="Label (optional)"><Input value={lbl} onChange={(e) => setLbl(e.target.value)} placeholder="e.g. Term 2 marks entry" /></Field>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Access level</p>
            <div className="mb-3 flex flex-wrap gap-2">{PRESETS.map((p) => <Button key={p.name} size="sm" variant={JSON.stringify(p.pages) === JSON.stringify(pages) ? "default" : "outline"} onClick={() => setPages(p.pages)}>{p.name}</Button>)}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{GRANTABLE.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm"><Checkbox checked={pages.includes(t)} onCheckedChange={(v) => setPages(v ? [...pages, t] : pages.filter((x) => x !== t))} />{label(t)}</label>
            ))}</div>
            <p className="mt-2 text-xs text-muted-foreground">{pages.length ? `Grants ${pages.length} page(s).` : "No pages ticked = all non-admin pages."} Codes expire after 30 days and work once.</p>
          </div>
        </div>
        <div className="flex items-start"><Button onClick={generate}><KeyRound /> Generate code</Button></div>
      </div>
      <div className="mt-6">
        {isLoading ? <Loading /> : codes.length === 0 ? <Empty title="No invite codes yet" /> : (
          <Table>
            <thead><tr><Th>Code</Th><Th>Label</Th><Th>Pages</Th><Th>Status</Th><Th>Expires</Th><Th /></tr></thead>
            <tbody>{[...codes].reverse().map((c) => {
              const expired = c.expires_at && c.expires_at < new Date().toISOString();
              return (
                <tr key={c.id}>
                  <Td className="font-mono font-semibold">{c.code}</Td><Td>{c.label || "—"}</Td>
                  <Td className="max-w-xs text-xs">{parseAllowed(c.allowed_pages)?.map(label).join(", ") ?? "All non-admin pages"}</Td>
                  <Td>{c.is_used ? <Badge variant="muted">Used</Badge> : expired ? <Badge variant="danger">Expired</Badge> : <Badge variant="success">Available</Badge>}</Td>
                  <Td>{fmtDate(c.expires_at)}</Td>
                  <Td className="whitespace-nowrap text-right">
                    {!c.is_used && !expired && <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(signupLink(c.code)); toast.success("Sign-up link copied."); }}><Copy /> Copy link</Button>}
                    <Button size="icon" variant="danger-ghost" aria-label="Revoke code" onClick={() => revoke(c.id)}><Trash2 /></Button>
                  </Td>
                </tr>
              );
            })}</tbody>
          </Table>
        )}
      </div>
    </Panel>
  );
}

interface Account { id: string; full_name: string; email: string | null; allowed_pages: string | null; roles: string[] }

function Accounts() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles }] = await Promise.all([supabase.from("profiles").select("id, full_name, email, allowed_pages"), supabase.from("user_roles").select("user_id, role")]);
      if (error) throw error;
      return (profiles ?? []).map((p) => ({ ...p, roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string) })) as Account[];
    },
  });
  const [edit, setEdit] = useState<Account | null>(null);
  async function revoke(a: Account) {
    if (!confirm(`Remove ${a.full_name || a.email}'s access to the school?`)) return;
    const { error } = await supabase.from("user_roles").delete().eq("user_id", a.id);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Access removed."); q.refetch();
  }
  return (
    <Panel title="Active accounts" bodyClassName="p-0">
      {q.isLoading ? <Loading /> : (
        <Table>
          <thead><tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Pages</Th><Th /></tr></thead>
          <tbody>{(q.data ?? []).map((a) => (
            <tr key={a.id}>
              <Td className="font-medium">{a.full_name || "—"}</Td><Td>{a.email}</Td>
              <Td>{a.roles.includes("admin") ? <Badge variant="info">Administrator</Badge> : a.roles.length ? <Badge variant="outline">Data entrant</Badge> : <Badge variant="muted">No access</Badge>}</Td>
              <Td className="max-w-xs text-xs">{a.roles.includes("admin") ? "Everything" : parseAllowed(a.allowed_pages)?.map(label).join(", ") ?? "All non-admin pages"}</Td>
              <Td className="whitespace-nowrap text-right">
                {!a.roles.includes("admin") && a.roles.length > 0 && <>
                  <Button size="sm" variant="ghost" onClick={() => setEdit(a)}>Edit pages</Button>
                  {a.id !== user?.id && <Button size="sm" variant="danger-ghost" onClick={() => revoke(a)}><ShieldOff /> Revoke</Button>}
                </>}
              </Td>
            </tr>
          ))}</tbody>
        </Table>
      )}
      {edit && <EditPages account={edit} onClose={() => { setEdit(null); q.refetch(); }} />}
    </Panel>
  );
}

function EditPages({ account, onClose }: { account: Account; onClose: () => void }) {
  const [pages, setPages] = useState<PageTag[]>(parseAllowed(account.allowed_pages) ?? []);
  async function save() {
    const { error } = await supabase.from("profiles").update({ allowed_pages: pages.length ? pages.join(",") : null }).eq("id", account.id);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Access updated."); onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Pages for {account.full_name || account.email}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-2">{GRANTABLE.map((t) => <label key={t} className="flex items-center gap-2 text-sm"><Checkbox checked={pages.includes(t)} onCheckedChange={(v) => setPages(v ? [...pages, t] : pages.filter((x) => x !== t))} />{label(t)}</label>)}</div>
        <p className="text-xs text-muted-foreground">No pages ticked = all non-admin pages.</p>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
