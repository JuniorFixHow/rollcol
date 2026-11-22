import { notFound, redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { formatDateTime } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { fileResponse, sessionCsv, sessionWorkbook } from "@/lib/report-files";
import { lowAttendancePercent } from "@/lib/periods";

/** One session's register: who checked in, when and how. */
export async function GET(request: NextRequest, { params }: RouteContext<"/dashboard/sessions/[id]/export">) {
  const { id } = await params;
  const { supabase, member } = await requireStaff();
  if (member.school.type !== "tertiary") redirect("/dashboard");
  const { data: session } = await supabase
    .from("attendance_sessions")
    .select("id, starts_at, voided_at, course_run:course_runs(course:courses(code, title))")
    .eq("id", id)
    .eq("school_id", member.school.id)
    .maybeSingle();
  if (!session) notFound();
  const [{ data: roster, error }, threshold] = await Promise.all([
    supabase.rpc("session_roster", { p_session_id: session.id }),
    lowAttendancePercent(supabase, member.school.id),
  ]);
  if (error) notFound();

  const course = session.course_run?.course;
  const code = course?.code ?? "Session";
  const when = formatDateTime(session.starts_at);
  const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const rows = roster ?? [];
  const body =
    format === "csv"
      ? sessionCsv(rows)
      : await sessionWorkbook(rows, {
          school: member.school.name,
          title: `${code} ${course?.title ?? ""}`.trim(),
          period: `${when}${session.voided_at ? " (cancelled, not counted)" : ""}`,
          threshold,
        });
  return fileResponse(body, `${code} ${session.starts_at.slice(0, 10)}`, format);
}
