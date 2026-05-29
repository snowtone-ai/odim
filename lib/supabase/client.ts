import { createClient } from "@supabase/supabase-js";
import { resolveSupabaseRuntimeEnv } from "../env/runtime.ts";

export function createBrowserSupabaseClient() {
  const { url, anonKey } = resolveSupabaseRuntimeEnv(process.env);
  if (!url || !anonKey) throw new Error("Supabase public environment variables are required");
  return createClient(url, anonKey);
}

export function createServiceSupabaseClient() {
  const { url, serviceRoleKey } = resolveSupabaseRuntimeEnv(process.env);
  if (!url || !serviceRoleKey) throw new Error("Supabase service environment variables are required");
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function hasSupabaseReadEnv() {
  const { url, anonKey, serviceRoleKey } = resolveSupabaseRuntimeEnv(process.env);
  return Boolean(
    url &&
      (serviceRoleKey || anonKey)
  );
}

export function hasSupabaseWriteEnv() {
  const { url, serviceRoleKey } = resolveSupabaseRuntimeEnv(process.env);
  return Boolean(url && serviceRoleKey);
}

export function createServerSupabaseReadClient() {
  const { url, anonKey, serviceRoleKey } = resolveSupabaseRuntimeEnv(process.env);
  const key = serviceRoleKey || anonKey;
  if (!url || !key) throw new Error("Supabase read environment variables are required");
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
