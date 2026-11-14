import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MailCheck } from "lucide-react";

export const Route = createFileRoute("/signup")({
  ssr: false,
  validateSearch: z.object({ mode: z.enum(["setup", "invite"]).optional(), code: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Create account — AutoSchool 360" },
      { name: "description", content: "Create your staff account with an invite code from your school administrator." },
      { property: "og:title", content: "Create account — AutoSchool 360" },
      { property: "og:description", content: "Create your staff account with an invite code from your school administrator." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const search = Route.useSearch();
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState(search.code ?? "");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => { supabase.rpc("school_has_admin").then(({ data }) => setHasAdmin(!!data)); }, []);
  const setup = hasAdmin === false && search.mode === "setup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    if (password !== confirm) { toast.error("Passwords do not match."); return; }
    setBusy(true);
    try {
      const trimmed = code.trim().toUpperCase();
      if (!setup && trimmed) {
        const { data: ok } = await supabase.rpc("check_invite", { _code: trimmed });
        if (!ok) { toast.error("That invite code is invalid, used, or expired."); return; }
      }
      const { error } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: name.trim(), ...(setup ? { intent: "first_admin" } : trimmed ? { invite_code: trimmed } : {}) },
        },
      });
      if (error) { toast.error(error.message); return; }
      setSent(true);
    } finally { setBusy(false); }
  }

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle={`We sent a confirmation link to ${email}.`}>
        <div className="flex items-start gap-3 rounded-xl border bg-card p-5 text-sm">
          <MailCheck className="mt-0.5 h-5 w-5 text-success" />
          <p>Open the link to verify your address, then sign in. {setup ? "You will become the school administrator." : "Your school access is applied automatically on first sign-in."}</p>
        </div>
        <Link to="/login" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">Back to sign in</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={setup ? "Create the administrator account" : "Create your staff account"}
      subtitle={setup ? "This first account manages the school: terms, invites, settings and promotion." : "Enter the invite code your administrator gave you."}
      footer={<p>Already have an account? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link></p>}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="name">Full name</Label><Input id="name" required value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="pw2">Confirm</Label><Input id="pw2" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
        </div>
        {!setup && (
          <div className="space-y-1.5">
            <Label htmlFor="code">Invite code</Label>
            <Input id="code" placeholder="AB12-CD34" value={code} onChange={(e) => setCode(e.target.value)} className="font-mono uppercase" />
            <p className="text-xs text-muted-foreground">Leave empty if you are moving over from the desktop app with the same email.</p>
          </div>
        )}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
      </form>
    </AuthShell>
  );
}
