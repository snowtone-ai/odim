import { cache } from "react";
import { cookies } from "next/headers";
import { resolveLocale, type Locale } from "./messages";

export const getLocale = cache(async (): Promise<Locale> => {
  try {
    const cookieStore = await cookies();
    return resolveLocale(cookieStore.get("locale")?.value ?? process.env.NEXT_PUBLIC_DEFAULT_LOCALE);
  } catch {
    return resolveLocale(process.env.NEXT_PUBLIC_DEFAULT_LOCALE);
  }
});
