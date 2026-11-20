import type { Database } from "./database.types";

type Enums = Database["public"]["Enums"];
type CurrentMemberRow = Database["public"]["Functions"]["current_member"]["Returns"][number];

export interface MemberSchool {
  id: string;
  name: string;
  code: string;
  type: Enums["school_type"];
  registerMode: Enums["register_mode"] | null;
  status: Enums["school_status"];
}

/** The signed-in account and its school, from the current_member() RPC. */
export type Member =
  | { kind: "none"; isPlatformAdmin: boolean }
  | {
      kind: "staff";
      id: string;
      status: Enums["member_status"];
      role: Enums["staff_role"];
      fullName: string;
      schoolNumber: string;
      school: MemberSchool;
      isPlatformAdmin: boolean;
    }
  | {
      kind: "student";
      id: string;
      status: Enums["member_status"];
      fullName: string;
      schoolNumber: string;
      school: MemberSchool;
      isPlatformAdmin: boolean;
    };

/**
 * current_member() uses left joins, so every column can be null at run time
 * even though the generated types say otherwise. This checks each one.
 */
export function toMember(row: CurrentMemberRow | undefined): Member {
  const isPlatformAdmin = row?.is_platform_admin === true;
  const kind: string | null = row?.kind ?? null;
  const schoolId: string | null = row?.school_id ?? null;
  if (!row || (kind !== "staff" && kind !== "student") || schoolId === null) {
    return { kind: "none", isPlatformAdmin };
  }

  const school: MemberSchool = {
    id: schoolId,
    name: row.school_name,
    code: row.school_code,
    type: row.school_type,
    registerMode: row.register_mode ?? null,
    status: row.school_status,
  };

  if (kind === "staff") {
    return {
      kind,
      id: row.member_id,
      status: row.status,
      role: row.role,
      fullName: row.full_name,
      schoolNumber: row.school_number,
      school,
      isPlatformAdmin,
    };
  }
  return {
    kind,
    id: row.member_id,
    status: row.status,
    fullName: row.full_name,
    schoolNumber: row.school_number ?? "",
    school,
    isPlatformAdmin,
  };
}
