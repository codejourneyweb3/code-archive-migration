import type { ReactNode } from "react";
import { GraduationCap } from "lucide-react";
import authImage from "@/assets/auth-school.jpg";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-navy lg:block">
        <img src={authImage} alt="Students walking across a school courtyard" width={1024} height={1280} className="absolute inset-0 h-full w-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/40 to-transparent" />
        <div className="relative flex h-full flex-col justify-between p-10 text-navy-foreground">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><GraduationCap className="h-6 w-6" /></div>
            <div>
              <p className="text-lg font-bold leading-tight">AutoSchool 360</p>
              <p className="text-xs opacity-80">School management, end to end</p>
            </div>
          </div>
          <div className="max-w-md">
            <p className="font-serif text-3xl leading-snug">Every mark, every fee, every report card — in one place.</p>
            <p className="mt-3 text-sm opacity-80">Assessments, gradebooks, promotion, fee collection and printable A4 report cards for your whole school.</p>
          </div>
        </div>
      </aside>
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><GraduationCap className="h-5 w-5" /></div>
            <p className="text-lg font-bold">AutoSchool 360</p>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

export function GoogleButton({ onClick, label = "Continue with Google", disabled }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-input bg-card text-sm font-medium shadow-sm transition-colors hover:bg-muted disabled:opacity-50">
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.7 2.3 2.4 6.6 2.4 12s4.3 9.7 9.6 9.7c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"/></svg>
      {label}
    </button>
  );
}
