"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_SCHOOL_COOKIE, requireUser } from "@/lib/auth";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Remembers the chosen school for the web dashboard. */
export async function rememberSchool(schoolId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_SCHOOL_COOKIE, schoolId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
}

/** School switcher. Only schools the person belongs to are accepted. */
export async function switchSchool(formData: FormData) {
  const { memberships } = await requireUser();
  const schoolId = String(formData.get("schoolId") ?? "");
  if (memberships.some((m) => m.school.id === schoolId && m.kind === "staff")) {
    await rememberSchool(schoolId);
  }
  redirect("/dashboard");
}
