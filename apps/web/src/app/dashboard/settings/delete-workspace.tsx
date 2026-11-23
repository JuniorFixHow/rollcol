import { redirect } from "next/navigation";
import { ActionForm, FormMessage, SubmitButton, TextField } from "@/components/form";
import { Card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { type FormState, failed, formValues } from "@/lib/forms";

async function deleteWorkspace(_: FormState, formData: FormData): Promise<FormState> {
  "use server";
  const { supabase, member } = await requireAdmin();
  const values = formValues(formData);
  if (!member.school.isWorkspace) return failed("Only workspaces can be deleted here.");
  if ((values.confirmName ?? "").trim().toLowerCase() !== member.school.name.toLowerCase()) {
    return { status: "error", fieldErrors: { confirmName: "Type the workspace name exactly as shown." }, values };
  }
  const { error } = await supabase.rpc("delete_workspace", { p_school_id: member.school.id, p_confirm_name: values.confirmName ?? "" });
  if (error) return failed(error, values);
  // The remembered dashboard no longer exists, so the next page picks another school or workspace, or onboarding.
  redirect("/dashboard");
}

/** Deleting a workspace removes everything in it, so the name must be typed. */
export function DeleteWorkspace({ name }: { name: string }) {
  return (
    <div className="mt-10">
      <Card title="Delete this workspace" className="border-danger/40">
        <p className="text-sm text-muted">
          This deletes the workspace and everything in it for good: classes or courses, students, guardians, registers,
          sessions and reports. Students who joined in the app lose it from their list. Download any reports you need first.
        </p>
        <ActionForm action={deleteWorkspace} className="mt-4 max-w-md space-y-3">
          <TextField name="confirmName" label={`Type ${name} to confirm`} autoComplete="off" />
          <FormMessage />
          <SubmitButton variant="danger" pendingLabel="Deleting...">
            Delete workspace
          </SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
