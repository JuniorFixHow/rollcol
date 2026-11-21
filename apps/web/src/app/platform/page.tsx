import type { Database } from "@rollcol/shared";
import { formatPhoneForDisplay } from "@rollcol/shared";
import type { Metadata } from "next";
import { refresh } from "next/cache";
import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { ActionForm, FormMessage, InlineAction, SubmitButton, TextField } from "@/components/form";
import { SignOutButton } from "@/components/sign-out-button";
import { Badge, Card, EmptyState, PageHeader, PageSkeleton, Table, Td, formatDate, formatDateTime } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth";
import { type FormState, failed, succeeded } from "@/lib/forms";
import { grantCredits } from "../dashboard/messages/actions";

export const metadata: Metadata = { title: "Platform" };
export const instant = false;

type SchoolStatus = Database["public"]["Enums"]["school_status"];

async function setStatus(_: FormState, formData: FormData): Promise<FormState> {
  "use server";
  const { supabase } = await requirePlatformAdmin();
  const status = String(formData.get("status") ?? "");
  if (status !== "verified" && status !== "unverified" && status !== "suspended") return failed("Unknown status.");
  const { error } = await supabase.rpc("set_school_status", {
    p_school_id: String(formData.get("schoolId") ?? ""),
    p_status: status,
  });
  if (error) return failed(error);
  refresh();
  return succeeded("Saved.");
}

export default function PlatformPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
      <div className="mb-8 flex items-center justify-between">
        <Brand href="/platform" />
        <SignOutButton variant="ghost" />
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <SmsSender />
        <Schools />
      </Suspense>
    </div>
  );
}

async function Schools() {
  const { supabase } = await requirePlatformAdmin();
  const { data: schools, error } = await supabase.rpc("platform_schools");
  if (error) throw new Error(error.message);

  const tone: Record<SchoolStatus, "warning" | "success" | "danger"> = {
    unverified: "warning",
    verified: "success",
    suspended: "danger",
  };
  const waiting = schools.filter((school) => school.status === "unverified").length;

  return (
    <>
      <PageHeader
        title="Schools"
        description={`${waiting} waiting for verification. Call the school on its registered number before verifying.`}
      />
      {schools.length === 0 ? (
        <EmptyState>No schools yet.</EmptyState>
      ) : (
        <Table search="Search schools" headers={["School", "Contact", "People", "SMS", "Registered", "Status", ""]}>
          {schools.map((school) => (
            <tr key={school.id}>
              <Td>
                <span className="font-medium">{school.name}</span>
                <span className="block text-xs text-muted">
                  <span className="font-mono">{school.code}</span> · {school.type === "tertiary" ? "Tertiary" : "Basic or SHS"}
                </span>
              </Td>
              <Td className="text-sm">
                <span className="block font-mono">{formatPhoneForDisplay(school.contact_phone)}</span>
                <span className="block text-muted">{school.contact_email}</span>
              </Td>
              <Td className="text-sm tabular-nums">
                {school.student_count} students
                <span className="block text-muted">{school.staff_count} staff</span>
              </Td>
              <Td className="text-sm">
                {school.type === "tertiary" ? (
                  <span className="text-muted">Not used</span>
                ) : (
                  <>
                    <span className="block tabular-nums">{school.sms_credits} credits</span>
                    <span className="block text-muted tabular-nums">{school.sms_sent_30_days} sent in 30 days</span>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-accent">Add credits</summary>
                      <ActionForm action={grantCredits} resetOnSuccess className="mt-2 grid w-64 items-start gap-2">
                        <input type="hidden" name="schoolId" value={school.id} />
                        <TextField
                          name="amount"
                          label="Credits"
                          type="number"
                          inputMode="numeric"
                          step="1"
                          hint="A minus number takes credits back."
                        />
                        <TextField name="reason" label="Note" placeholder="Term 1 credits" />
                        <SubmitButton size="sm">Save</SubmitButton>
                        <FormMessage />
                      </ActionForm>
                    </details>
                  </>
                )}
              </Td>
              <Td className="text-sm">{formatDate(school.created_at)}</Td>
              <Td>
                <Badge tone={tone[school.status]}>{school.status}</Badge>
              </Td>
              <Td>
                <div className="flex justify-end gap-2">
                  {school.status !== "verified" ? (
                    <InlineAction
                      action={setStatus}
                      hidden={{ schoolId: school.id, status: "verified" }}
                      label="Verify"
                      variant="primary"
                      confirm={`Verify ${school.name}? Limits are lifted and the alerts trial can start.`}
                    />
                  ) : null}
                  {school.status !== "suspended" ? (
                    <InlineAction
                      action={setStatus}
                      hidden={{ schoolId: school.id, status: "suspended" }}
                      label="Suspend"
                      confirm={`Suspend ${school.name}? Nobody can add people until it is restored.`}
                    />
                  ) : (
                    <InlineAction action={setStatus} hidden={{ schoolId: school.id, status: "unverified" }} label="Restore" />
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

/** What a reply from send-sms means, in words. */
function explainReply(status: number | null, reply: string, error: string): { ok: boolean; text: string } {
  if (status === null) return { ok: false, text: error ? `The call failed: ${error}` : "No reply was recorded." };
  if (status === 200) return { ok: true, text: `Working. Last run: ${reply}` };
  if (status === 401 && reply.includes("Not allowed")) {
    return { ok: false, text: "The secret does not match. CRON_SECRET in Edge Function secrets must equal cron_secret in private.config." };
  }
  if (status === 401) {
    return { ok: false, text: "Supabase refused the call. Deploy send-sms again with --no-verify-jwt." };
  }
  if (status === 404) return { ok: false, text: "send-sms was not found. Check it is deployed and sms_sender_url is right." };
  return { ok: false, text: `send-sms replied ${status}: ${reply || error}` };
}

async function SmsSender() {
  const { supabase } = await requirePlatformAdmin();
  const { data } = await supabase.rpc("platform_sms_sender_log");
  const rows = data ?? [];
  const first = rows[0];
  if (!first) return null;
  // The push sender (send-push) shares pg_net; only the SMS sender's replies count here.
  const replies = rows.filter((row) => row.replied_at !== null && !(row.reply ?? "").includes('"service":"push"'));

  let summary: { ok: boolean; text: string };
  if (!first.configured) {
    summary = { ok: false, text: "The sender is not set up. Add sms_sender_url and cron_secret to private.config (see the README)." };
  } else if (replies.length === 0) {
    summary =
      first.waiting > 0
        ? { ok: false, text: "Messages are waiting but the database has not called the sender in the last six hours." }
        : { ok: true, text: "Set up. No messages were due recently." };
  } else {
    const last = replies[0];
    summary = explainReply(last.status_code, last.reply ?? "", last.error ?? "");
  }

  return (
    <Card title="SMS sender" className="mb-8">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={summary.ok ? "success" : "danger"}>{summary.ok ? "OK" : "Needs attention"}</Badge>
        <p className="text-sm">{summary.text}</p>
      </div>
      {first.waiting > 0 ? (
        <p className="mt-2 text-sm text-muted">{first.waiting} messages have been waiting for more than 2 minutes.</p>
      ) : null}
      {replies.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-muted">
          {replies.map((row, index) => (
            <li key={`${row.replied_at}-${index}`} className="font-mono">
              {row.replied_at ? formatDateTime(row.replied_at) : ""} · {row.status_code ?? "no reply"} · {row.reply ?? row.error}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
