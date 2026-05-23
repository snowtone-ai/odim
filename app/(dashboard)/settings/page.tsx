import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";

export default function SettingsPage() {
  return (
    <Screen eyebrow="Screen 08" title="Settings">
      <div className="grid grid-cols-2 gap-5">
        <Panel title="Alert Rules">Rule builder scaffold for watchlist, layer, and confidence thresholds.</Panel>
        <Panel title="API Keys">External AI Agent access is designed API-first; MCP remains a future extension.</Panel>
        <Panel title="Team Permissions">Org roles: analyst / admin.</Panel>
        <Panel title="Ontology Explorer">Advanced object, link, and action type inspection.</Panel>
      </div>
    </Screen>
  );
}
