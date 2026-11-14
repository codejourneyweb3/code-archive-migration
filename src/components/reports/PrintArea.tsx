import { useEffect, useRef } from "react";

/** Renders sheets off-screen, waits for images, then opens the print dialog. */
export function PrintArea({ children, onDone }: { children: React.ReactNode; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const imgs = Array.from(ref.current?.querySelectorAll("img") ?? []);
      await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = () => r(null); }))));
      if (cancelled) return;
      const after = () => { window.removeEventListener("afterprint", after); onDone(); };
      window.addEventListener("afterprint", after);
      window.print();
    }, 800);
    return () => { cancelled = true; clearTimeout(t); };
  }, [onDone]);
  return <div ref={ref} className="print-root pointer-events-none fixed left-[-10000px] top-0" aria-hidden>{children}</div>;
}
