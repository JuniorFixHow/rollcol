import type { Enums } from "@rollcol/shared";

type Status = Enums<"sms_status">;
type Delivery = Enums<"sms_delivery">;

export const DELIVERY_TONE: Record<Delivery, "neutral" | "success" | "danger"> = {
  pending: "neutral",
  delivered: "success",
  failed: "danger",
  expired: "danger",
  rejected: "danger",
};

export const STATUS_TONE: Record<Status, "neutral" | "success" | "warning" | "danger" | "accent"> = {
  queued: "neutral",
  sending: "accent",
  sent: "success",
  failed: "danger",
  no_credit: "warning",
  cancelled: "neutral",
  in_app: "success",
};
