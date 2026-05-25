import { runBiasTestSuite } from "../lib/huginn/bias-test.ts";

const orgIdArg = process.argv.find((arg) => arg.startsWith("--org-id="));
const orgId = orgIdArg?.split("=")[1] || process.env.PAID_SOURCE_ORG_ID || "demo-org";

const results = await runBiasTestSuite({ orgId });
console.log(JSON.stringify({ orgId, results }, null, 2));
