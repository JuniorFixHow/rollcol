import { describe, expect, it } from "vitest";
import { describeDatabaseError } from "../errors";
import { toMember } from "../member";
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

describe("toMember", () => {
  it("returns none when there is no membership", () => {
    expect(toMember(undefined)).toEqual({ kind: "none", isPlatformAdmin: false });
  });
});
