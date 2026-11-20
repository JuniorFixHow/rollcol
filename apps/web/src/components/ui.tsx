import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Shared look for buttons and links styled as buttons. */
export function buttonClass(variant: "primary" | "secondary" | "danger" | "ghost" = "primary", size: "md" | "sm" = "md") {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";
  const sizes = { md: "h-10 px-4 text-sm", sm: "h-8 px-3 text-sm" };
  const variants = {
    primary: "bg-accent text-accent-foreground hover:bg-accent-hover",
    secondary: "border border-line bg-surface text-foreground hover:bg-surface-muted",
    danger: "bg-danger text-white hover:opacity-90",
    ghost: "text-foreground hover:bg-surface-muted",
  };
  return `${base} ${sizes[size]} ${variants[variant]}`;
}

export const inputClass =
  "block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 aria-invalid:border-danger";

export function LinkButton({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Parameters<typeof buttonClass>[0]; size?: "md" | "sm" }) {
  return <Link className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ title, description, children, className = "" }: { title?: string; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-surface p-5 ${className}`}>
      {title ? (
        <header className="mb-4">
          <h2 className="text-base font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

type Tone = "neutral" | "accent" | "warning" | "danger" | "success";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const tones: Record<Tone, string> = {
    neutral: "bg-surface-muted text-muted",
    accent: "bg-accent-soft text-accent",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    success: "bg-success-soft text-success",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Notice({ tone = "accent", title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  const tones: Record<Tone, string> = {
    neutral: "border-line bg-surface-muted",
    accent: "border-accent/30 bg-accent-soft",
    warning: "border-warning/30 bg-warning-soft",
    danger: "border-danger/30 bg-danger-soft",
    success: "border-success/30 bg-success-soft",
  };
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>
      {title ? <p className="font-medium">{title}</p> : null}
      <div className={title ? "mt-1 text-foreground/80" : ""}>{children}</div>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted">
          <tr>
            {headers.map((header, index) => (
              <th key={`${header}-${index}`} scope="col" className="px-4 py-2.5 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line bg-surface">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-48 rounded bg-surface-muted" />
      <div className="h-4 w-80 rounded bg-surface-muted" />
      <div className="h-40 rounded-lg bg-surface-muted" />
    </div>
  );
}

export function formatDate(value: string | null): string {
  if (!value) return "";
  const date = value.length === 10 ? new Date(`${value}T00:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Accra" }).format(date);
}
