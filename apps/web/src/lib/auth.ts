import { type Member, type Membership, type StaffMembership, chooseMember, toMemberships } from "@rollcol/shared";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type StaffMember = StaffMembership;

/** Remembers which school's dashboard a person last opened. */
export const ACTIVE_SCHOOL_COOKIE = "rollcol_school";

/**
 * The data access layer for identity. Every page and Server Action starts here.
 * Cached per request, so layouts and pages share one lookup.
 *
 * A person can belong to several schools. `memberships` lists them all;
 * `member` is the one on screen (chosen with the school switcher).
 */
export const getSession = cache(async () => {
  // Who is signed in is only known at request time. Stop prerendering here, so
  // Next.js does not try to prepare signed-in pages in advance (Supabase reads
  // the clock to check the session's expiry).
  await connection();
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const [membershipsResult, adminResult, cookieStore] = await Promise.all([
    supabase.rpc("my_memberships"),
    supabase.rpc("is_platform_admin"),
    cookies(),
  ]);
  if (membershipsResult.error) {
    throw new Error(`Could not load the signed-in account: ${membershipsResult.error.message}`);
  }

  const isPlatformAdmin = adminResult.data === true;
  const memberships = toMemberships(membershipsResult.data, isPlatformAdmin);
  const member = chooseMember(memberships, isPlatformAdmin, {
    preferredSchoolId: cookieStore.get(ACTIVE_SCHOOL_COOKIE)?.value ?? null,
    preferKind: "staff",
  });

  return { supabase, userId, memberships, member };
});

/** A signed-in user, with or without a school. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

/** An active staff member. Students and people without a school go elsewhere. */
export async function requireStaff() {
  const session = await requireUser();
  const { member } = session;
  if (member.kind === "none") redirect(member.isPlatformAdmin ? "/platform" : "/onboarding");
  if (member.kind === "student") redirect("/students-use-the-app");
  if (member.status !== "active") redirect("/account/disabled");
  return { ...session, member };
}

export async function requireAdmin() {
  const session = await requireStaff();
  if (session.member.role !== "admin") redirect("/dashboard");
  return session;
}

export async function requirePlatformAdmin() {
  const session = await requireUser();
  if (!session.member.isPlatformAdmin) redirect("/dashboard");
  return session;
}

/** Schools whose dashboard this person can open on the web. */
export function staffMemberships(memberships: readonly Membership[]): StaffMembership[] {
  return memberships.filter((m): m is StaffMembership => m.kind === "staff");
}

/** Where a user should land after signing in. */
export function homeFor(member: Member): string {
  if (member.kind === "none") return member.isPlatformAdmin ? "/platform" : "/onboarding";
  if (member.kind === "student") return "/students-use-the-app";
  return "/dashboard";
}
