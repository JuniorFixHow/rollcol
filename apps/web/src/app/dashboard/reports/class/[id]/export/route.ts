import { notFound, redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { classCsv, classWorkbook, fileResponse } from "@/lib/report-files";
import { loadClassReport } from "@/lib/reports";

export async function GET(request: NextRequest, { params }: RouteContext<"/dashboard/reports/class/[id]/export">) {
  const { id } = await params;
  const { supabase, member } = await requireStaff();
  if (member.school.type === "tertiary") redirect("/dashboard/reports");
  const data = await loadClassReport(supabase, member, id, Object.fromEntries(request.nextUrl.searchParams));
  if (!data) notFound();
  const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const name = `${data.klass.name} ${data.view.mode === "all" ? (data.period?.name ?? "attendance") : `${data.view.from} to ${data.view.to}`}`;
  const body = format === "csv" ? classCsv(data.report) : await classWorkbook(data.report, data.heading, data.subjects);
  return fileResponse(body, name, format);
}
