import { describe, expect, it } from "vitest";
import { describeDatabaseError } from "../errors";
import { chooseMember, toMemberships } from "../member";
import { academicPeriodSchema, studentRecordSchema } from "./records";
import { schoolCodeSchema, schoolDetailsSchema, schoolIdSchema, schoolIdSignInSchema } from "./school";

describe("schoolIdSchema", () => {
  it("accepts numeric and letters-then-numbers IDs, upper-cased without spaces", () => {
    expect(schoolIdSchema.parse(" 10293847 ")).toBe("10293847");
    expect(schoolIdSchema.parse("ug 1234")).toBe("UG1234");
  });

  it("rejects symbols and very short IDs", () => {
    expect(schoolIdSchema.safeParse("UG-12").success).toBe(false);
    expect(schoolIdSchema.safeParse("A1").success).toBe(false);
  });
});

describe("schoolCodeSchema", () => {
  it("normalises case and spaces", () => {
    expect(schoolCodeSchema.parse("kq2 pcm")).toBe("KQ2PCM");
  });

  it("needs exactly six characters", () => {
    expect(schoolCodeSchema.safeParse("KQ2PC").success).toBe(false);
  });
});

describe("schoolIdSignInSchema", () => {
  it("parses a full sign-in", () => {
    const parsed = schoolIdSignInSchema.parse({ schoolCode: "kq2pcm", schoolId: "ug1234", password: "x" });
    expect(parsed).toEqual({ schoolCode: "KQ2PCM", schoolId: "UG1234", password: "x" });
  });
});

describe("schoolDetailsSchema", () => {
  const base = {
    name: "St Mary's SHS",
    contactPhone: "024 123 4567",
    adminFullName: "Ama Mensah",
    adminSchoolId: "adm1",
  };

  it("needs a register mode for non-tertiary schools", () => {
    expect(schoolDetailsSchema.safeParse({ ...base, type: "non_tertiary" }).success).toBe(false);
    expect(schoolDetailsSchema.safeParse({ ...base, type: "non_tertiary", registerMode: "daily" }).success).toBe(true);
  });

  it("does not need a register mode for tertiary schools and normalises the phone", () => {
    const parsed = schoolDetailsSchema.parse({ ...base, type: "tertiary" });
    expect(parsed.contactPhone).toBe("+233241234567");
  });
});

describe("academicPeriodSchema", () => {
  it("rejects an end date before the start date", () => {
    const result = academicPeriodSchema.safeParse({ name: "First Term", startsOn: "2026-12-01", endsOn: "2026-09-01" });
    expect(result.success).toBe(false);
  });
});

describe("studentRecordSchema", () => {
  it("treats empty school ID and class as none", () => {
    expect(studentRecordSchema.parse({ fullName: "Esi Owusu", schoolId: "", classId: "" })).toEqual({
      fullName: "Esi Owusu",
      schoolId: undefined,
      classId: null,
    });
  });
});

describe("describeDatabaseError", () => {
  it("passes RollCol's own messages through", () => {
    expect(describeDatabaseError({ code: "P0001", message: "This school is suspended. Contact RollCol support." })).toBe(
      "This school is suspended. Contact RollCol support.",
    );
  });

  it("translates known constraints", () => {
    expect(
      describeDatabaseError({
        code: "23505",
        message: 'duplicate key value violates unique constraint "guardians_phone_unique"',
      }),
    ).toBe("Another guardian at this school already uses that phone number.");
  });

  it("falls back on the error code", () => {
    expect(describeDatabaseError({ code: "42501", message: 'new row violates row-level security policy for table "x"' })).toBe(
      "You do not have permission to do that.",
    );
  });
});

describe("memberships", () => {
  const school = (id: string, name: string) => ({
    school_id: id,
    school_name: name,
    school_code: "ABC234",
    school_type: "non_tertiary" as const,
    register_mode: "daily" as const,
    school_status: "verified" as const,
    is_workspace: false,
  });
  const rows = [
    { kind: "student", member_id: "m1", status: "active" as const, role: "teacher" as const, full_name: "Ama", school_number: "ST1", ...school("s1", "Alpha") },
    { kind: "staff", member_id: "m2", status: "active" as const, role: "admin" as const, full_name: "Ama", school_number: "AD1", ...school("s2", "Beta") },
    { kind: "staff", member_id: "m3", status: "disabled" as const, role: "teacher" as const, full_name: "Ama", school_number: "T1", ...school("s3", "Gamma") },
  ];
  const memberships = toMemberships(rows, false);

  it("returns none when there is no membership", () => {
    expect(chooseMember([], true)).toEqual({ kind: "none", isPlatformAdmin: true });
  });

  it("keeps every school", () => {
    expect(memberships.map((m) => m.school.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("opens the chosen school", () => {
    expect(chooseMember(memberships, false, { preferredSchoolId: "s3" }).kind).toBe("staff");
    const chosen = chooseMember(memberships, false, { preferredSchoolId: "s1" });
    expect(chosen.kind === "student" && chosen.school.id).toBe("s1");
  });

  it("prefers an active staff school on the web when the choice does not fit", () => {
    const chosen = chooseMember(memberships, false, { preferredSchoolId: "s1", preferKind: "staff" });
    expect(chosen.kind !== "none" && chosen.school.id).toBe("s2");
  });

  it("ignores a school the person no longer belongs to", () => {
    const chosen = chooseMember(memberships, false, { preferredSchoolId: "gone" });
    expect(chosen.kind !== "none" && chosen.school.id).toBe("s1");
  });
});

describe("register schemas", () => {
  it("reads reward marks, treating blank as none", async () => {
    const { rewardMarksSchema } = await import("./registers");
    expect(rewardMarksSchema.parse("")).toBe(0);
    expect(rewardMarksSchema.parse("2.5")).toBe(2.5);
    expect(rewardMarksSchema.safeParse("-1").success).toBe(false);
    expect(rewardMarksSchema.safeParse("0.3").success).toBe(false);
  });

  it("reads closing times and minutes", async () => {
    const { registerTimingSchema } = await import("./registers");
    expect(registerTimingSchema.parse({ dailyRegisterClosesAt: "09:30:00", periodRegisterMinutes: "45", periodsPerDay: "12" })).toEqual({
      dailyRegisterClosesAt: "09:30",
      periodRegisterMinutes: 45,
      periodsPerDay: 12,
    });
    expect(registerTimingSchema.safeParse({ dailyRegisterClosesAt: "25:00", periodRegisterMinutes: "45", periodsPerDay: "10" }).success).toBe(false);
    expect(registerTimingSchema.safeParse({ dailyRegisterClosesAt: "10:00", periodRegisterMinutes: "5", periodsPerDay: "10" }).success).toBe(false);
    expect(registerTimingSchema.safeParse({ dailyRegisterClosesAt: "10:00", periodRegisterMinutes: "45", periodsPerDay: "21" }).success).toBe(false);
  });

  it("lets a class follow the school's periods when blank", async () => {
    const { classPeriodsSchema } = await import("./registers");
    expect(classPeriodsSchema.parse("")).toBeNull();
    expect(classPeriodsSchema.parse("14")).toBe(14);
    expect(classPeriodsSchema.safeParse("0").success).toBe(false);
  });

  it("builds the marks payload", async () => {
    const { marksToPayload } = await import("./registers");
    expect(marksToPayload({ a: "present", b: null })).toEqual([
      { student_id: "a", mark: "present" },
      { student_id: "b", mark: null },
    ]);
  });
});
