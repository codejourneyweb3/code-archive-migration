import {
  LayoutDashboard, ClipboardList, PenLine, BookOpen, UserRound, BarChart3, FileText,
  Users, GraduationCap, CalendarRange, School, ArrowUpCircle, ScrollText,
  Wallet, Receipt, PiggyBank, Sparkles, Settings, AlertTriangle, UserPlus, type LucideIcon,
} from "lucide-react";

/** Page tags match the desktop app's route tags so imported AllowedPages keep working. */
export type PageTag =
  | "Dashboard" | "Assessments" | "MarksEntry" | "Gradebook" | "StudentPerformance" | "Analytics" | "ReportCards"
  | "Students" | "Teachers" | "TermManagement" | "Classes" | "Promotion" | "AuditLog"
  | "FinDashboard" | "FeeCollection" | "Budget" | "Defaulters" | "AiInsights" | "SchoolSettings" | "Enrollment";

export interface PageDef { tag: PageTag; label: string; path: string; icon: LucideIcon; section: string; hidden?: boolean }

export const PAGES: PageDef[] = [
  { tag: "Dashboard", label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, section: "Performance" },
  { tag: "Assessments", label: "Assessments", path: "/assessments", icon: ClipboardList, section: "Performance" },
  { tag: "MarksEntry", label: "Marks Entry", path: "/marks-entry", icon: PenLine, section: "Performance" },
  { tag: "Gradebook", label: "Gradebook", path: "/gradebook", icon: BookOpen, section: "Performance" },
  { tag: "StudentPerformance", label: "Student Performance", path: "/student-performance", icon: UserRound, section: "Performance" },
  { tag: "Analytics", label: "Analytics", path: "/analytics", icon: BarChart3, section: "Performance" },
  { tag: "ReportCards", label: "Report Cards", path: "/report-cards", icon: FileText, section: "Performance" },
  { tag: "Students", label: "Students", path: "/students", icon: Users, section: "Administration" },
  { tag: "Enrollment", label: "Enrollment", path: "/enrollment", icon: UserPlus, section: "Administration", hidden: true },
  { tag: "Teachers", label: "Teachers", path: "/teachers", icon: GraduationCap, section: "Administration" },
  { tag: "TermManagement", label: "Term Management", path: "/terms", icon: CalendarRange, section: "Administration" },
  { tag: "Classes", label: "Classes", path: "/classes", icon: School, section: "Administration" },
  { tag: "Promotion", label: "Promotion", path: "/promotion", icon: ArrowUpCircle, section: "Administration" },
  { tag: "AuditLog", label: "Audit Log", path: "/audit-log", icon: ScrollText, section: "Administration" },
  { tag: "FinDashboard", label: "Fin. Dashboard", path: "/finance", icon: Wallet, section: "Finance" },
  { tag: "FeeCollection", label: "Fee Collection", path: "/fees", icon: Receipt, section: "Finance" },
  { tag: "Defaulters", label: "Defaulters", path: "/defaulters", icon: AlertTriangle, section: "Finance" },
  { tag: "Budget", label: "Budget", path: "/budget", icon: PiggyBank, section: "Finance" },
  { tag: "AiInsights", label: "AI Insights", path: "/ai-insights", icon: Sparkles, section: "Insights" },
  { tag: "SchoolSettings", label: "School Settings", path: "/settings", icon: Settings, section: "Insights" },
];

export const ADMIN_ONLY: PageTag[] = ["Budget", "Promotion", "TermManagement", "AuditLog", "SchoolSettings"];

/** Pages an admin can grant to a data entrant (desktop AccessPageOption list). */
export const GRANTABLE: PageTag[] = [
  "Dashboard", "Assessments", "MarksEntry", "Gradebook", "StudentPerformance", "Analytics", "ReportCards",
  "Students", "Teachers", "Classes", "FinDashboard", "FeeCollection",
];

/** Pages that inherit access from a parent page. */
const INHERITS: Partial<Record<PageTag, PageTag>> = { Enrollment: "Students", Defaulters: "FinDashboard" };

export const PREFERRED_START: PageTag[] = ["Dashboard", "MarksEntry", "Assessments", "Gradebook", "Students", "FeeCollection", "ReportCards"];

export function parseAllowed(allowed: string | null | undefined): PageTag[] | null {
  if (!allowed || !allowed.trim()) return null;
  return allowed.split(",").map((s) => s.trim()).filter(Boolean) as PageTag[];
}

/** Mirrors NavigationService.CurrentUserMayAccess. */
export function mayAccess(tag: PageTag, isAdmin: boolean, allowed: string | null | undefined): boolean {
  if (isAdmin) return true;
  const effective = INHERITS[tag] ?? tag;
  if (ADMIN_ONLY.includes(effective)) return false;
  const list = parseAllowed(allowed);
  if (!list) return true;
  return list.some((t) => t.toLowerCase() === effective.toLowerCase());
}

export function landingPath(isAdmin: boolean, allowed: string | null | undefined): string {
  for (const tag of PREFERRED_START) if (mayAccess(tag, isAdmin, allowed)) return PAGES.find((p) => p.tag === tag)!.path;
  const first = PAGES.find((p) => !p.hidden && mayAccess(p.tag, isAdmin, allowed));
  return first?.path ?? "/no-access";
}

export const pageForPath = (path: string) => PAGES.find((p) => path === p.path || path.startsWith(p.path + "/"));
