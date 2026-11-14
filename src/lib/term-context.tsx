import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTerms, type Term } from "./db";

interface TermCtx { termId: number | null; setTermId: (id: number | null) => void; terms: Term[]; activeTerm: Term | null; term: Term | null }
const Ctx = createContext<TermCtx | null>(null);
const KEY = "autoschool.term";

/** Header term selector shared by every page; defaults to the active term. */
export function TermProvider({ children }: { children: ReactNode }) {
  const { data: terms = [] } = useTerms();
  const [termId, setTermIdState] = useState<number | null>(null);
  const activeTerm = terms.find((t) => t.is_active) ?? null;

  useEffect(() => {
    if (termId != null && terms.some((t) => t.id === termId)) return;
    const saved = Number(localStorage.getItem(KEY));
    if (saved && terms.some((t) => t.id === saved)) setTermIdState(saved);
    else if (activeTerm) setTermIdState(activeTerm.id);
    else if (terms.length) setTermIdState(terms[terms.length - 1]!.id);
  }, [terms, activeTerm, termId]);

  const value = useMemo<TermCtx>(() => ({
    termId, terms, activeTerm,
    term: terms.find((t) => t.id === termId) ?? null,
    setTermId: (id) => { setTermIdState(id); if (id) localStorage.setItem(KEY, String(id)); else localStorage.removeItem(KEY); },
  }), [termId, terms, activeTerm]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTermContext() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTermContext must be used inside TermProvider");
  return v;
}
