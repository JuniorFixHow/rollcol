import { notFound, redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { courseCsv, courseWorkbook, fileResponse } from "@/lib/report-files";
import { loadCourseReport } from "@/lib/reports";

export async function GET(request: NextRequest, { params }: RouteContext<"/dashboard/reports/course/[id]/export">) {
  const { id } = await params;
  const { supabase, member } = await requireStaff();
  if (member.school.type !== "tertiary") redirect("/dashboard/reports");
  const data = await loadCourseReport(supabase, member, id);
  if (!data) notFound();
  const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const body = format === "csv" ? courseCsv(data.report) : await courseWorkbook(data.report, data.heading);
  return fileResponse(body, `${data.code} ${data.run.period?.name ?? "attendance"}`, format);
}
