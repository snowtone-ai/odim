export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env) {
  return env.ODIM_RUNTIME_ENV === "production" || env.VERCEL_ENV === "production";
}
