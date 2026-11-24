import type { Database } from "@rollcol/shared";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

/** Paths that need a signed-in user. Pages still check membership themselves. */
const PROTECTED = ["/dashboard", "/platform", "/onboarding", "/account", "/parent"];

/**
 * Refreshes the Supabase session cookie on every request and sends signed-out
 * visitors to the sign-in page. This is only an early redirect: every page and
 * Server Action checks the user again, and the database enforces access.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseEnv();

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [header, value] of Object.entries(headers)) response.headers.set(header, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = data?.claims !== undefined && data.claims !== null;
  const path = request.nextUrl.pathname;

  if (!signedIn && PROTECTED.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/sign-in";
    signIn.search = "";
    signIn.searchParams.set("next", path);
    return NextResponse.redirect(signIn);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
