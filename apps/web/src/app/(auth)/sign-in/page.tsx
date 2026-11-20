import type { Metadata } from "next";
import { Suspense } from "react";
import { Notice } from "@/components/ui";
import { safeNextPath } from "@/lib/redirects";
import { SignInForms } from "./sign-in-forms";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <Suspense fallback={<SignInForms next={null} />}>
      <SignIn searchParams={searchParams} />
    </Suspense>
  );
}

async function SignIn({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const linkProblem = params.error === "link";

  return (
    <div className="space-y-4">
      {linkProblem ? (
        <Notice tone="warning" title="That link did not work">
          It may have expired or been used already. Sign in, or ask for a new link.
        </Notice>
      ) : null}
      <SignInForms next={next} />
    </div>
  );
}
