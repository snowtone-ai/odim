import { Screen } from "@/components/ui/screen";
import { HuginnConsole } from "@/components/ui/huginn-console";
import { answerHuginnQuestion } from "@/lib/huginn/query";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";

const defaultHuginnOrgId = process.env.PAID_SOURCE_ORG_ID || "11111111-1111-4111-8111-111111111111";

export const dynamic = "force-dynamic";

export default async function HuginnPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const screen = messages.screens.huginn;
  const response = await answerHuginnQuestion({
    orgId: defaultHuginnOrgId,
    question: screen.prompt
  });

  // Serialize to plain object for client hydration
  const initialResponse = {
    answer: response.answer,
    confidence: response.confidence,
    sources: response.sources,
    reasoningTrace: response.reasoningTrace,
    munin: { counts: response.munin.counts },
    retrieval_layers_used: response.retrieval_layers_used,
    narrativeContrast: response.narrativeContrast,
    eval_log_id: response.eval_log_id,
    orgId: response.orgId
  };

  return (
    <Screen title={screen.title}>
      <HuginnConsole
        defaultOrgId={defaultHuginnOrgId}
        defaultQuestion={screen.prompt}
        initialResponse={initialResponse}
        cascadeLayers={screen.cascadeLayers}
        memoryRecords={screen.memoryRecords}
        panelLabels={screen.panels}
        badgeLabels={{ reality: screen.badges.reality, narrative: screen.badges.narrative }}
        inputLabels={screen.input}
        traceNote={screen.traceNote}
        evalLabels={screen.eval}
      />
    </Screen>
  );
}
