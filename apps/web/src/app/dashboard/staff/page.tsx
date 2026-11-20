import { staffRoleLabel } from "@rollcol/shared";
import type { Metadata } from "next";
import { ActionForm, FieldButton, FormMessage, InlineAction, SelectField, SubmitButton, TextField } from "@/components/form";
import { Badge, Card, EmptyState, PageHeader, Table, Td, formatDateTime } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { grantDelegation, inviteStaff, removeStaff, revokeDelegation, updateStaff } from "./actions";

export const metadata: Metadata = { title: "Staff" };

/** "2026-11-27T17:00" in Ghana time (UTC+0), for a datetime-local input. */
function ghanaInputTime(date: Date): string {
  return date.toISOString().slice(0, 16);
}

/** Earliest allowed end (10 minutes from now) and a default (a week from now at 17:00). */
function delegationTimes(): { min: string; suggested: string } {
  const now = Date.now();
  const suggested = new Date(now + 7 * 24 * 60 * 60 * 1000);
  suggested.setUTCHours(17, 0, 0, 0);
  return { min: ghanaInputTime(new Date(now + 10 * 60 * 1000)), suggested: ghanaInputTime(suggested) };
}

export default async function StaffPage() {
  const { supabase, member } = await requireAdmin();
  const { school } = member;
  const tertiary = school.type === "tertiary";
  const teacherWord = tertiary ? "lecturer" : "teacher";
  const times = delegationTimes();

  const [{ data: staff, error }, { data: delegations }] = await Promise.all([
    supabase
      .from("staff")
      .select("id, full_name, school_number, email, role, status")
      .eq("school_id", school.id)
      .order("full_name"),
    tertiary
      ? Promise.resolve({ data: [] })
      : supabase
          .from("guardian_delegations")
          .select("id, staff_id, expires_at")
          .eq("school_id", school.id)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString()),
  ]);
  if (error) throw new Error(error.message);

  const delegationFor = new Map((delegations ?? []).map((d) => [d.staff_id, d]));
  const teachers = staff.filter((person) => person.role === "teacher" && person.status === "active");

  return (
    <>
      <PageHeader
        title="Staff"
        description={`Admins manage the school. ${tertiary ? "Lecturers run sessions for their courses." : "Teachers mark registers for their classes."}`}
      />

      <div className="space-y-6">
        <Table headers={["Name", "School ID", "Email", "Role", ""]}>
          {staff.map((person) => {
            const isMe = person.id === member.id;
            const disabled = person.status === "disabled";
            return (
              <tr key={person.id}>
                <Td>
                  <span className="font-medium">{person.full_name}</span>
                  {isMe ? <span className="ml-2 text-xs text-muted">(you)</span> : null}
                  {disabled ? (
                    <span className="ml-2">
                      <Badge tone="danger">Turned off</Badge>
                    </span>
                  ) : null}
                </Td>
                <Td className="font-mono text-xs">{person.school_number}</Td>
                <Td className="text-muted">{person.email}</Td>
                <Td>
                  <Badge tone={person.role === "admin" ? "accent" : "neutral"}>{staffRoleLabel(person.role, school.type)}</Badge>
                </Td>
                <Td>
                  {isMe ? null : (
                    <div className="flex flex-wrap justify-end gap-2">
                      <InlineAction
                        action={updateStaff}
                        hidden={{ staffId: person.id, change: person.role === "admin" ? "make_teacher" : "make_admin" }}
                        label={person.role === "admin" ? `Make ${teacherWord}` : "Make admin"}
                        confirm={
                          person.role === "admin"
                            ? `Make ${person.full_name} a ${teacherWord}? They will no longer manage staff, ${tertiary ? "courses" : "classes"}, students, guardians or settings. They keep their ${tertiary ? "courses" : "classes and subjects"}. A school always needs at least one admin.`
                            : `Make ${person.full_name} an admin? Admins manage staff, ${tertiary ? "courses" : "classes"}, students, guardians and settings, see every ${tertiary ? "session" : "register"}, and can correct any of them.`
                        }
                      />
                      <InlineAction
                        action={updateStaff}
                        hidden={{ staffId: person.id, change: disabled ? "enable" : "disable" }}
                        label={disabled ? "Turn on" : "Turn off"}
                        variant={disabled ? "secondary" : "danger"}
                        confirm={
                          disabled
                            ? `Turn ${person.full_name} back on? They can open ${school.name} again with their usual sign-in details, and pick up their ${tertiary ? "courses" : "classes and subjects"} where they left off.`
                            : `Turn off ${person.full_name}? They can no longer open ${school.name} on the website or in the app, or take ${tertiary ? "check-in sessions" : "registers"}. Their past ${tertiary ? "sessions" : "registers"} and marks stay, and they stay assigned to their ${tertiary ? "courses" : "classes and subjects"}, so assign someone else if needed. Their account and any other schools are not affected. You can turn them back on at any time.`
                        }
                      />
                      <InlineAction
                        action={removeStaff}
                        hidden={{ staffId: person.id }}
                        label="Remove"
                        variant="ghost"
                        confirm={`Remove ${person.full_name}? They lose access to this school. Records they made stay, and their RollCol account stays if they belong to another school.`}
                      />
                    </div>
                  )}
                </Td>
              </tr>
            );
          })}
        </Table>

        <Card
          title={`Invite a ${teacherWord} or admin`}
          description="They get an email with a link to choose a password. They can then sign in with their email or school ID."
        >
          <ActionForm action={inviteStaff} resetOnSuccess className="grid gap-4 sm:grid-cols-2">
            <TextField name="fullName" label="Full name" autoComplete="off" />
            <TextField name="email" label="Email" type="email" inputMode="email" autoComplete="off" />
            <TextField name="schoolId" label="School ID" hint="Their staff number." autoCapitalize="characters" />
            <SelectField
              name="role"
              label="Role"
              defaultValue="teacher"
              options={[
                { value: "teacher", label: staffRoleLabel("teacher", school.type) },
                { value: "admin", label: "Admin" },
              ]}
            />
            <div className="space-y-3 sm:col-span-2">
              <FormMessage />
              <SubmitButton pendingLabel="Sending invite...">Send invite</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        {tertiary ? null : (
          <Card
            title="Let teachers manage guardians"
            description="A teacher can add and remove guardians for students in their own classes until the date you choose. Every change records who made it, and changes stay after the permission ends."
          >
            {teachers.length === 0 ? (
              <EmptyState>Invite teachers first.</EmptyState>
            ) : (
              <div className="space-y-5">
                {delegationFor.size > 0 ? (
                  <ul className="divide-y divide-line rounded-md border border-line">
                    {teachers
                      .filter((teacher) => delegationFor.has(teacher.id))
                      .map((teacher) => {
                        const delegation = delegationFor.get(teacher.id);
                        if (!delegation) return null;
                        return (
                          <li key={teacher.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                            <span>
                              <span className="font-medium">{teacher.full_name}</span>
                              <span className="text-muted"> until {formatDateTime(delegation.expires_at)}</span>
                            </span>
                            <InlineAction
                              action={revokeDelegation}
                              hidden={{ delegationId: delegation.id }}
                              label="Stop"
                              confirm={`Stop ${teacher.full_name} managing guardians? They can no longer add or remove guardians or change SMS settings. Guardians they already added stay.`}
                            />
                          </li>
                        );
                      })}
                  </ul>
                ) : null}
                <ActionForm action={grantDelegation} resetOnSuccess className="grid items-start gap-4 sm:grid-cols-[1fr_15rem_auto]">
                  <SelectField
                    name="staffId"
                    label="Teacher"
                    placeholder="Choose a teacher"
                    options={teachers.map((teacher) => ({ value: teacher.id, label: teacher.full_name }))}
                  />
                  <TextField
                    name="expiresAt"
                    label="Until"
                    type="datetime-local"
                    min={times.min}
                    defaultValue={times.suggested}
                    hint="Ghana time. Their permission ends at this time."
                  />
                  <FieldButton>
                    <SubmitButton>Allow</SubmitButton>
                  </FieldButton>
                  <div className="sm:col-span-3">
                    <FormMessage />
                  </div>
                </ActionForm>
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
