import { staffRoleLabel } from "@rollcol/shared";
import type { Metadata } from "next";
import { ActionForm, FormMessage, InlineAction, SelectField, SubmitButton, TextField } from "@/components/form";
import { Badge, Card, EmptyState, PageHeader, Table, Td, formatDate } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { grantDelegation, inviteStaff, removeStaff, revokeDelegation, updateStaff } from "./actions";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const { supabase, member } = await requireAdmin();
  const { school } = member;
  const tertiary = school.type === "tertiary";
  const teacherWord = tertiary ? "lecturer" : "teacher";

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
                      />
                      <InlineAction
                        action={updateStaff}
                        hidden={{ staffId: person.id, change: disabled ? "enable" : "disable" }}
                        label={disabled ? "Turn on" : "Turn off"}
                      />
                      <InlineAction
                        action={removeStaff}
                        hidden={{ staffId: person.id }}
                        label="Remove"
                        variant="ghost"
                        confirm={`Remove ${person.full_name}? Their RollCol account will be deleted. Records they made stay.`}
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
                              <span className="text-muted"> until {formatDate(delegation.expires_at)}</span>
                            </span>
                            <InlineAction action={revokeDelegation} hidden={{ delegationId: delegation.id }} label="Stop" />
                          </li>
                        );
                      })}
                  </ul>
                ) : null}
                <ActionForm action={grantDelegation} resetOnSuccess className="grid items-end gap-4 sm:grid-cols-[1fr_12rem_auto]">
                  <SelectField
                    name="staffId"
                    label="Teacher"
                    placeholder="Choose a teacher"
                    options={teachers.map((teacher) => ({ value: teacher.id, label: teacher.full_name }))}
                  />
                  <TextField name="expiresOn" label="Until" type="date" />
                  <SubmitButton>Allow</SubmitButton>
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
