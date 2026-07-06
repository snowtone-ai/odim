import type { Metadata } from "next";

export const metadata: Metadata = { title: "Custom Dashboard" };

import { DashboardBuilder } from "@/components/ui/dashboard-builder";

export default function CustomDashboardPage() {
  return <DashboardBuilder />;
}
