import type { Database } from "./database.types";

type Enums = Database["public"]["Enums"];
type MembershipRow = Database["public"]["Functions"]["my_memberships"]["Returns"][number];

export interface MemberSchool {
  id: string;
  name: string;
  code: string;
  type: Enums["school_type"];
  registerMode: Enums["register_mode"] | null;
  status: Enums["school_status"];
  /** A teacher's or lecturer's own workspace (one person, no school). */
  isWorkspace: boolean;
}

export type StaffMembership = {
  kind: "staff";
  id: string;
  status: Enums["member_status"];
  role: Enums["staff_role"];
  fullName: string;
  schoolNumber: string;
  school: MemberSchool;
  isPlatformAdmin: boolean;
};

export type StudentMembership = {
  kind: "student";
  id: string;
  status: Enums["member_status"];
  fullName: string;
  schoolNumber: string;
  school: MemberSchool;
  isPlatformAdmin: boolean;
};

/** One school the signed-in person belongs to, with their role there. */
export type Membership = StaffMembership | StudentMembership;

/**
 * The membership on screen right now. A person can belong to several schools
 * (staff at one, a student at another, and so on); the apps show one at a time.
 * "none" means signed in but not part of any school yet.
 */
export type Member = Membership | { kind: "none"; isPlatformAdmin: boolean };

/** Turns my_memberships() rows into memberships, skipping any malformed row. */
export function toMemberships(rows: readonly MembershipRow[] | null | undefined, isPlatformAdmin: boolean): Membership[] {
  const memberships: Membership[] = [];
  for (const row of rows ?? []) {
    const school: MemberSchool = {
      id: row.school_id,
      name: row.school_name,
      code: row.school_code,
      type: row.school_type,
      registerMode: row.register_mode ?? null,
      status: row.school_status,
      isWorkspace: row.is_workspace === true,
    };
    if (row.kind === "staff") {
      memberships.push({
        kind: "staff",
        id: row.member_id,
        status: row.status,
        role: row.role,
        fullName: row.full_name,
        schoolNumber: row.school_number,
        school,
        isPlatformAdmin,
      });
    } else if (row.kind === "student") {
      memberships.push({
        kind: "student",
        id: row.member_id,
        status: row.status,
        fullName: row.full_name,
        schoolNumber: row.school_number ?? "",
        school,
        isPlatformAdmin,
      });
    }
  }
  return memberships;
}

export interface ChooseMemberOptions {
  /** The school the person last chose (cookie on the web, device storage on mobile). */
  preferredSchoolId?: string | null;
  /** The web is for staff, so it prefers staff memberships when nothing is chosen yet. */
  preferKind?: Membership["kind"];
}

/**
 * Picks the membership to show: the school the person chose if they still
 * belong to it, otherwise an active membership (of the preferred kind first),
 * otherwise the first one.
 */
export function chooseMember(memberships: readonly Membership[], isPlatformAdmin: boolean, options: ChooseMemberOptions = {}): Member {
  const { preferredSchoolId, preferKind } = options;

  const chosen = preferredSchoolId ? memberships.find((m) => m.school.id === preferredSchoolId) : undefined;
  if (chosen && (!preferKind || chosen.kind === preferKind)) return chosen;

  const active = memberships.filter((m) => m.status === "active");
  const fallback =
    (preferKind ? active.find((m) => m.kind === preferKind) : undefined) ??
    (preferKind ? memberships.find((m) => m.kind === preferKind) : undefined) ??
    active[0] ??
    memberships[0];

  return fallback ?? { kind: "none", isPlatformAdmin };
}
