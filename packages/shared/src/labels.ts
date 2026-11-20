import type { RegisterMode, SchoolType, StaffRole } from "./constants";

/** "term" for basic and secondary schools, "semester" for tertiary schools. */
export function periodWord(type: SchoolType): "term" | "semester" {
  return type === "tertiary" ? "semester" : "term";
}

export function periodWordTitle(type: SchoolType): "Term" | "Semester" {
  return type === "tertiary" ? "Semester" : "Term";
}

/** Tertiary teaching staff are lecturers. */
export function staffRoleLabel(role: StaffRole, type: SchoolType): string {
  if (role === "admin") return "Admin";
  return type === "tertiary" ? "Lecturer" : "Teacher";
}

export function schoolTypeLabel(type: SchoolType): string {
  return type === "tertiary" ? "Tertiary (university, college, polytechnic)" : "Basic or senior high school";
}

export function registerModeLabel(mode: RegisterMode): string {
  return mode === "daily" ? "Once a day by the class teacher" : "Every subject period";
}
