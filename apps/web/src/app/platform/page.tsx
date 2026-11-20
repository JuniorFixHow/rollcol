import type { Database } from "@rollcol/shared";
import { formatPhoneForDisplay } from "@rollcol/shared";
import type { Metadata } from "next";
import { refresh } from "next/cache";
import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { InlineAction } from "@/components/form";
import { SignOutButton } from "@/components/sign-out-button";
import { Badge, EmptyState, PageHeader, PageSkeleton, Table, Td, formatDate } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth";
import { type FormState, failed, succeeded } from "@/lib/forms";

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
        <Table headers={["School", "Contact", "People", "Registered", "Status", ""]}>
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
