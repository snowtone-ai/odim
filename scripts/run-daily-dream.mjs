const { dreamJob } = await import("../lib/munin/dream.ts");

const orgId = process.env.DEFAULT_ORG_ID;
if (!orgId) throw new Error("DEFAULT_ORG_ID is required for daily dream");

console.log(JSON.stringify(await dreamJob({ orgId })));
