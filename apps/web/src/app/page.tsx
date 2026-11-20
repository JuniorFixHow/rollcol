import { Brand } from "@/components/brand";
import { LinkButton } from "@/components/ui";

// Public pages are finished in build plan step 9; this is the entry point until then.
export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Brand />
        <LinkButton href="/sign-in" variant="ghost">
          Sign in
        </LinkButton>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 px-6 pb-24">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">Attendance your school can rely on.</h1>
        <p className="max-w-xl text-lg text-muted">
          Registers and parent alerts for basic and senior high schools. Location-checked self check-in for universities and colleges.
        </p>
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/sign-up">Register your school</LinkButton>
          <LinkButton href="/sign-in" variant="secondary">
            Sign in
          </LinkButton>
        </div>
      </main>
      <footer className="mx-auto w-full max-w-5xl px-6 py-6 text-sm text-muted">
        <a href="/privacy" className="hover:text-foreground">
          Privacy policy
        </a>
      </footer>
    </div>
  );
}
