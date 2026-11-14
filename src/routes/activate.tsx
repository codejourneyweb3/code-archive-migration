import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/app/ui-kit";

export const Route = createFileRoute("/activate")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Activate access — AutoSchool 360" },
      { name: "description", content: "Enter your invite code to activate school access." },
      { property: "og:title", content: "Activate access — AutoSchool 360" },
      { property: "og:description", content: "Enter your invite code to activate school access." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const { status, user, refresh, signOut } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  useEffect(() => { supabase.rpc("school_has_admin").then(({ data }) => setHasAdmin(!!data)); }, []);

  if (status === "loading") return <Loading />;
  if (status === "signed_out") return <Navigate to="/login" />;
  if (status === "ready") return <Navigate to="/" />;

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data } = await supabase.rpc("redeem_invite", { _code: code.trim().toUpperCase() });
    setBusy(false);
    if (!data) { toast.error("That invite code is invalid, used, or expired."); return; }
    toast.success("Access activated.");
    await refresh();
  }
  async function becomeAdmin() {
    setBusy(true);
    const { data } = await supabase.rpc("claim_first_admin");
    setBusy(false);
    if (!data) { toast.error("An administrator already exists."); return; }
    await refresh();
  }

  return (
    <AuthShell title="Activate your access" subtitle={`Signed in as ${user?.email}. Your account doesn't have school access yet.`}
      footer={<button className="font-medium text-primary hover:underline" onClick={() => signOut()}>Sign out</button>}>
      {hasAdmin === false && (
        <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="font-semibold">No administrator yet</p>
          <p className="mt-1 text-muted-foreground">Set this account up as the school administrator.</p>
          <Button className="mt-3" onClick={becomeAdmin} disabled={busy}>Become administrator</Button>
        </div>
      )}
      <form onSubmit={redeem} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="code">Invite code</Label>
          <Input id="code" required placeholder="AB12-CD34" className="font-mono uppercase" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>Activate</Button>
      </form>
      <p className="mt-4 text-xs text-muted-foreground">Moving from the desktop app? Ask your administrator to confirm your email was included in the import, then sign out and back in.</p>
    </AuthShell>
  );
}
