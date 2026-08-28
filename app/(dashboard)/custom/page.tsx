import type { Metadata } from "next";
import { DashboardBuilder } from "@/components/ui/dashboard-builder";
import { getLocale } from "@/lib/i18n/locale";
import { getMessages } from "@/lib/i18n/messages";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLocale()) === "ja" ? "分析画面" : "Custom Dashboard" };
}

export default async function CustomDashboardPage() {
  const messages = getMessages(await getLocale());
  return <DashboardBuilder labels={messages.screens.custom} />;
}
