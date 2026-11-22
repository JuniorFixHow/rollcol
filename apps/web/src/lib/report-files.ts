import "server-only";
import {
  type ClassReport,
  type CourseReport,
  fileSlug,
  isBelow,
  markLetter,
  toCsv,
} from "@rollcol/shared";
import ExcelJS from "exceljs";

/** Ghana time (UTC+0) labels for column headings. */
const dayLabel = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const timeLabel = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });

function day(iso: string): string {
  return dayLabel.format(new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)).replace(",", "");
}

const FILL = {
  P: "FFDCF2E3",
  L: "FFFBEFD5",
  A: "FFF8DADA",
  header: "FFE8EEF3",
  below: "FFFDE7E7",
} as const;

/** Wide registers print landscape, all columns on one page width. */
const WIDE: Partial<ExcelJS.PageSetup> = {
  orientation: "landscape",
  paperSize: 9,
  fitToPage: true,
  fitToWidth: 1,
  fitToHeight: 0,
};

function solid(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

interface Heading {
  school: string;
  title: string;
  period: string;
  threshold: number;
}

/** School, report title and period at the top of a sheet, then a blank line. */
function addHeading(sheet: ExcelJS.Worksheet, heading: Heading, width: number) {
  const rows = [heading.school, heading.title, heading.period];
  rows.forEach((text, index) => {
    const row = sheet.addRow([text]);
    row.font = { bold: index < 2, size: index === 0 ? 14 : 12 };
    sheet.mergeCells(row.number, 1, row.number, Math.max(2, width));
  });
  sheet.addRow([]);
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.alignment = { vertical: "middle", wrapText: true };
  row.eachCell((cell) => {
    cell.fill = solid(FILL.header);
    cell.border = { bottom: { style: "thin", color: { argb: "FF9AA5B1" } } };
  });
}

async function toBuffer(workbook: ExcelJS.Workbook): Promise<ArrayBuffer> {
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer instanceof ArrayBuffer ? buffer : new Uint8Array(buffer).slice().buffer;
}

function newWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RollCol";
  workbook.created = new Date();
  return workbook;
}

/* -------------------------------------------------------------------------- */
/* Class term (basic and senior high schools)                                 */
/* -------------------------------------------------------------------------- */

export interface SubjectRow {
  full_name: string;
  subject: string;
  held: number;
  present: number;
  late: number;
  absent: number;
}

export async function classWorkbook(report: ClassReport, heading: Heading, subjects: SubjectRow[]): Promise<ArrayBuffer> {
  const workbook = newWorkbook();

  // Register: like the register book. P present, L late, A absent.
  const register = workbook.addWorksheet("Register", { views: [{ state: "frozen", xSplit: 3, ySplit: 5 }], pageSetup: WIDE });
  const fixed = ["No.", "Name", "School ID"];
  const totals = ["Present", "Late", "Absent", "Attendance", "%", "Marks"];
  addHeading(register, heading, fixed.length + report.days.length + totals.length);
  styleHeader(register.addRow([...fixed, ...report.days.map(day), ...totals]));
  report.students.forEach((student, index) => {
    const row = register.addRow([
      index + 1,
      student.name,
      student.schoolNumber ?? "",
      ...report.days.map((d) => markLetter(student.marks[d] ?? null)),
      student.present,
      student.late,
      student.absent,
      `${student.attended} out of ${student.held}`,
      student.rate ?? "",
      student.rewardMarks,
    ]);
    report.days.forEach((_, dayIndex) => {
      const cell = row.getCell(fixed.length + dayIndex + 1);
      const letter = String(cell.value ?? "");
      if (letter === "P" || letter === "L" || letter === "A") cell.fill = solid(FILL[letter]);
      cell.alignment = { horizontal: "center" };
    });
    if (isBelow(student.rate, heading.threshold)) row.getCell(fixed.length + report.days.length + 5).fill = solid(FILL.below);
  });
  register.getColumn(1).width = 5;
  register.getColumn(2).width = 28;
  register.getColumn(3).width = 13;
  report.days.forEach((_, index) => {
    register.getColumn(fixed.length + index + 1).width = 6.5;
  });
  totals.forEach((_, index) => {
    register.getColumn(fixed.length + report.days.length + index + 1).width = index === 3 ? 14 : 9;
  });
  register.addRow([]);
  register.addRow(["P present, L late, A absent. Present and late both count towards attendance."]);

  // Report cards: the line for each pupil's terminal report.
  const cards = workbook.addWorksheet("Report card line", { views: [{ state: "frozen", ySplit: 5 }] });
  addHeading(cards, heading, 5);
  styleHeader(cards.addRow(["Name", "School ID", "Attendance", "%", `Below ${heading.threshold}%`]));
  for (const student of report.students) {
    cards.addRow([
      student.name,
      student.schoolNumber ?? "",
      `${student.attended} out of ${student.held}`,
      student.rate ?? "",
      isBelow(student.rate, heading.threshold) ? "Yes" : "",
    ]);
  }
  cards.getColumn(1).width = 30;
  cards.getColumn(2).width = 13;
  cards.getColumn(3).width = 16;
  cards.getColumn(4).width = 8;
  cards.getColumn(5).width = 12;

  if (subjects.length > 0) {
    const sheet = workbook.addWorksheet("Subjects", { views: [{ state: "frozen", ySplit: 5 }] });
    addHeading(sheet, heading, 6);
    styleHeader(sheet.addRow(["Name", "Subject", "Lessons", "Present", "Late", "Absent"]));
    for (const row of subjects) sheet.addRow([row.full_name, row.subject, row.held, row.present, row.late, row.absent]);
    [30, 24, 10, 10, 8, 9].forEach((width, index) => {
      sheet.getColumn(index + 1).width = width;
    });
  }

  return toBuffer(workbook);
}

export function classCsv(report: ClassReport): string {
  return toCsv([
    ["Name", "School ID", ...report.days, "Present", "Late", "Absent", "Attendance", "%", "Marks"],
    ...report.students.map((s) => [
      s.name,
      s.schoolNumber,
      ...report.days.map((d) => markLetter(s.marks[d] ?? null)),
      s.present,
      s.late,
      s.absent,
      `${s.attended} out of ${s.held}`,
      s.rate,
      s.rewardMarks,
    ]),
  ]);
}

/* -------------------------------------------------------------------------- */
/* Course semester (tertiary)                                                 */
/* -------------------------------------------------------------------------- */

function sessionLabel(iso: string): string {
  return `${day(iso)} ${timeLabel.format(new Date(iso))}`;
}

export async function courseWorkbook(report: CourseReport, heading: Heading): Promise<ArrayBuffer> {
  const workbook = newWorkbook();
  const sheet = workbook.addWorksheet("Attendance", { views: [{ state: "frozen", xSplit: 3, ySplit: 5 }], pageSetup: WIDE });
  const fixed = ["No.", "Name", "School ID"];
  const totals = ["Attended", "Sessions", "%", "Marks"];
  addHeading(sheet, heading, fixed.length + report.sessions.length + totals.length);
  styleHeader(sheet.addRow([...fixed, ...report.sessions.map((s) => sessionLabel(s.startsAt)), ...totals]));
  report.students.forEach((student, index) => {
    const row = sheet.addRow([
      index + 1,
      student.name,
      student.schoolNumber ?? "",
      ...report.sessions.map((s) => {
        const method = student.sessions[s.id];
        return method === "manual" ? "P*" : method ? "P" : "A";
      }),
      student.attended,
      student.held,
      student.rate ?? "",
      student.rewardMarks,
    ]);
    report.sessions.forEach((_, sessionIndex) => {
      const cell = row.getCell(fixed.length + sessionIndex + 1);
      cell.fill = solid(String(cell.value).startsWith("P") ? FILL.P : FILL.A);
      cell.alignment = { horizontal: "center" };
    });
    if (isBelow(student.rate, heading.threshold)) row.getCell(fixed.length + report.sessions.length + 3).fill = solid(FILL.below);
  });
  sheet.getColumn(1).width = 5;
  sheet.getColumn(2).width = 28;
  sheet.getColumn(3).width = 13;
  report.sessions.forEach((_, index) => {
    sheet.getColumn(fixed.length + index + 1).width = 11;
  });
  totals.forEach((_, index) => {
    sheet.getColumn(fixed.length + report.sessions.length + index + 1).width = 10;
  });
  sheet.addRow([]);
  sheet.addRow(["P checked in, P* added by the lecturer, A absent. Cancelled sessions are not included."]);
  return toBuffer(workbook);
}

export function courseCsv(report: CourseReport): string {
  return toCsv([
    ["Name", "School ID", ...report.sessions.map((s) => sessionLabel(s.startsAt)), "Attended", "Sessions", "%", "Marks"],
    ...report.students.map((s) => [
      s.name,
      s.schoolNumber,
      ...report.sessions.map((session) => {
        const method = s.sessions[session.id];
        return method === "manual" ? "P*" : method ? "P" : "A";
      }),
      s.attended,
      s.held,
      s.rate,
      s.rewardMarks,
    ]),
  ]);
}

/* -------------------------------------------------------------------------- */
/* One session                                                                */
/* -------------------------------------------------------------------------- */

export interface SessionRosterRow {
  full_name: string;
  school_number: string | null;
  checked_in_at: string | null;
  method: string | null;
  distance_m: number | null;
  reason: string | null;
}

function sessionRows(rows: SessionRosterRow[]): (string | number | null)[][] {
  return rows.map((row) => [
    row.full_name,
    row.school_number,
    row.checked_in_at ? "Present" : "Absent",
    row.checked_in_at ? timeLabel.format(new Date(row.checked_in_at)) : null,
    row.method === "manual" ? "Added by lecturer" : row.method === "self" ? "Checked in" : null,
    row.distance_m === null ? null : Math.round(row.distance_m),
    row.reason,
  ]);
}

const SESSION_HEADERS = ["Name", "School ID", "Status", "Time", "How", "Distance (m)", "Reason"];

export async function sessionWorkbook(rows: SessionRosterRow[], heading: Heading): Promise<ArrayBuffer> {
  const workbook = newWorkbook();
  const sheet = workbook.addWorksheet("Session", { views: [{ state: "frozen", ySplit: 5 }] });
  addHeading(sheet, heading, SESSION_HEADERS.length);
  styleHeader(sheet.addRow(SESSION_HEADERS));
  for (const values of sessionRows(rows)) {
    const row = sheet.addRow(values);
    row.getCell(3).fill = solid(values[2] === "Present" ? FILL.P : FILL.A);
  }
  [30, 13, 10, 8, 18, 12, 40].forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  return toBuffer(workbook);
}

export function sessionCsv(rows: SessionRosterRow[]): string {
  return toCsv([SESSION_HEADERS, ...sessionRows(rows)]);
}

/* -------------------------------------------------------------------------- */
/* Responses                                                                  */
/* -------------------------------------------------------------------------- */

export function fileResponse(body: ArrayBuffer | string, name: string, format: "xlsx" | "csv"): Response {
  const filename = `${fileSlug(name)}.${format}`;
  return new Response(format === "csv" ? `﻿${String(body)}` : body, {
    headers: {
      "Content-Type":
        format === "csv" ? "text/csv; charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function dayLabelFor(iso: string): string {
  return day(iso);
}
