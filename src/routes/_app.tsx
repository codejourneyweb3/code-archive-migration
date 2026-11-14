import { createFileRoute, Link, Navigate, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { GraduationCap, LogOut, Menu, Moon, Search, Sun, Compass, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { TermProvider, useTermContext } from "@/lib/term-context";
import { PAGES, mayAccess, pageForPath, landingPath } from "@/lib/pages";
import { useClasses, useMediaUrl, useSchoolSettings, useStudents, useTeachers } from "@/lib/db";
import { applyStoredTheme, toggleTheme } from "@/lib/theme";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Loading, NativeSelect } from "@/components/app/ui-kit";
import { TourOverlay, TOUR_STEPS } from "@/components/app/Tour";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export const Route = createFileRoute("/_app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const { status } = useAuth();
  useEffect(() => { applyStoredTheme(); }, []);
  if (status === "loading") return <div className="min-h-screen bg-background"><Loading label="Opening your school…" /></div>;
  if (status === "signed_out") return <Navigate to="/login" />;
  if (status === "no_role") return <Navigate to="/activate" />;
  return <TermProvider><Shell /></TermProvider>;
}

function Sidebar({ onNavigate, onTour }: { onNavigate?: () => void; onTour: () => void }) {
  const { isAdmin, allowedPages } = useAuth();
  const { data: settings } = useSchoolSettings();
  const { data: logoUrl } = useMediaUrl(settings?.logo_path);
  const { pathname } = useLocation();
  const sections = useMemo(() => {
    const visible = PAGES.filter((p) => !p.hidden && mayAccess(p.tag, isAdmin, allowedPages));
    return [...new Set(visible.map((p) => p.section))].map((s) => ({ name: s, pages: visible.filter((p) => p.section === s) }));
  }, [isAdmin, allowedPages]);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
          {logoUrl ? <img src={logoUrl} alt="School logo" className="h-full w-full object-cover" /> : <GraduationCap className="h-6 w-6" />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold leading-tight text-sidebar-accent-foreground">{settings?.school_name || "AutoSchool 360"}</p>
          <p className="truncate text-xs text-sidebar-muted">{settings?.motto || "School management"}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {sections.map((s) => (
          <div key={s.name}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted">{s.name}</p>
            <div className="space-y-0.5">
              {s.pages.map((p) => {
                const active = pathname === p.path || pathname.startsWith(p.path + "/") || (p.tag === "Students" && pathname.startsWith("/enrollment"));
                return (
                  <Link key={p.tag} to={p.path as "/dashboard"} onClick={onNavigate} data-tour={p.tag}
                    className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")}>
                    <p.icon className="h-4 w-4 shrink-0" /> {p.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <button onClick={onTour} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <Compass className="h-4 w-4" /> Take tour
        </button>
      </div>
    </div>
  );
}

function Shell() {
  const { user, profile, isAdmin, allowedPages, signOut } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { terms, termId, setTermId } = useTermContext();
  const { data: classes = [] } = useClasses();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [touring, setTouring] = useState(false);
  const [dark, setDark] = useState(false);
  const page = pageForPath(pathname);
  const tourKey = `autoschool.tour.${user?.id}`;
  const tourSteps = TOUR_STEPS.filter((s) => !PAGES.some((p) => p.tag === s.target) || mayAccess(s.target as never, isAdmin, allowedPages));
  const canTour = tourSteps.some((s) => PAGES.some((p) => p.tag === s.target));

  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(true); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (canTour && !localStorage.getItem(tourKey)) { const t = setTimeout(() => setTouring(true), 700); return () => clearTimeout(t); }
    return undefined;
  }, [tourKey, canTour]);

  function finishTour() {
    setTouring(false);
    localStorage.setItem(tourKey, "done");
    if (isAdmin && classes.length === 0) {
      toast.info("Let's set up your school: create a grading system, then a class, then a term.");
      navigate({ to: "/classes" });
    }
  }

  const allowed = !page || mayAccess(page.tag, isAdmin, allowedPages);
  const name = profile?.full_name || user?.email || "User";

  return (
    <div className="flex min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 lg:block"><Sidebar onTour={() => setTouring(true)} /></aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 border-none p-0"><Sidebar onNavigate={() => setMobileOpen(false)} onTour={() => { setMobileOpen(false); setTouring(true); }} /></SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur md:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu /></Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{page?.label ?? "AutoSchool 360"}</p>
          </div>
          <button data-tour="global-search" onClick={() => setSearchOpen(true)}
            className="hidden h-9 w-64 items-center gap-2 rounded-md border bg-card px-3 text-sm text-muted-foreground shadow-sm hover:bg-muted md:flex">
            <Search className="h-4 w-4" /> Search students, teachers…
            <kbd className="ml-auto rounded border bg-muted px-1.5 text-[10px]">Ctrl K</kbd>
          </button>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSearchOpen(true)} aria-label="Search"><Search /></Button>
          <div data-tour="term-selector">
            <NativeSelect aria-label="Term" value={termId ? String(termId) : ""} onChange={(v) => setTermId(v ? Number(v) : null)} className="w-40">
              {terms.length === 0 && <option value="">No terms yet</option>}
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}{t.is_active ? " • active" : ""}</option>)}
            </NativeSelect>
          </div>
          <Button data-tour="theme-toggle" variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setDark(toggleTheme() === "dark")}>{dark ? <Sun /> : <Moon />}</Button>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-full p-0.5 hover:bg-muted">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{initials(name)}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="truncate text-sm">{name}</p>
                <p className="text-xs font-normal text-muted-foreground">{isAdmin ? "Administrator" : "Data Entrant"}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()}><LogOut className="mr-2 h-4 w-4" /> Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">
          {allowed ? <Outlet /> : <AccessRestricted to={landingPath(isAdmin, allowedPages)} />}
        </main>
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      {touring && <TourOverlay steps={tourSteps} onDone={finishTour} />}
    </div>
  );
}

function AccessRestricted({ to }: { to: string }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border bg-card p-8 text-center shadow-card">
      <ShieldAlert className="mx-auto h-10 w-10 text-warning" />
      <h2 className="mt-3 text-lg font-semibold">Access restricted</h2>
      <p className="mt-1 text-sm text-muted-foreground">Your account doesn't include this page. Ask your administrator if you need it.</p>
      <Button asChild className="mt-5"><Link to={to as "/dashboard"}>Go to my start page</Link></Button>
    </div>
  );
}

function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { isAdmin, allowedPages } = useAuth();
  const { data: students = [] } = useStudents();
  const { data: teachers = [] } = useTeachers();
  const { data: classes = [] } = useClasses();
  const go = (to: string, search?: Record<string, unknown>) => { onOpenChange(false); navigate({ to: to as "/dashboard", search: search as never }); };
  const pages = PAGES.filter((p) => !p.hidden && mayAccess(p.tag, isAdmin, allowedPages));
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search students, teachers, classes, pages…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Pages">
          {pages.map((p) => <CommandItem key={p.tag} onSelect={() => go(p.path)}><p.icon className="mr-2 h-4 w-4" />{p.label}</CommandItem>)}
        </CommandGroup>
        {mayAccess("Students", isAdmin, allowedPages) && (
          <CommandGroup heading="Students">
            {students.slice(0, 400).map((s) => <CommandItem key={s.id} value={`student ${s.full_name} ${s.lin}`} onSelect={() => go("/students", { q: s.full_name })}>{s.full_name} <span className="ml-2 text-xs text-muted-foreground">{s.lin}</span></CommandItem>)}
          </CommandGroup>
        )}
        {mayAccess("Teachers", isAdmin, allowedPages) && (
          <CommandGroup heading="Teachers">
            {teachers.map((t) => <CommandItem key={t.id} value={`teacher ${t.full_name}`} onSelect={() => go("/teachers")}>{t.full_name}</CommandItem>)}
          </CommandGroup>
        )}
        {mayAccess("Classes", isAdmin, allowedPages) && (
          <CommandGroup heading="Classes">
            {classes.map((c) => <CommandItem key={c.id} value={`class ${c.name}`} onSelect={() => go("/classes")}>{c.name}</CommandItem>)}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
