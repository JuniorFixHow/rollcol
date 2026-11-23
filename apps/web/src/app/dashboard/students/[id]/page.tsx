import { SMS_POLICY, formatPhoneForDisplay, quietHoursText } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, FieldButton, FormMessage, InlineAction, SelectField, SubmitButton, TextField } from "@/components/form";
import { Badge, Card, EmptyState, Notice, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { visibleClassIds } from "@/lib/queries";
import { sendStudentMessage } from "../../messages/actions";
import { MessageComposer } from "../../messages/message-composer";
import { AttendanceRecord } from "./attendance-record";
import {
  addGuardian,
  deleteStudent,
  removeGuardianLink,
  setGuardianLinkOption,
  setStudentStatus,
  updateGuardian,
  updateStudent,
} from "../actions";

export const metadata: Metadata = { title: "Student" };

export default async function StudentPage({ params }: PageProps<"/dashboard/students/[id]">) {
  const { id } = await params;
  const { supabase, member } = await requireStaff();
  const { school } = member;
  const isAdmin = member.role === "admin";
  const tertiary = school.type === "tertiary";

  const { data: student } = await supabase
    .from("students")
    .select("id, full_name, school_number, status, source, class_id, programme_id, batch_id, user_id, class:classes(name)")
    .eq("id", id)
    .eq("school_id", school.id)
    .maybeSingle();
  if (!student) notFound();

  const visible = tertiary ? "all" : await visibleClassIds(supabase, member);
  if (visible !== "all" && (!student.class_id || !visible.includes(student.class_id))) notFound();

  const { data: features } = tertiary ? { data: null } : await supabase.rpc("school_features", { p_school_id: school.id });
  const canMessage = !tertiary && features?.[0]?.sms === true && student.status === "active";
  const [
    { data: links },
    { data: delegation },
    { data: classes },
    { data: programmes },
    { data: batches },
    { data: smsSettings },
    balance,
    { data: notReached },
  ] = await Promise.all([
    tertiary
      ? Promise.resolve({ data: [] })
      : supabase
          .from("guardian_links")
          .select(
            "id, relationship, alerts_enabled, receives_present_alerts, guardian:guardians(id, full_name, phone, broadcasts_enabled, guardian_links(count))",
          )
          .eq("student_id", student.id)
          .order("created_at"),
    isAdmin || tertiary
      ? Promise.resolve({ data: null })
      : supabase
          .from("guardian_delegations")
          .select("expires_at")
          .eq("staff_id", member.id)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle(),
    isAdmin && !tertiary
      ? supabase.from("classes").select("id, name").eq("school_id", school.id).is("archived_at", null).order("name")
      : Promise.resolve({ data: [] }),
    isAdmin && tertiary
      ? supabase.from("programmes").select("id, name").eq("school_id", school.id).order("name")
      : Promise.resolve({ data: [] }),
    isAdmin && tertiary
      ? supabase.from("batches").select("id, name, programme_id").eq("school_id", school.id).order("name")
      : Promise.resolve({ data: [] }),
    canMessage
      ? supabase.from("school_settings").select("sms_name, sms_quiet_hours, sms_quiet_start, sms_quiet_end").eq("school_id", school.id).maybeSingle()
      : Promise.resolve({ data: null }),
    canMessage && isAdmin
      ? supabase.rpc("sms_credit_balance", { p_school_id: school.id }).then((r) => r.data ?? 0)
      : Promise.resolve(null),
    tertiary ? Promise.resolve({ data: [] }) : supabase.rpc("guardians_not_reached", { p_student_id: student.id }),
  ]);
  const quietNote = smsSettings
    ? quietHoursText({ on: smsSettings.sms_quiet_hours, start: smsSettings.sms_quiet_start, end: smsSettings.sms_quiet_end })
    : null;
  const unreachable = new Set((notReached ?? []).map((row) => row.guardian_id));
  const alertGuardians = (links ?? []).filter((link) => link.alerts_enabled).length;

  // The database enforces the same rule; this only decides what to show.
  const canManageGuardians = !tertiary && (isAdmin || delegation !== null);
  const editable = isAdmin && student.source === "rollcol";
  const programmeName = new Map((programmes ?? []).map((p) => [p.id, p.name]));

  return (
    <>
      <PageHeader
        title={student.full_name}
        description={
          <>
            {student.school_number ? <span className="font-mono">{student.school_number}</span> : "No school ID"}
            {student.class ? ` · ${student.class.name}` : null}
            {" · "}
            <Link href="/dashboard/students" className="text-accent hover:underline">
              All students
            </Link>
          </>
        }
        actions={
          student.status === "pending" ? (
            <Badge tone="warning">Waiting for approval</Badge>
          ) : student.status === "disabled" ? (
            <Badge tone="danger">Turned off</Badge>
          ) : null
        }
      />

      <div className="space-y-6">
        {student.source === "stediis" ? (
          <Notice tone="neutral">This student is managed in Stediis. Change their details there.</Notice>
        ) : null}

        <AttendanceRecord
          supabase={supabase}
          member={member}
          student={{ id: student.id, class_id: student.class_id, first_name: student.full_name.split(" ")[0] ?? student.full_name }}
        />

        {tertiary ? null : (
          <Card
            title="Guardians"
            description="Guardians get attendance alerts by SMS. They are told by SMS whenever they are added or removed, their number changes, or alerts are turned off or on. If the last SMS did not reach a guardian, check their number."
          >
            {(links ?? []).length === 0 ? (
              <EmptyState>No guardians yet. Without a guardian, nobody is alerted about this student.</EmptyState>
            ) : (
              <ul className="divide-y divide-line rounded-md border border-line">
                {(links ?? []).map((link) => {
                  const guardian = link.guardian;
                  if (!guardian) return null;
                  const linkedCount = guardian.guardian_links[0]?.count ?? 0;
                  return (
                    <li key={link.id} className="space-y-3 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {guardian.full_name}
                            {link.relationship ? <span className="font-normal text-muted"> ({link.relationship})</span> : null}
                          </p>
                          <p className="font-mono text-sm text-muted">{formatPhoneForDisplay(guardian.phone)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {unreachable.has(guardian.id) ? <Badge tone="danger">Last SMS not delivered</Badge> : null}
                          {link.alerts_enabled ? <Badge tone="success">Alerts on</Badge> : <Badge tone="warning">Alerts off</Badge>}
                          {link.receives_present_alerts ? <Badge tone="accent">Daily present alerts</Badge> : null}
                          {!guardian.broadcasts_enabled ? <Badge>No broadcasts</Badge> : null}
                          {isAdmin && linkedCount > SMS_POLICY.guardianLinkFlagThreshold ? (
                            <Badge tone="danger">Linked to {linkedCount} students</Badge>
                          ) : null}
                        </div>
                      </div>

                      {canManageGuardians ? (
                        <div className="flex flex-wrap gap-2">
                          <InlineAction
                            action={setGuardianLinkOption}
                            hidden={{ linkId: link.id, option: "alerts", on: String(!link.alerts_enabled) }}
                            label={link.alerts_enabled ? "Turn alerts off" : "Turn alerts on"}
                          />
                          <InlineAction
                            action={setGuardianLinkOption}
                            hidden={{
                              linkId: link.id,
                              studentId: student.id,
                              option: "present",
                              on: String(!link.receives_present_alerts),
                            }}
                            label={link.receives_present_alerts ? "Stop daily present alerts" : "Send daily present alerts"}
                          />
                          <InlineAction
                            action={setGuardianLinkOption}
                            hidden={{ linkId: link.id, guardianId: guardian.id, option: "broadcasts", on: String(!guardian.broadcasts_enabled) }}
                            label={guardian.broadcasts_enabled ? "Stop school broadcasts" : "Allow school broadcasts"}
                          />
                          <InlineAction
                            action={removeGuardianLink}
                            hidden={{ linkId: link.id }}
                            label="Remove"
                            variant="ghost"
                            confirm={`Remove ${guardian.full_name} as a guardian of ${student.full_name}? They will get an SMS to say so.`}
                          />
                        </div>
                      ) : null}

                      {canManageGuardians ? (
                        <details className="text-sm">
                          <summary className="cursor-pointer text-accent">Change name or number</summary>
                          <ActionForm action={updateGuardian.bind(null, guardian.id)} className="mt-3 grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]">
                            <TextField name="fullName" label="Name" defaultValue={guardian.full_name} />
                            <TextField
                              name="phone"
                              label="Phone"
                              type="tel"
                              inputMode="tel"
                              defaultValue={formatPhoneForDisplay(guardian.phone)}
                            />
                            <FieldButton>
                              <SubmitButton>Save</SubmitButton>
                            </FieldButton>
                            <div className="sm:col-span-3">
                              <FormMessage />
                            </div>
                          </ActionForm>
                          {linkedCount > 1 ? (
                            <p className="mt-2 text-xs text-muted">This guardian is linked to {linkedCount} students. The change applies to all of them.</p>
                          ) : null}
                        </details>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}

            {canManageGuardians ? (
              <ActionForm action={addGuardian.bind(null, student.id)} resetOnSuccess className="mt-5 grid items-start gap-4 sm:grid-cols-3">
                <TextField name="fullName" label="Guardian's name" autoComplete="off" />
                <TextField name="phone" label="Phone" type="tel" inputMode="tel" placeholder="024 123 4567" autoComplete="off" />
                <TextField name="relationship" label="Relationship" placeholder="Mother, uncle, guardian" />
                <div className="space-y-3 sm:col-span-3">
                  <FormMessage />
                  <SubmitButton>Add guardian</SubmitButton>
                </div>
              </ActionForm>
            ) : (
              <p className="mt-4 text-sm text-muted">Only admins, or teachers an admin has allowed, can change guardians.</p>
            )}
          </Card>
        )}

        {canMessage ? (
          <Card
            title="Message guardians"
            description="An SMS to the guardians who get this student's attendance alerts. Admins can see every message on the Messages page."
          >
            {alertGuardians === 0 ? (
              <EmptyState>No guardian gets SMS for this student. Add a guardian or turn their alerts on first.</EmptyState>
            ) : (
              <MessageComposer
                action={sendStudentMessage}
                schoolName={smsSettings?.sms_name ?? school.name}
                balance={balance}
                recipients={alertGuardians}
                hidden={{ studentId: student.id }}
                placeholder={`Please see the class teacher about ${student.full_name.split(" ")[0]} this week.`}
                sendLabel="Send message"
                quietNote={quietNote}
              />
            )}
          </Card>
        ) : null}

        {editable ? (
          <Card title="Details">
            <ActionForm action={updateStudent.bind(null, student.id)} className="grid gap-4 sm:grid-cols-2">
              <TextField name="fullName" label="Full name" defaultValue={student.full_name} />
              <TextField name="schoolId" label="School ID" defaultValue={student.school_number ?? ""} autoCapitalize="characters" />
              {tertiary ? (
                <>
                  <SelectField
                    name="programmeId"
                    label="Programme"
                    placeholder="Not set"
                    defaultValue={student.programme_id ?? ""}
                    options={(programmes ?? []).map((p) => ({ value: p.id, label: p.name }))}
                  />
                  <SelectField
                    name="batchId"
                    label="Batch"
                    placeholder="Not set"
                    defaultValue={student.batch_id ?? ""}
                    options={(batches ?? []).map((b) => ({ value: b.id, label: `${programmeName.get(b.programme_id) ?? ""}: ${b.name}` }))}
                  />
                </>
              ) : (
                <SelectField
                  name="classId"
                  label="Class"
                  placeholder="No class"
                  defaultValue={student.class_id ?? ""}
                  options={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
                />
              )}
              <div className="space-y-3 sm:col-span-2">
                <FormMessage />
                <SubmitButton>Save</SubmitButton>
              </div>
            </ActionForm>

            <div className="mt-6 flex flex-wrap gap-3 border-t border-line pt-4">
              {student.status === "disabled" ? (
                <InlineAction
                  action={setStudentStatus}
                  hidden={{ studentId: student.id, status: "active" }}
                  label="Turn back on"
                  confirm={`Turn ${student.full_name} back on? ${tertiary ? "They can sign in and check in again." : "They appear on registers again, and their guardians' alerts resume."}`}
                />
              ) : (
                <InlineAction
                  action={setStudentStatus}
                  hidden={{ studentId: student.id, status: student.status === "pending" ? "active" : "disabled" }}
                  label={student.status === "pending" ? "Approve" : "Turn off"}
                  variant={student.status === "pending" ? "primary" : "secondary"}
                  confirm={
                    student.status === "pending"
                      ? undefined
                      : `Turn off ${student.full_name}? ${tertiary ? "They can no longer sign in or check in." : "They no longer appear on registers, and their guardians get no attendance alerts."} Their past attendance stays, and you can turn them back on at any time.`
                  }
                />
              )}
              {student.user_id === null ? (
                <InlineAction
                  action={deleteStudent.bind(null, student.id)}
                  label="Delete student"
                  variant="danger"
                  confirm={`Delete ${student.full_name} and their records? Their guardians will be told by SMS.`}
                />
              ) : null}
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
