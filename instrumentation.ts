import { validateRequiredEnv } from "./lib/env/validate.ts";

export function register() {
  validateRequiredEnv();
}
