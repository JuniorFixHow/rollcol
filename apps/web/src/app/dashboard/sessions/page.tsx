import { QR_SECONDS, SESSION_MINUTES, SESSION_STATE_LABELS, type SessionState, sessionState } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ActionForm,
  CheckboxField,
  DependsOn,
  FormMessage,
  RadioGroupField,
  SelectField,
  SubmitButton,
  TextField,
} from "@/components/form";
import { Badge, Card, EmptyState, Notice, PageHeader, Table, Td, formatDateTime, formatTime } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { startSession } from "./actions";
import { CurrentLocation } from "./current-location";

export const metadata: Metadata = { title: "Sessions" };

const STATE_TONE: Record<SessionState, "success" | "accent" | "neutral" | "danger"> = {
  open: "success",
  scheduled: "accent",
  ended: "neutral",
  void: "danger",
};

/** "2026-11-27T09:00" in Ghana time (UTC+0), for a datetime-local input. */
function inputTime(date: Date): string {
  return date.toISOString().slice(0, 16);
}

export default async function SessionsPage() {
  const { supabase, member } = await requireStaff();
  const { school } = member;
  if (school.type !== "tertiary") redirect("/dashboard/registers");
  const isAdmin = member.role === "admin";
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const { data: semester } = await supabase
    .from("academic_periods")
    .select("id, name, starts_on, ends_on")
    .eq("school_id", school.id)
    .lte("starts_on", today)
    .gte("ends_on", today)
    .maybeSingle();

  const [{ data: runs }, { data: venues }, { data: sessions }, { data: rules }] = await Promise.all([
    semester
      ? supabase
          .from("course_runs")
          .select("id, course:courses(code, title), course_run_staff(staff_id)")
          .eq("academic_period_id", semester.id)
      : Promise.resolve({ data: [] }),
    supabase.rpc("school_venues", { p_school_id: school.id }),
    supabase
      .from("attendance_sessions")
      .select(
        "id, starts_at, ends_at, voided_at, qr_required, radius_m, reward_marks, venue:venues(name), course_run:course_runs(course:courses(code, title), enrolments(count)), session_checkins(count)",
      )
      .eq("school_id", school.id)
      .gte("ends_at", new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .order("starts_at", { ascending: false })
      .limit(60),
    supabase.from("school_settings").select("lecturers_add_venues").eq("school_id", school.id).maybeSingle(),
  ]);
  const canAddVenues = isAdmin || (rules?.lecturers_add_venues ?? true);

  const myRuns = (runs ?? [])
    .filter((run) => isAdmin || run.course_run_staff.some((row) => row.staff_id === member.id))
    .sort((a, b) => (a.course?.code ?? "").localeCompare(b.course?.code ?? ""));
  const list = (sessions ?? []).map((session) => ({ ...session, state: sessionState(session, now) }));
  const current = list.filter((s) => s.state === "open" || s.state === "scheduled").reverse();
  const past = list.filter((s) => s.state === "ended" || s.state === "void");

  return (
    <>
      <PageHeader
        title="Sessions"
        description="Open a session and students check in from the RollCol app. You can also start sessions from the app, which uses your phone's location."
      />

      <div className="space-y-6">
        {current.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Open and scheduled</h2>
            <SessionTable sessions={current} />
          </section>
        ) : null}

        {!semester ? (
          <Notice tone="warning" title="No semester today">
            Sessions belong to a semester. {isAdmin ? "Add one on the Semesters page." : "Ask an admin to add the current semester."}
          </Notice>
        ) : myRuns.length === 0 ? (
          <Notice tone="neutral" title="No courses to run">
            {isAdmin
              ? `No courses are set up for ${semester.name}. Add them on the Courses page.`
              : `You are not a lecturer on any course in ${semester.name}. Ask an admin to add you on the Courses page.`}
          </Notice>
        ) : (
          <Card title="Start a session" description={`${semester.name}. Students get a notification when it opens.`}>
            <ActionForm action={startSession} className="grid items-start gap-4 sm:grid-cols-2">
              <SelectField
                name="courseRunId"
                label="Course"
                placeholder="Choose a course"
                defaultValue={myRuns.length === 1 ? myRuns[0]?.id : undefined}
                options={myRuns.map((run) => ({ value: run.id, label: `${run.course?.code}: ${run.course?.title}` }))}
              />
              <TextField
                name="minutes"
                label="Open for (minutes)"
                type="number"
                inputMode="numeric"
                min={String(SESSION_MINUTES.min)}
                max={String(SESSION_MINUTES.max)}
                step="1"
                defaultValue={String(SESSION_MINUTES.default)}
              />
              <SelectField
                name="venueId"
                label="Where"
                defaultValue={(venues ?? [])[0]?.id ?? "current"}
                options={[
                  ...(venues ?? []).map((venue) => ({
                    value: venue.id,
                    label: `${venue.name} (${venue.radius_m} m)${venue.verified ? "" : ", unverified"}`,
                  })),
                  { value: "current", label: "My current location (this device)" },
                  { value: "none", label: "No location check (rotating code only)" },
                ]}
                hint={canAddVenues ? "Hall not listed? Add it on the Venues page." : "Admins add halls on the Venues page."}
              />
              <TextField
                name="radius"
                label="Radius (metres, optional)"
                type="number"
                inputMode="numeric"
                min="50"
                max="1000"
                step="1"
                placeholder="Venue's radius, or 75"
              />
              <DependsOn field="venueId" equals="current" initially={(venues ?? []).length === 0}>
                <CurrentLocation />
              </DependsOn>
              <TextField
                name="rewardMarks"
                label="Marks (optional)"
                type="number"
                inputMode="decimal"
                min="0"
                max="100"
                step="0.25"
                placeholder="0"
                hint="Added to each student who attends."
              />
              <div />
              <div className="sm:col-span-2">
                <CheckboxField
                  name="qrRequired"
                  label="Rotating code"
                  description="An extra check against cheating: students also scan a code you show on a projector or screen."
                  confirmOnCheck={{
                    title: "Use a rotating code?",
                    message:
                      "An extra layer of security against cheating. As well as checking each student's phone and location, students must scan a code that changes every few seconds, so a photo sent from class does not work.\n\nYou need to show the code on a projector, TV or screen in the room for the whole session. If you cannot show it, leave this off.",
                    confirmLabel: "Use rotating code",
                  }}
                />
              </div>
              <DependsOn field="qrRequired" checked initially={false}>
                <TextField
                  name="qrSeconds"
                  label="Code changes every (seconds)"
                  type="number"
                  inputMode="numeric"
                  min={String(QR_SECONDS.min)}
                  max={String(QR_SECONDS.max)}
                  step="1"
                  defaultValue={String(QR_SECONDS.default)}
                  hint={`From ${QR_SECONDS.min} to ${QR_SECONDS.max}. Shorter is harder to share.`}
                />
                <div />
              </DependsOn>
              <RadioGroupField
                name="when"
                label="Start"
                defaultValue="now"
                options={[
                  { value: "now", label: "Now" },
                  { value: "later", label: "Later" },
                ]}
              />
              <DependsOn field="when" equals="later" initially={false}>
                <TextField name="startsAt" label="Start time" type="datetime-local" min={inputTime(now)} hint="Ghana time." />
              </DependsOn>
              <div className="space-y-3 sm:col-span-2">
                <FormMessage />
                <SubmitButton pendingLabel="Starting...">Start session</SubmitButton>
              </div>
            </ActionForm>
          </Card>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Past two weeks</h2>
          {past.length === 0 ? <EmptyState>No sessions yet.</EmptyState> : <SessionTable sessions={past} />}
        </section>
      </div>
    </>
  );
}

interface Row {
  id: string;
  starts_at: string;
  ends_at: string;
  state: SessionState;
  qr_required: boolean;
  radius_m: number | null;
  venue: { name: string } | null;
  course_run: { course: { code: string; title: string } | null; enrolments: { count: number }[] } | null;
  session_checkins: { count: number }[];
}

function SessionTable({ sessions }: { sessions: Row[] }) {
  return (
    <Table search="Search by course or venue" headers={["Course", "When", "Where", "Checked in", "Status"]}>
      {sessions.map((session) => {
        const present = session.session_checkins[0]?.count ?? 0;
        const enrolled = session.course_run?.enrolments[0]?.count ?? 0;
        return (
          <tr key={session.id}>
            <Td>
              <Link href={`/dashboard/sessions/${session.id}`} className="font-medium text-accent hover:underline">
                {session.course_run?.course?.code ?? "Course"}
              </Link>
              <span className="block text-xs text-muted">{session.course_run?.course?.title}</span>
            </Td>
            <Td className="text-sm whitespace-nowrap">
              {formatDateTime(session.starts_at)}
              <span className="block text-xs text-muted">until {formatTime(session.ends_at)}</span>
            </Td>
            <Td className="text-sm">
              {session.venue?.name ?? (session.radius_m ? "Lecturer's location" : "No location check")}
              {session.qr_required ? <span className="block text-xs text-muted">Rotating code</span> : null}
            </Td>
            <Td className="text-sm tabular-nums">
              {present} of {enrolled}
            </Td>
            <Td>
              <Badge tone={STATE_TONE[session.state]}>{SESSION_STATE_LABELS[session.state]}</Badge>
            </Td>
          </tr>
        );
      })}
    </Table>
  );
}
