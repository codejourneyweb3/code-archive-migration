import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { landingPath } from "@/lib/pages";
import { Loading } from "@/components/app/ui-kit";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "AutoSchool 360 — School Management" },
      { name: "description", content: "Sign in to manage students, marks, report cards and fees." },
      { property: "og:title", content: "AutoSchool 360 — School Management" },
      { property: "og:description", content: "Sign in to manage students, marks, report cards and fees." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { status, isAdmin, allowedPages } = useAuth();
  if (status === "loading") return <Loading />;
  if (status === "signed_out") return <Navigate to="/login" />;
  if (status === "no_role") return <Navigate to="/activate" />;
  return <Navigate to={landingPath(isAdmin, allowedPages)} />;
}
