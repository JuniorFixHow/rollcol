import type { Metadata } from "next";
import { NotFoundView } from "@/components/not-found-view";

export const metadata: Metadata = { title: "Page not found" };

/** Inside the dashboard, the menu stays so the person can carry on. */
export default function DashboardNotFound() {
  return <NotFoundView home="/dashboard" homeLabel="Go to the overview" />;
}
