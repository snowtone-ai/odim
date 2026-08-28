"use client";

import { useState } from "react";
import { useHuginnTemplates, type CustomTemplate } from "@/lib/stores/huginn-templates";
import { HUGINN_PRESETS } from "@/lib/huginn/presets";

type Messages = {
  title: string;
  addNew: string;
  label: string;
  template: string;
  variables: string;
  variablesHint: string;
  save: string;
  cancel: string;
  remove: string;
  defaults: string;
  custom: string;
  enabled: string;
  disabled: string;
  empty: string;
  edit: string;
  labelPlaceholder: string;
  templatePlaceholder: string;
};

const DEFAULT_MESSAGES: Messages = {
  title: "Huginn Quick Templates",
  addNew: "Add Template",
  label: "Label",
  template: "Template",
  variables: "Variables",
  variablesHint: "Comma-separated, e.g. entity_name, sector",
  save: "Save",
  cancel: "Cancel",
  remove: "Remove",
  defaults: "Built-in Templates",
  custom: "Custom Templates",
  enabled: "Enabled",
  disabled: "Disabled",
  empty: "No custom templates. Click \"Add Template\" to create one.",
  edit: "Edit",
  labelPlaceholder: "e.g. Weekly sector review",
  templatePlaceholder: "e.g. Analyze this week's capital investment signals for {sector}.",
};

export function HuginnTemplateEditor({ messages = DEFAULT_MESSAGES, locale = "en" }: Readonly<{ messages?: Messages; locale?: "en" | "ja" }>) {
  const { customs, disabledDefaults, add, update, remove, toggleDefault } = useHuginnTemplates();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<CustomTemplate, "id">>({ label: "", template: "" });

  function startNew() {
    setEditing("__new__");
    setDraft({ label: "", template: "", variables: undefined });
  }

  function startEdit(template: CustomTemplate) {
    setEditing(template.id);
    setDraft({ label: template.label, template: template.template, variables: template.variables });
  }

  function handleSave() {
    if (!draft.label.trim() || !draft.template.trim()) return;
    const entry = { label: draft.label.trim(), template: draft.template.trim(), variables: draft.variables?.length ? draft.variables : undefined };
    if (editing === "__new__") add(entry);
    else if (editing) update(editing, entry);
    setEditing(null);
  }

  return (
    <div className="min-w-0">
      <div className="mono mb-3 text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>{messages.title}</div>

      <section aria-labelledby="huginn-defaults-label">
        <div id="huginn-defaults-label" className="mono mb-2 text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-tertiary)" }}>{messages.defaults}</div>
        <div className="border-y" style={{ borderColor: "var(--line-soft)" }}>
          {HUGINN_PRESETS.map((preset) => {
            const isDisabled = disabledDefaults.includes(preset.id);
            return (
              <div key={preset.id} className="flex min-h-14 items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0" style={{ borderColor: "var(--line-faint)" }}>
                <div className="min-w-0">
                  <div className="truncate text-[12px]" style={{ color: isDisabled ? "var(--text-tertiary)" : "var(--text-primary)" }}>{locale === "ja" ? preset.labelJa : preset.label}</div>
                  <div className="mono mt-1 truncate text-[11px]" style={{ color: "var(--text-quaternary)" }}>{(locale === "ja" ? preset.templateJa : preset.template).slice(0, 70)}…</div>
                </div>
                <button type="button" aria-pressed={!isDisabled} onClick={() => toggleDefault(preset.id)} className="mono min-h-11 shrink-0 border px-3 text-[12px] uppercase tracking-[0.1em] transition-colors duration-[120ms] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] motion-reduce:transition-none" style={{ background: isDisabled ? "transparent" : "var(--evidence-wash)", color: isDisabled ? "var(--text-tertiary)" : "var(--evidence)", borderColor: isDisabled ? "var(--line-soft)" : "var(--evidence)" }}>{isDisabled ? messages.disabled : messages.enabled}</button>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="huginn-custom-label" className="mt-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div id="huginn-custom-label" className="mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-tertiary)" }}>{messages.custom}</div>
          <button type="button" onClick={startNew} disabled={editing !== null} className="mono min-h-11 border px-3 text-[12px] uppercase tracking-[0.1em] transition-colors duration-[120ms] hover:bg-[var(--signal-wash)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] disabled:opacity-45 motion-reduce:transition-none" style={{ background: "var(--signal-wash)", borderColor: "var(--signal)", color: "var(--signal)" }}>+ {messages.addNew}</button>
        </div>

        {customs.length === 0 && editing !== "__new__" ? <div className="border-y px-3 py-5 text-center mono text-[11px]" aria-live="polite" style={{ borderColor: "var(--line-soft)", color: "var(--text-secondary)" }}>{messages.empty}</div> : null}
        <div className="border-y" style={{ borderColor: "var(--line-soft)" }}>
          {customs.map((template) => editing === template.id ? (
            <TemplateForm key={template.id} draft={draft} setDraft={setDraft} onSave={handleSave} onCancel={() => setEditing(null)} messages={messages} />
          ) : (
            <div key={template.id} className="flex min-h-14 items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0" style={{ borderColor: "var(--line-faint)" }}>
              <div className="min-w-0">
                <div className="truncate text-[12px]" style={{ color: "var(--text-primary)" }}>{template.label}</div>
                <div className="mono mt-1 truncate text-[11px]" style={{ color: "var(--text-quaternary)" }}>{template.template.slice(0, 70)}…</div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => startEdit(template)} className="min-h-11 px-2 text-[12px] text-[var(--text-secondary)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--signal)]">{messages.edit}</button>
                <button type="button" onClick={() => remove(template.id)} className="min-h-11 px-2 text-[12px] text-[var(--critical)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--signal)]">{messages.remove}</button>
              </div>
            </div>
          ))}
          {editing === "__new__" ? <TemplateForm draft={draft} setDraft={setDraft} onSave={handleSave} onCancel={() => setEditing(null)} messages={messages} /> : null}
        </div>
      </section>
    </div>
  );
}

function TemplateForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  messages
}: Readonly<{
  draft: Omit<CustomTemplate, "id">;
  setDraft: (draft: Omit<CustomTemplate, "id">) => void;
  onSave: () => void;
  onCancel: () => void;
  messages: Messages;
}>) {
  const fieldStyle = { background: "var(--field)", border: "1px solid var(--line-soft)", color: "var(--text-primary)" } as const;
  return (
    <div className="grid gap-3 border-l-2 px-3 py-4" style={{ background: "var(--surface-inset)", borderColor: "var(--signal)" }}>
      <label className="grid gap-1">
        <span className="mono text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>{messages.label}</span>
        <input type="text" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} className="min-h-11 border px-3 text-[12px] outline-none focus-visible:border-[var(--signal)]" style={fieldStyle} placeholder={messages.labelPlaceholder} />
      </label>
      <label className="grid gap-1">
        <span className="mono text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>{messages.template}</span>
        <textarea value={draft.template} onChange={(event) => setDraft({ ...draft, template: event.target.value })} rows={3} className="min-h-24 w-full resize-y border px-3 py-2 text-[12px] outline-none focus-visible:border-[var(--signal)]" style={fieldStyle} placeholder={messages.templatePlaceholder} />
      </label>
      <label className="grid gap-1">
        <span className="mono text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>{messages.variables}</span>
        <input type="text" value={(draft.variables ?? []).join(", ")} onChange={(event) => setDraft({ ...draft, variables: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} className="min-h-11 border px-3 text-[12px] outline-none focus-visible:border-[var(--signal)]" style={fieldStyle} placeholder={messages.variablesHint} />
      </label>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className="min-h-11 border px-3 text-[12px] uppercase tracking-[0.1em] transition-colors duration-[120ms] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] motion-reduce:transition-none" style={{ borderColor: "var(--line-soft)", color: "var(--text-secondary)" }}>{messages.cancel}</button>
        <button type="button" onClick={onSave} disabled={!draft.label.trim() || !draft.template.trim()} className="min-h-11 border px-3 text-[12px] uppercase tracking-[0.1em] transition-colors duration-[120ms] hover:bg-[var(--signal-wash)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] disabled:opacity-45 motion-reduce:transition-none" style={{ background: "var(--signal-wash)", borderColor: "var(--signal)", color: "var(--signal)" }}>{messages.save}</button>
      </div>
    </div>
  );
}
