import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/no-access")({
  head: () => pageHead("No pages assigned", "Your account has no pages assigned yet."),
  component: () => (
    <div className="mx-auto mt-16 max-w-md rounded-xl border bg-card p-8 text-center shadow-card">
      <ShieldAlert className="mx-auto h-10 w-10 text-warning" />
      <h2 className="mt-3 text-lg font-semibold">No pages assigned</h2>
      <p className="mt-1 text-sm text-muted-foreground">Your administrator hasn't given your account access to any pages yet.</p>
    </div>
  ),
});
