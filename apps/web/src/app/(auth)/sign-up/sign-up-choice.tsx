import Link from "next/link";

/** "A school" or "Just me": the two ways to start with RollCol. */
export function SignUpChoice({ current, base = "/sign-up" }: { current: "school" | "workspace"; base?: string }) {
  const option = (active: boolean) =>
    `flex-1 rounded-md px-3 py-2 text-center text-sm font-medium ${active ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`;
  return (
    <div className="mb-5 flex rounded-lg bg-surface-muted p-1" role="group" aria-label="Who is this for?">
      <Link href={base} className={option(current === "school")} aria-current={current === "school" ? "page" : undefined}>
        A school
      </Link>
      <Link
        href={`${base}/workspace`}
        className={option(current === "workspace")}
        aria-current={current === "workspace" ? "page" : undefined}
      >
        Just me
      </Link>
    </div>
  );
}
