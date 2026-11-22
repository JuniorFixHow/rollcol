import Link from "next/link";
import type { Period } from "@/lib/periods";

/** Links to switch between terms or semesters. Hidden when there is only one. */
export function PeriodChips({ periods, currentId, href }: { periods: Period[]; currentId?: string; href: (id: string) => string }) {
  if (periods.length < 2) return null;
  return (
    <div className="mb-4 flex flex-wrap gap-2 print:hidden">
      {periods.map((p) => (
        <Link
          key={p.id}
          href={href(p.id)}
          aria-current={p.id === currentId ? "true" : undefined}
          className={`rounded-full border px-3 py-1 text-sm ${
            p.id === currentId ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-foreground"
          }`}
        >
          {p.name}
        </Link>
      ))}
    </div>
  );
}
