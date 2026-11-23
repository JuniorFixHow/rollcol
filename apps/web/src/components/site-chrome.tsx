import Link from "next/link";
import { Brand } from "@/components/brand";
import { LinkButton } from "@/components/ui";

/** The public pages' header. The full site header and footer come with launch preparation. */
export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-5">
      <Brand />
      <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
        <Link href="/pricing" className="rounded-md px-3 py-2 text-sm font-medium text-muted hover:text-foreground">
          Pricing
        </Link>
        <LinkButton href="/sign-in" variant="ghost">
          Sign in
        </LinkButton>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-5xl flex-wrap gap-x-6 gap-y-2 px-6 py-6 text-sm text-muted">
      <Link href="/pricing" className="hover:text-foreground">
        Pricing
      </Link>
      <Link href="/privacy" className="hover:text-foreground">
        Privacy policy
      </Link>
      <span>RollCol by Teqxa</span>
    </footer>
  );
}
