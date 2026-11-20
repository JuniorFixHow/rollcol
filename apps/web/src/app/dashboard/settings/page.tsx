import { formatPhoneForDisplay, schoolSettingsSchema } from "@rollcol/shared";
import type { Metadata } from "next";
import { refresh } from "next/cache";
import { ActionForm, CheckboxField, FormMessage, RadioGroupField, SubmitButton, TextField } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
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
  });
  if (!parsed.success) return invalid(parsed.error, values);
  const input = parsed.data;
  const tertiary = member.school.type === "tertiary";

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

  const [{ data: details }, { data: settings }] = await Promise.all([
    supabase.from("schools").select("name, contact_phone, register_mode").eq("id", school.id).single(),
    supabase.from("school_settings").select("student_approval_required, student_self_signup").eq("school_id", school.id).single(),
  ]);

  return (
    <>
      <PageHeader title="Settings" />
      <ActionForm action={saveSettings} className="space-y-6">
        <Card title="School">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="name" label="School name" defaultValue={details?.name} />
            <TextField
              name="contactPhone"
              label="School phone number"
              type="tel"
              inputMode="tel"
              defaultValue={details ? formatPhoneForDisplay(details.contact_phone) : undefined}
            />
          </div>
        </Card>

        {tertiary ? (
          <Card title="Students">
            <div className="space-y-4">
              <CheckboxField
                name="studentSelfSignup"
                label="Students can create accounts with the school code"
                description="Turn this off to stop new sign-ups, for example after registration closes."
                defaultChecked={settings?.student_self_signup ?? true}
              />
              <CheckboxField
                name="studentApprovalRequired"
                label="An admin approves each new student"
                description="New students wait on the Students page until an admin approves them. They cannot check in until then."
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
            {/* Not used by non-tertiary schools, but keep the stored values. */}
            {settings?.student_approval_required ? <input type="hidden" name="studentApprovalRequired" value="on" /> : null}
            {settings?.student_self_signup ? <input type="hidden" name="studentSelfSignup" value="on" /> : null}
          </Card>
        )}

        <div className="space-y-3">
          <FormMessage />
          <SubmitButton>Save settings</SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}
