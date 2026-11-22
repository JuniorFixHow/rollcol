import { describe, expect, it } from "vitest";
import { attendanceRate, buildClassReport, buildCourseReport, fileSlug, markLetter, toCsv } from "./reports";

describe("buildClassReport", () => {
  it("counts days, present and late as attended", () => {
    const report = buildClassReport([
      { student_id: "a", full_name: "Ama", school_number: "1", day: "2026-11-02", mark: "present", marks: 1 },
      { student_id: "a", full_name: "Ama", school_number: "1", day: "2026-11-03", mark: "late", marks: 1 },
      { student_id: "a", full_name: "Ama", school_number: "1", day: "2026-11-04", mark: "absent", marks: 0 },
      { student_id: "a", full_name: "Ama", school_number: "1", day: "2026-11-05", mark: null, marks: 0 },
    ]);
    expect(report.days).toHaveLength(4);
    const ama = report.students[0];
    expect(ama?.attended).toBe(2);
    expect(ama?.held).toBe(4);
    expect(ama?.rate).toBe(50);
    expect(ama?.rewardMarks).toBe(2);
  });
});

describe("buildCourseReport", () => {
  it("orders sessions and counts check-ins", () => {
    const report = buildCourseReport([
      { student_id: "s", full_name: "Kofi", school_number: null, session_id: "y", starts_at: "2026-11-03T09:00:00Z", checked_in_at: null, method: null, reward_marks: 0 },
      { student_id: "s", full_name: "Kofi", school_number: null, session_id: "x", starts_at: "2026-11-02T09:00:00Z", checked_in_at: "2026-11-02T09:05:00Z", method: "self", reward_marks: 1 },
    ]);
    expect(report.sessions.map((s) => s.id)).toEqual(["x", "y"]);
    expect(report.students[0]?.attended).toBe(1);
    expect(report.students[0]?.rate).toBe(50);
  });
});

describe("toCsv", () => {
  it("quotes commas and makes formulas plain text", () => {
    expect(toCsv([["Mensah, Ama", "=SUM(A1)", 3, null]])).toBe('"Mensah, Ama",\'=SUM(A1),3,');
  });
});

describe("small helpers", () => {
  it("letters, rates and file names", () => {
    expect(markLetter("late")).toBe("L");
    expect(markLetter(null)).toBe("");
    expect(attendanceRate(0, 0)).toBeNull();
    expect(fileSlug("Basic 4: First Term 2026/27")).toBe("basic-4-first-term-2026-27");
  });
});
