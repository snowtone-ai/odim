import { isProductionRuntime, isStagingRuntime, resolveSupabaseRuntimeEnv } from "./runtime.ts";

type EnvRequirement = {
  name: string;
  value: string | undefined;
};

const supportedProviders = new Set(["mock", "gemini", "openai", "claude"]);
const ensembleProviders = new Set(["gemini", "openai", "claude"]);
const optionalVars = ["DEFAULT_ORG_ID", "AI_MODEL", "AI_PROVIDER", "AI_PROVIDERS"];

function configuredProviders(env: NodeJS.ProcessEnv): string[] {
  const raw = env.AI_PROVIDERS;
  const values = (raw === undefined || raw.trim() === "" ? [env.AI_PROVIDER ?? "mock"] : raw.split(","))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!values.length) return ["mock"];
  const invalid = values.filter((value) => !supportedProviders.has(value) || (raw !== undefined && raw.trim() !== "" && value === "mock"));
  if (invalid.length) throw new Error(`Unsupported AI provider configuration: ${invalid.join(", ")}`);
  if (new Set(values).size !== values.length) throw new Error("AI provider configuration contains duplicates");
  return values;
}

function missingRequiredVars(env: NodeJS.ProcessEnv): string[] {
  const supabase = resolveSupabaseRuntimeEnv(env);
  const required: EnvRequirement[] = [
    { name: "SUPABASE_URL", value: supabase.url },
    { name: "SUPABASE_SERVICE_ROLE_KEY", value: supabase.serviceRoleKey },
    { name: "API_KEY_PEPPER", value: env.API_KEY_PEPPER }
  ];

  const providers = configuredProviders(env);
  for (const provider of providers) {
    if (!ensembleProviders.has(provider)) continue;
    const keyName = provider === "gemini" ? "AI_API_KEY" : provider === "openai" ? "OPENAI_API_KEY" : "CLAUDE_API_KEY";
    required.push({ name: keyName, value: env[keyName] });
  }

  return required.filter((item) => !item.value).map((item) => item.name);
}

export function validateRequiredEnv(env: NodeJS.ProcessEnv = process.env) {
  const missingOptional = optionalVars.filter((name) => !env[name]);
  if (missingOptional.length > 0) {
    console.warn("Optional environment variables are not set", { missing: missingOptional });
  }

  if (!isProductionRuntime(env) && !isStagingRuntime(env)) {
    console.info("Environment validation completed for non-production runtime");
    return;
  }

  const missing = missingRequiredVars(env);
  if (missing.length > 0) {
    throw new Error(`Missing required ${isStagingRuntime(env) ? "staging" : "production"} environment variables: ${missing.join(", ")}`);
  }

  console.info(`${isStagingRuntime(env) ? "Staging" : "Production"} environment validation completed`);
}
