import { isProductionRuntime } from "./runtime.ts";

type EnvRequirement = {
  name: string;
  value: string | undefined;
};

const optionalVars = ["DEFAULT_ORG_ID", "AI_MODEL", "AI_PROVIDER"];

function missingRequiredVars(env: NodeJS.ProcessEnv): string[] {
  const required: EnvRequirement[] = [
    { name: "SUPABASE_URL", value: env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL },
    { name: "SUPABASE_SERVICE_ROLE_KEY", value: env.SUPABASE_SERVICE_ROLE_KEY },
    { name: "API_KEY_PEPPER", value: env.API_KEY_PEPPER },
    { name: "AI_API_KEY", value: env.AI_API_KEY }
  ];

  return required.filter((item) => !item.value).map((item) => item.name);
}

export function validateRequiredEnv(env: NodeJS.ProcessEnv = process.env) {
  const missingOptional = optionalVars.filter((name) => !env[name]);
  if (missingOptional.length > 0) {
    console.warn("Optional environment variables are not set", { missing: missingOptional });
  }

  if (!isProductionRuntime(env)) {
    console.info("Environment validation completed for non-production runtime");
    return;
  }

  const missing = missingRequiredVars(env);
  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }

  console.info("Production environment validation completed");
}
