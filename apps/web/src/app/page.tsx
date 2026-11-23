import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { LinkButton } from "@/components/ui";

// Public pages are finished in build plan step 9; this is the entry point until then.
export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 px-6 pb-24">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">Attendance your school can rely on.</h1>
        <p className="max-w-xl text-lg text-muted">
          Registers and parent alerts for basic and senior high schools. Location-checked self check-in for universities and colleges.
        </p>
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/sign-up">Register your school</LinkButton>
          <LinkButton href="/pricing" variant="secondary">
            See prices
          </LinkButton>
        </div>
        <p className="text-sm text-muted">
          Teaching on your own, without a school?{" "}
          <a href="/sign-up/workspace" className="font-medium text-accent hover:underline">
            Start a free workspace
          </a>
          .
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
