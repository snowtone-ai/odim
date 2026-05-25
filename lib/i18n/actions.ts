"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { locales } from "./messages";

export async function setLocale(locale: string): Promise<void> {
  if (!locales.includes(locale as (typeof locales)[number])) return;
  const cookieStore = await cookies();
  cookieStore.set("locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}
