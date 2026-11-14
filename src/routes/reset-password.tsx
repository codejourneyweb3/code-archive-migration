import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — AutoSchool 360" },
      { name: "description", content: "Set a new password for your AutoSchool 360 account." },
      { property: "og:title", content: "Choose a new password — AutoSchool 360" },
      { property: "og:description", content: "Set a new password for your AutoSchool 360 account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated.");
    navigate({ to: "/" });
  }
  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="pw">New password</Label><Input id="pw" type="password" required autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <Button type="submit" className="w-full" disabled={busy}>Save password</Button>
      </form>
    </AuthShell>
  );
}
