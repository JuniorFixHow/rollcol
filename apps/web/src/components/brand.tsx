import Link from "next/link";

/**
 * The RollCol mark: a tick that doubles as a raised arm answering the roll
 * call. Colours come from the theme, so it suits light and dark pages.
 */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className}>
      <rect width="100" height="100" rx="22" className="fill-accent" />
      <circle cx="69.5" cy="29.5" r="9.5" className="fill-accent-foreground" />
      <path
        d="M26.5 56.5 L44.5 74.5 L70.5 48.5"
        fill="none"
        className="stroke-accent-foreground"
        strokeWidth="11.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <LogoMark />
      RollCol
    </Link>
  );
}
