import type { WatchtowerPlaybook } from "./types.ts";

const BASE_PLAYBOOKS: Array<Omit<WatchtowerPlaybook, "riskControls">> = [
  {
    id: "ai-data-center-buildout",
    name: "AI Data Center Buildout",
    description: "Tracks compute, power, land, and grid interconnection evidence before narrative confirmation.",
    thesis: "AI infrastructure buildout is accelerating where compute, energy, land, and capital signals converge.",
    triggerLayers: ["compute", "energy", "land", "cash"],
    keywords: ["data center", "interconnection", "gpu", "power", "substation", "permit", "campus", "colocation"],
    minConfidence: 0.72,
    cadenceHours: 24,
    approvalActions: ["send_slack_report", "create_board_brief"]
  },
  {
    id: "water-rights-stress",
    name: "Water Rights Stress",
    description: "Routes water rights, industrial demand, drought, and permitting pressure into an approval-gated workflow.",
    thesis: "Water availability is becoming the binding constraint for energy, compute, and mineral projects.",
    triggerLayers: ["water", "energy", "raw_materials", "land"],
    keywords: ["water", "drought", "rights", "basin", "withdrawal", "discharge", "aquifer", "cooling"],
    minConfidence: 0.68,
    cadenceHours: 48,
    approvalActions: ["queue_push_digest", "create_board_brief"]
  },
  {
    id: "state-incentive-subsidy-watch",
    name: "State Incentive Subsidy Watch",
    description: "Monitors grants, tax credits, procurement, and public incentive packages with source-backed approval.",
    thesis: "State and federal incentive flows reveal expansion intent before earnings-call narratives.",
    triggerLayers: ["cash", "land", "logistics", "compute"],
    keywords: ["grant", "tax credit", "incentive", "subsidy", "award", "procurement", "appropriation", "loan"],
    minConfidence: 0.66,
    cadenceHours: 24,
    approvalActions: ["open_api_webhook", "send_slack_report"]
  }
];

export const WATCHTOWER_PLAYBOOKS: WatchtowerPlaybook[] = BASE_PLAYBOOKS.map((playbook) => ({
  ...playbook,
  riskControls: [
    "Use source-backed evidence paths only.",
    "Keep narrative records as triggers, not truth.",
    "Require human approval before external dispatch.",
    "Record trace completeness and citation coverage on every run."
  ]
}));

export function getWatchtowerPlaybook(playbookId: string) {
  return WATCHTOWER_PLAYBOOKS.find((playbook) => playbook.id === playbookId);
}
