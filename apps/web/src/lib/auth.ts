import { type Member, toMember } from "@rollcol/shared";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type StaffMember = Extract<Member, { kind: "staff" }>;

/**
 * The data access layer for identity. Every page and Server Action starts here.
 * Cached per request, so layouts and pages share one lookup.
 */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const { data, error } = await supabase.rpc("current_member");
  if (error) throw new Error(`Could not load the signed-in account: ${error.message}`);

  return { supabase, userId, member: toMember(data[0]) };
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

/** Where a user should land after signing in. */
export function homeFor(member: Member): string {
  if (member.kind === "none") return member.isPlatformAdmin ? "/platform" : "/onboarding";
  if (member.kind === "student") return "/students-use-the-app";
  return "/dashboard";
}
