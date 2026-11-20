import type { Enums } from "@rollcol/shared";
import { Badge } from "@/components/ui";

const STATUS: Record<Enums<"register_status">, { label: string; tone: "accent" | "success" | "neutral" }> = {
  open: { label: "Open", tone: "accent" },
  submitted: { label: "Submitted", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
};

export function RegisterStatusBadge({ status }: { status: Enums<"register_status"> }) {
  const { label, tone } = STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}
