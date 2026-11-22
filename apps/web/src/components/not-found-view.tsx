import type { ReactNode } from "react";
import { BackButton } from "@/components/back-button";
import { LinkButton } from "@/components/ui";

/** A register sheet with one empty row and a question mark: the page did not answer the roll call. */
function Illustration() {
  return (
    <svg viewBox="0 0 240 180" aria-hidden className="h-auto w-56 sm:w-64">
      <rect x="38" y="18" width="164" height="150" rx="14" className="fill-surface stroke-line" strokeWidth="2" />
      <rect x="38" y="18" width="164" height="30" rx="14" className="fill-accent-soft" />
      <rect x="38" y="34" width="164" height="14" className="fill-accent-soft" />
      <circle cx="58" cy="33" r="5" className="fill-accent" />
      <rect x="70" y="29" width="62" height="8" rx="4" className="fill-accent" opacity="0.5" />
      {[0, 1, 2].map((row) => (
        <g key={row} transform={`translate(0 ${64 + row * 26})`}>
          <rect x="56" y="0" width="70" height="8" rx="4" className="fill-line" />
          <circle cx="170" cy="4" r="9" className="fill-success-soft" />
          <path d="M165.5 4.5 168.5 7.5 174.5 1.5" fill="none" className="stroke-success" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
      <g transform="translate(0 142)">
        <rect x="56" y="0" width="70" height="8" rx="4" className="fill-line" strokeDasharray="4 4" />
        <circle cx="170" cy="4" r="13" className="fill-warning-soft stroke-warning" strokeWidth="2" strokeDasharray="4 3" />
        <text x="170" y="9.5" textAnchor="middle" className="fill-warning" fontSize="15" fontWeight="700">
          ?
        </text>
      </g>
    </svg>
  );
}

export function NotFoundView({ home, homeLabel, children }: { home: string; homeLabel: string; children?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-10 text-center sm:py-16">
      <Illustration />
      <p className="mt-6 text-sm font-semibold tracking-wide text-accent uppercase">Error 404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">This page is absent</h1>
      <p className="mt-3 text-muted">
        We called its name, but it did not answer. The link may be old or mistyped, or the page may belong to a school or class
        your account cannot open.
      </p>
      {children}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <LinkButton href={home}>{homeLabel}</LinkButton>
        <BackButton />
      </div>
    </div>
  );
}
