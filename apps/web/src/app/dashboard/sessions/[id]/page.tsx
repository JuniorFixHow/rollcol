import { SESSION_STATE_LABELS, sessionState } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InlineAction } from "@/components/form";
import { ReasonAction } from "@/components/reason-action";
import { ReportDownloads } from "@/components/report-downloads";
import { Badge, Card, EmptyState, Notice, PageHeader, Table, Td, formatDateTime, formatTime } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { addCheckin, cancelScheduled, endSession, removeCheckin, voidSession } from "../actions";
import { Countdown, LiveRefresh, RotatingQr } from "./live";

export const metadata: Metadata = { title: "Session" };

const ACTION_LABELS: Record<string, string> = {
  manual_add: "Marked present",
  remove: "Check-in removed",
  end_early: "Ended early",
  void: "Cancelled",
};

const CORRECTION_DAYS = 14;

export default async function SessionPage({ params }: PageProps<"/dashboard/sessions/[id]">) {
  const { id } = await params;
  const { supabase, member } = await requireStaff();

  const { data: session } = await supabase
    .from("attendance_sessions")
    .select(
      "id, school_id, starts_at, ends_at, voided_at, void_reason, qr_required, qr_seconds, radius_m, reward_marks, venue:venues(name), course_run:course_runs(course:courses(code, title))",
    )
    .eq("id", id)
    .eq("school_id", member.school.id)
    .maybeSingle();
  if (!session) notFound();

  const [{ data: roster, error }, { data: history }, { data: rules }] = await Promise.all([
    supabase.rpc("session_roster", { p_session_id: id }),
    supabase
      .from("session_adjustments")
      .select("id, action, reason, created_at, student:students(full_name), staff:staff(full_name)")
      .eq("session_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("school_settings")
      .select("lecturers_remove_self_checkins, lecturers_add_after_end")
      .eq("school_id", member.school.id)
      .maybeSingle(),
  ]);
  // Only the course's lecturers and admins may run it.
  if (error) notFound();

  const now = new Date();
  const state = sessionState(session, now);
  const course = session.course_run?.course;
  const present = (roster ?? []).filter((row) => row.checked_in_at !== null);
  const isAdmin = member.role === "admin";
  // Admins can always correct. Lecturers follow the school's rules on the Settings page.
  const canRemoveSelf = isAdmin || (rules?.lecturers_remove_self_checkins ?? false);
  const canChangeAfterEnd = isAdmin || (rules?.lecturers_add_after_end ?? false);
  const withinWindow = new Date(session.ends_at).getTime() > now.getTime() - CORRECTION_DAYS * 24 * 60 * 60 * 1000;
  const correctable =
    (state === "open" || (state === "ended" && canChangeAfterEnd && withinWindow));
  const where = session.venue?.name ?? (session.radius_m ? "Lecturer's location" : "No location check");
  const tone = state === "open" ? "success" : state === "scheduled" ? "accent" : state === "void" ? "danger" : "neutral";

  return (
    <>
      <LiveRefresh sessionId={session.id} changesAt={[session.starts_at, session.ends_at]} />
      <PageHeader
        title={`${course?.code ?? "Session"}${course?.title ? `: ${course.title}` : ""}`}
        description={
          <>
            {formatDateTime(session.starts_at)} to {formatTime(session.ends_at)} · {where}
            {session.radius_m ? ` (${session.radius_m} m)` : ""}
            {session.reward_marks > 0 ? ` · ${session.reward_marks} marks` : ""} ·{" "}
            <Link href="/dashboard/sessions" className="text-accent hover:underline">
              All sessions
            </Link>
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {state === "open" || state === "ended" ? (
              <ReportDownloads href={`/dashboard/sessions/${session.id}/export`} print={false} />
            ) : null}
            <Badge tone={tone}>{SESSION_STATE_LABELS[state]}</Badge>
          </div>
        }
      />

      <div className="space-y-6">
        {state === "void" ? (
          <Notice tone="danger" title="This session was cancelled">
            It does not count for attendance or marks. Reason: {session.void_reason}
          </Notice>
        ) : null}

        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <Card>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm text-muted">Checked in</p>
                <p className="mt-1 text-4xl font-semibold tabular-nums">
                  {present.length}
                  <span className="text-xl text-muted"> of {(roster ?? []).length}</span>
                </p>
                <p className="mt-1 text-sm text-muted">
                  {state === "open" ? (
                    <Countdown endsAt={session.ends_at} />
                  ) : state === "scheduled" ? (
                    `Opens at ${formatTime(session.starts_at)}`
                  ) : (
                    "Closed"
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {state === "open" ? (
                  <InlineAction
                    action={endSession}
                    hidden={{ sessionId: session.id }}
                    label="End now"
                    confirm="End this session now? Students who have not checked in can no longer do so. You can still add students by hand."
                  />
                ) : null}
                {state === "scheduled" ? (
                  <InlineAction
                    action={cancelScheduled}
                    hidden={{ sessionId: session.id }}
                    label="Cancel"
                    variant="danger"
                    confirm="Cancel this scheduled session? It is removed, and students are not notified."
                  />
                ) : null}
                {state === "open" || state === "ended" ? (
                  <ReasonAction
                    action={voidSession}
                    hidden={{ sessionId: session.id }}
                    label="Cancel session"
                    variant="danger"
                    title="Cancel this session?"
                    message="It will not count for attendance or marks. Students who checked in are told, with your reason."
                    placeholder="Opened for the wrong course"
                  />
                ) : null}
              </div>
            </div>
          </Card>

          {session.qr_required && state === "open" ? (
            <Card className="md:w-80">
              <RotatingQr sessionId={session.id} />
              <p className="mt-2 text-center text-xs text-muted">
                Show this on the projector. It changes every {session.qr_seconds} seconds.
              </p>
            </Card>
          ) : null}
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Students</h2>
          {(roster ?? []).length === 0 ? (
            <EmptyState>Nobody is registered for this course yet. Students join it in the RollCol app.</EmptyState>
          ) : (
            <Table search="Search by name or school ID" headers={["Student", "Status", ""]}>
              {(roster ?? []).map((row) => (
                <tr key={row.student_id}>
                  <Td>
                    <span className="block font-medium">{row.full_name}</span>
                    <span className="block font-mono text-xs text-muted">
                      {row.school_number ?? "No school ID"}
                      {row.has_app ? "" : " · no app account"}
                    </span>
                  </Td>
                  <Td className="text-sm">
                    {row.checked_in_at ? (
                      <>
                        <Badge tone="success">{row.method === "manual" ? "Added by hand" : "Checked in"}</Badge>
                        <span className="mt-1 block text-xs text-muted">
                          {formatTime(row.checked_in_at)}
                          {row.distance_m !== null ? ` · ${Math.round(row.distance_m)} m away` : ""}
                          {row.reason ? ` · ${row.reason}` : ""}
                        </span>
                      </>
                    ) : (
                      <Badge>{state === "open" || state === "scheduled" ? "Not yet" : "Missed"}</Badge>
                    )}
                  </Td>
                  <Td>
                    {correctable ? (
                      <div className="flex justify-end">
                        {row.checked_in_at && row.method === "self" && !canRemoveSelf ? null : row.checked_in_at ? (
                          <ReasonAction
                            action={removeCheckin}
                            hidden={{ sessionId: session.id, studentId: row.student_id }}
                            label="Remove"
                            variant="ghost"
                            title={`Remove ${row.full_name}'s check-in?`}
                            message="They will be counted as absent, and told with your reason."
                            placeholder="Not in class"
                          />
                        ) : (
                          <ReasonAction
                            action={addCheckin}
                            hidden={{ sessionId: session.id, studentId: row.student_id }}
                            label="Mark present"
                            title={`Mark ${row.full_name} present?`}
                            message="For example, when their new phone is in its 48 hours, or their battery died. They are told, with your reason."
                            placeholder="New phone not active yet"
                          />
                        )}
                      </div>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
          {state === "ended" && !canChangeAfterEnd ? (
            <p className="text-xs text-muted">
              Your school only lets admins change attendance after a session ends.
            </p>
          ) : state === "ended" && !withinWindow ? (
            <p className="text-xs text-muted">Sessions can be corrected for {CORRECTION_DAYS} days after they end.</p>
          ) : null}
          {!canRemoveSelf && state !== "void" && state !== "scheduled" ? (
            <p className="text-xs text-muted">
              Students who checked in themselves passed every check (their own phone, location
              {session.qr_required ? " and the rotating code" : ""}), so only an admin can remove them.
            </p>
          ) : null}
        </section>

        {(history ?? []).length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Changes</h2>
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
              {(history ?? []).map((item) => (
                <li key={item.id} className="px-4 py-3">
                  <span className="font-medium">{ACTION_LABELS[item.action] ?? item.action}</span>
                  {item.student ? `: ${item.student.full_name}` : ""}
                  <span className="block text-xs text-muted">
                    {formatDateTime(item.created_at)} by {item.staff?.full_name ?? "a former staff member"} · {item.reason}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
