import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const page = read("app/(dashboard)/huginn/page.tsx");
const consoleSource = read("components/ui/huginn-console.tsx");
const input = read("components/ui/huginn-input.tsx");
const evaluation = read("components/ui/eval-button.tsx");

test("Huginn keeps the Server Action contract and makes grounded conversation the primary canvas", () => {
  assert.match(page, /action=\{submitHuginnQuestion\}/);
  assert.match(consoleSource, /data-testid="huginn-workspace"/);
  assert.match(consoleSource, /data-testid="huginn-conversation"/);
  assert.match(consoleSource, /data-testid="huginn-composer-zone"/);
  assert.match(consoleSource, /action\(trimmedQuestion, defaultOrgId, useWebSearch \|\| undefined\)/);
  assert.match(consoleSource, /useHuginnTemplates/);
  assert.match(consoleSource, /useQueryHistory/);
  assert.match(consoleSource, /SavedSearchBar/);
  assert.match(consoleSource, /router\.push\(mapHref\)/);
  assert.doesNotMatch(consoleSource, /content:\s*Error:/);
});

test("sources, execution trace, history, and evaluation share one accessible inspector", () => {
  assert.match(consoleSource, /data-testid="huginn-inspector-toggle"/);
  assert.match(consoleSource, /aria-controls="huginn-inspector"/);
  assert.match(consoleSource, /data-testid="huginn-inspector"/);
  assert.match(consoleSource, /<EvidenceThread/);
  assert.match(consoleSource, /orientation="vertical"/);
  assert.match(consoleSource, /id: "source"/);
  assert.match(consoleSource, /id: "entity"/);
  assert.match(consoleSource, /id: "answer"/);
  assert.match(consoleSource, /id: "action"/);
  assert.match(consoleSource, /evidenceGraph/);
  assert.match(consoleSource, /reasoningTrace/);
  assert.match(consoleSource, /EvalButton/);
  assert.doesNotMatch(consoleSource, /<Panel/);
});

test("empty, loading, and retry states remain distinct from answer text", () => {
  assert.match(consoleSource, /data-testid="huginn-empty"/);
  assert.match(consoleSource, /activePresets\.slice\(0, 3\)/);
  assert.match(consoleSource, /Retrieving source context/);
  assert.match(consoleSource, /Building grounded answer/);
  assert.match(consoleSource, /data-testid="huginn-request-error"/);
  assert.match(consoleSource, /runQuestion\(requestError\.question, false, requestError\.webSearch\)/);
  assert.match(consoleSource, /aria-live="assertive"/);
  assert.match(consoleSource, /document\.hidden/);
});

test("resolved action failures become safe retryable UI errors without adding an answer", () => {
  const failureCodes = [
    "unauthorized",
    "rate_limited",
    "internal",
    "provider_unavailable",
    "deadline_exceeded",
    "retrieval_unavailable",
    "aborted"
  ];
  const statusBlock = consoleSource.match(/const ACTION_FAILURE_CODES = \[[\s\S]*?\] as const satisfies readonly ActionFailureCode\[\];/);
  assert.ok(statusBlock, "the client must keep an explicit safe failure allowlist");
  for (const code of failureCodes) assert.match(statusBlock[0], new RegExp(`"${code}"`));
  for (const code of ["ok", "degraded", "abstained"]) assert.doesNotMatch(statusBlock[0], new RegExp(`"${code}"`));

  assert.match(consoleSource, /const statusCode = data\.status\?\.code/);
  assert.match(consoleSource, /message: safeStatusMessage\(statusCode, locale\)/);
  assert.doesNotMatch(consoleSource, /error instanceof Error \? error\.message/);
  assert.doesNotMatch(consoleSource, /message:\s*error\.message/);

  const guardIndex = consoleSource.indexOf("if (isActionFailureCode(statusCode))");
  const assistantIndex = consoleSource.indexOf('setMessages((previous) => [...previous, { role: "assistant"');
  assert.ok(guardIndex >= 0 && assistantIndex > guardIndex, "status guard must run before appending an assistant message");
  assert.doesNotMatch(consoleSource.slice(guardIndex, assistantIndex), /role:\s*"assistant"/);
  assert.match(consoleSource.slice(guardIndex, assistantIndex), /setRequestError/);
  assert.match(consoleSource, /runQuestion\(requestError\.question, false, requestError\.webSearch\)/);
});

test("composer preserves file attachment behavior and reachable mobile controls", () => {
  assert.match(input, /FileReader/);
  assert.match(input, /MAX_BYTES = 150 \* 1024/);
  assert.match(input, /accept=\{ACCEPTED\}/);
  assert.match(input, /\[Attached: /);
  assert.match(input, /onDraftChange/);
  assert.match(input, /data-testid="huginn-composer"/);
  assert.match(input, /aria-label=\{labels\.prompt\}/);
  assert.match(input, /min-h-11/);
  const textarea = input.match(/<textarea[\s\S]*?\/>/)?.[0] ?? "";
  const attachmentButton = input.match(/<button[\s\S]*?aria-label=\{labels\.attach\}[\s\S]*?<\/button>/)?.[0] ?? "";
  assert.doesNotMatch(textarea, /disabled=\{loading\}/, "drafting must remain available while a request is running");
  assert.doesNotMatch(attachmentButton, /disabled=\{loading\}/, "attachments must remain available while a request is running");
  assert.match(input, /const canSubmit = !loading/);
  assert.doesNotMatch(input, /rounded-2xl|linear-gradient|backdrop/);
});

test("evaluation transport and operational visual language remain intact", () => {
  assert.match(evaluation, /fetch\("\/api\/huginn\/eval"/);
  assert.match(evaluation, /method: "PATCH"/);
  assert.match(evaluation, /eval_log_id: evalLogId/);
  assert.match(evaluation, /user_rating: rating/);
  assert.match(evaluation, /user_note: note/);
  assert.match(evaluation, /role="radiogroup"/);
  assert.match(evaluation, /aria-live="polite"/);
  assert.doesNotMatch(evaluation, /linear-gradient|backdrop|shadow-\[0_0|#c9a961/i);
});
