import { formatPhoneForDisplay, registerTimingSchema, schoolSettingsSchema, sessionRulesSchema, shortTime, smsSettingsSchema } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { refresh } from "next/cache";
import { ActionForm, CheckboxField, DependsOn, FormMessage, RadioGroupField, SubmitButton, TextField } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { DeleteWorkspace } from "./delete-workspace";
import { requireAdmin } from "@/lib/auth";
import { type FormState, failed, formBoolean, formValues, invalid, succeeded } from "@/lib/forms";

export const metadata: Metadata = { title: "Settings" };

async function saveSettings(_: FormState, formData: FormData): Promise<FormState> {
  "use server";
  const { supabase, member } = await requireAdmin();
  const values = formValues(formData);
  const parsed = schoolSettingsSchema.safeParse({
    name: values.name,
    contactPhone: values.contactPhone,
    registerMode: values.registerMode || undefined,
    studentApprovalRequired: formBoolean(formData, "studentApprovalRequired"),
    studentSelfSignup: formBoolean(formData, "studentSelfSignup"),
    lowAttendancePercent: values.lowAttendancePercent,
  });
  if (!parsed.success) return invalid(parsed.error, values);
  const input = parsed.data;
  const tertiary = member.school.type === "tertiary";
  const workspace = member.school.isWorkspace;

  const timing = tertiary
    ? null
    : registerTimingSchema.safeParse({
        dailyRegisterClosesAt: values.dailyRegisterClosesAt,
        periodRegisterMinutes: values.periodRegisterMinutes,
        periodsPerDay: values.periodsPerDay,
      });
  if (timing && !timing.success) return invalid(timing.error, values);

  const sms = tertiary || workspace
    ? null
    : smsSettingsSchema.safeParse({
        smsName: values.smsName ?? "",
        smsAbsenceAlerts: formBoolean(formData, "smsAbsenceAlerts"),
        smsPresentAlerts: formBoolean(formData, "smsPresentAlerts"),
        quietHours: formBoolean(formData, "quietHours"),
        quietStart: values.quietStart,
        quietEnd: values.quietEnd,
      });
  if (sms && !sms.success) return invalid(sms.error, values);

  const rules = tertiary && !workspace
    ? sessionRulesSchema.parse({
        lecturersAddVenues: formBoolean(formData, "lecturersAddVenues"),
        lecturersRemoveSelfCheckins: formBoolean(formData, "lecturersRemoveSelfCheckins"),
        lecturersAddAfterEnd: formBoolean(formData, "lecturersAddAfterEnd"),
        courseApprovalRequired: formBoolean(formData, "courseApprovalRequired"),
      })
    : null;

  const { error: schoolError } = await supabase
    .from("schools")
    .update({
      name: input.name,
      contact_phone: input.contactPhone,
      ...(!tertiary && input.registerMode ? { register_mode: input.registerMode } : {}),
    })
    .eq("id", member.school.id);
  if (schoolError) return failed(schoolError, values);

  const { error: settingsError } = await supabase
    .from("school_settings")
    .update({
      student_approval_required: input.studentApprovalRequired,
      student_self_signup: input.studentSelfSignup,
      low_attendance_percent: input.lowAttendancePercent,
      ...(timing?.success
        ? {
            daily_register_closes_at: timing.data.dailyRegisterClosesAt,
            period_register_minutes: timing.data.periodRegisterMinutes,
            periods_per_day: timing.data.periodsPerDay,
          }
        : {}),
      ...(sms?.success
        ? {
            sms_name: sms.data.smsName,
            sms_absence_alerts: sms.data.smsAbsenceAlerts,
            sms_present_alerts: sms.data.smsPresentAlerts,
            sms_quiet_hours: sms.data.quietHours,
            // While quiet hours are off the times are not sent; keep the saved ones.
            ...(sms.data.quietHours ? { sms_quiet_start: sms.data.quietStart, sms_quiet_end: sms.data.quietEnd } : {}),
          }
        : {}),
      ...(rules
        ? {
            lecturers_add_venues: rules.lecturersAddVenues,
            lecturers_remove_self_checkins: rules.lecturersRemoveSelfCheckins,
            lecturers_add_after_end: rules.lecturersAddAfterEnd,
            course_approval_required: rules.courseApprovalRequired,
          }
        : {}),
    })
    .eq("school_id", member.school.id);
  if (settingsError) return failed(settingsError, values);

  refresh();
  return succeeded("Settings saved.");
}

export default async function SettingsPage() {
  const { supabase, member } = await requireAdmin();
  const { school } = member;
  const tertiary = school.type === "tertiary";
  const workspace = school.isWorkspace;

  const [{ data: details }, { data: settings }] = await Promise.all([
    supabase.from("schools").select("name, contact_phone, register_mode").eq("id", school.id).single(),
    supabase
      .from("school_settings")
      .select(
        "student_approval_required, student_self_signup, daily_register_closes_at, period_register_minutes, periods_per_day, sms_name, sms_absence_alerts, sms_present_alerts, sms_quiet_hours, sms_quiet_start, sms_quiet_end, lecturers_add_venues, lecturers_remove_self_checkins, lecturers_add_after_end, course_approval_required, low_attendance_percent",
      )
      .eq("school_id", school.id)
      .single(),
  ]);

  return (
    <>
      <PageHeader title="Settings" />
      <ActionForm action={saveSettings} className="space-y-6">
        <Card title={workspace ? "Workspace" : "School"}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="name" label={workspace ? "Workspace name" : "School name"} defaultValue={details?.name} />
            <TextField
              name="contactPhone"
              label={workspace ? "Your phone number" : "School phone number"}
              type="tel"
              inputMode="tel"
              defaultValue={details ? formatPhoneForDisplay(details.contact_phone) : undefined}
            />
          </div>
        </Card>

        {tertiary && !workspace ? (
          <Card
            title="Lecturers"
            description="What lecturers may do. Admins can always correct a session, and every change is kept with its reason, who made it and when."
          >
            <div className="space-y-4">
              <CheckboxField
                name="courseApprovalRequired"
                label="Courses added by lecturers need an admin's approval"
                description="Lecturers can add the courses they teach. While this is on, students cannot join a new course and no sessions can start until an admin approves it on the Courses page."
                defaultChecked={settings?.course_approval_required ?? true}
              />
              <CheckboxField
                name="lecturersAddVenues"
                label="Lecturers can add venues"
                description="Their venues are marked unverified until an admin verifies them on the Venues page, but can be used straight away."
                defaultChecked={settings?.lecturers_add_venues ?? true}
              />
              <CheckboxField
                name="lecturersRemoveSelfCheckins"
                label="Lecturers can remove a student who checked in themselves"
                description="Off: only admins can. A student's own check-in has passed every check (their phone, location and the rotating code)."
                defaultChecked={settings?.lecturers_remove_self_checkins ?? false}
              />
              <CheckboxField
                name="lecturersAddAfterEnd"
                label="Lecturers can change attendance after a session ends"
                description="Off: lecturers can only add students while the session is open (for example a student whose battery died). Admins can correct up to 14 days later."
                defaultChecked={settings?.lecturers_add_after_end ?? false}
              />
            </div>
          </Card>
        ) : null}

        {tertiary ? (
          <Card title="Students">
            <div className="space-y-4">
              <CheckboxField
                name="studentSelfSignup"
                label={workspace ? "Students can join with the workspace code" : "Students can create accounts with the school code"}
                description="Turn this off to stop new sign-ups, for example after registration closes."
                defaultChecked={settings?.student_self_signup ?? true}
              />
              <CheckboxField
                name="studentApprovalRequired"
                label={workspace ? "You approve each new student" : "An admin approves each new student"}
                description={`New students wait on the Students page until ${workspace ? "you approve" : "an admin approves"} them. They cannot check in until then.`}
                defaultChecked={settings?.student_approval_required ?? true}
              />
            </div>
          </Card>
        ) : (
          <Card title="Registers">
            <RadioGroupField
              name="registerMode"
              label="How are registers taken?"
              defaultValue={details?.register_mode ?? "daily"}
              options={[
                { value: "daily", label: "Once a day", description: "The class teacher marks the register each morning." },
                { value: "per_period", label: "Every period", description: "Each subject teacher marks their own periods." },
              ]}
            />
            <div className="mt-5 grid items-start gap-4 sm:grid-cols-3">
              <TextField
                name="dailyRegisterClosesAt"
                label="Daily registers close at"
                type="time"
                hint="Unsubmitted daily registers close on their own at this time."
                defaultValue={shortTime(settings?.daily_register_closes_at) || "10:00"}
              />
              <TextField
                name="periodRegisterMinutes"
                label="Period registers stay open for (minutes)"
                type="number"
                inputMode="numeric"
                hint="Counted from when the teacher starts the register."
                defaultValue={String(settings?.period_register_minutes ?? 60)}
              />
              <TextField
                name="periodsPerDay"
                label="Periods in a school day"
                type="number"
                inputMode="numeric"
                hint="Teachers choose from this many periods. A class can have its own number on its page."
                defaultValue={String(settings?.periods_per_day ?? 10)}
              />
            </div>
            <p className="mt-3 text-xs text-muted">
              After a register closes, teachers can still correct marks until the end of the day, for example when a child
              arrives late. Admins can correct registers at any time.
            </p>
            {/* Not used by non-tertiary schools, but keep the stored values. */}
            {settings?.student_approval_required ? <input type="hidden" name="studentApprovalRequired" value="on" /> : null}
            {settings?.student_self_signup ? <input type="hidden" name="studentSelfSignup" value="on" /> : null}
          </Card>
        )}

        {tertiary || workspace ? null : (
          <Card
            title="SMS to guardians"
            description={
              <>
                Alerts go out 15 minutes after a register is submitted or closes, so teachers can fix mistakes first. See
                every message on the{" "}
                <Link href="/dashboard/messages" className="text-accent hover:underline">
                  Messages
                </Link>{" "}
                page.
              </>
            }
          >
            <div className="space-y-4">
              <TextField
                name="smsName"
                label="School name in SMS"
                placeholder={details?.name}
                hint="Every SMS starts with this. A short name leaves more room for the message. Leave it empty to use the full name."
                defaultValue={settings?.sms_name ?? ""}
              />
              <CheckboxField
                name="smsAbsenceAlerts"
                label="Tell guardians when a child is absent or late"
                description="If an absent child arrives later and the register is corrected, the guardian is told they have arrived."
                defaultChecked={settings?.sms_absence_alerts ?? true}
              />
              <CheckboxField
                name="smsPresentAlerts"
                label="Tell one guardian each day that their child is in school"
                description="Goes to the guardian chosen for daily present alerts on each student's page. Daily registers only."
                defaultChecked={settings?.sms_present_alerts ?? false}
              />
              <div className="border-t border-line pt-4">
                <CheckboxField
                  name="quietHours"
                  label="Hold SMS during quiet hours"
                  description="Messages that fall in these hours wait and go out when they end. Turn this off if you have evening classes and want alerts at any time."
                  defaultChecked={settings?.sms_quiet_hours ?? true}
                />
                <div className="mt-3 grid items-start gap-4 sm:grid-cols-2">
                  <DependsOn field="quietHours" checked mode="disable" initially={settings?.sms_quiet_hours ?? true}>
                  <TextField
                    name="quietStart"
                    label="Quiet hours start"
                    type="time"
                    defaultValue={shortTime(settings?.sms_quiet_start) || "21:00"}
                  />
                  <TextField
                    name="quietEnd"
                    label="Quiet hours end (messages go out)"
                    type="time"
                    hint="For example, set 21:00 to 06:30 so the night's messages arrive at 6:30am."
                    defaultValue={shortTime(settings?.sms_quiet_end) || "07:00"}
                  />
                  </DependsOn>
                </div>
              </div>
            </div>
          </Card>
        )}

        <Card title="Reports">
          <div className="max-w-xs">
            <TextField
              name="lowAttendancePercent"
              label="Flag students below (%)"
              type="number"
              inputMode="numeric"
              hint="Students whose attendance is below this are shown on the Reports page. Many schools use 75."
              defaultValue={String(settings?.low_attendance_percent ?? 75)}
            />
          </div>
        </Card>

        <div className="space-y-3">
          <FormMessage />
          <SubmitButton>Save settings</SubmitButton>
        </div>
      </ActionForm>

      {workspace ? <DeleteWorkspace name={school.name} /> : null}
    </>
  );
}
