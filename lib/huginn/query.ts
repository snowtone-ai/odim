import { generateAnswer } from "@/lib/ai/provider";

export async function answerHuginnQuestion(orgId: string, question: string) {
  if (!orgId) throw new Error("orgId is required for Huginn queries");
  return generateAnswer({
    question,
    context: `Use only source-backed ontology facts visible to org ${orgId}.`
  });
}
