import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { AuthShell, GoogleButton } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errMsg } from "@/lib/format";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — AutoSchool 360" },
      { name: "description", content: "Sign in to your school's AutoSchool 360 workspace." },
      { property: "og:title", content: "Sign in — AutoSchool 360" },
      { property: "og:description", content: "Sign in to your school's AutoSchool 360 workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);

  useEffect(() => { supabase.rpc("school_has_admin").then(({ data }) => setHasAdmin(!!data)); }, []);

  if (status === "ready" || status === "no_role") return <Navigate to="/" />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { toast.error(error.message.includes("Email not confirmed") ? "Please confirm your email first — check your inbox." : "Incorrect email or password."); return; }
    navigate({ to: "/" });
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error(errMsg(r.error));
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in with the email address registered at your school."
      footer={<>
        <p>New staff member with an invite code? <Link to="/signup" className="font-medium text-primary hover:underline">Create your account</Link></p>
        <p className="mt-2">Used the AutoTable desktop app? Create your account with the same email — your access carries over once the email is verified.</p>
      </>}>
      {hasAdmin === false && (
        <Link to="/signup" search={{ mode: "setup" }} className="mb-6 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm hover:bg-primary/10">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
          <span><span className="font-semibold">First-time setup.</span> No administrator exists yet — create the school administrator account.</span>
        </Link>
      )}
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">Forgot password?</Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" /></div>
      <GoogleButton onClick={google} />
    </AuthShell>
  );
}
