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
  empty: "No custom templates. Click \"Add Template\" to create one."
};

export function HuginnTemplateEditor({ messages = DEFAULT_MESSAGES }: Readonly<{ messages?: Messages }>) {
  const { customs, disabledDefaults, add, update, remove, toggleDefault } = useHuginnTemplates();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<CustomTemplate, "id">>({ label: "", template: "" });

  function startNew() {
    setEditing("__new__");
    setDraft({ label: "", template: "", variables: undefined });
  }

  function startEdit(ct: CustomTemplate) {
    setEditing(ct.id);
    setDraft({ label: ct.label, template: ct.template, variables: ct.variables });
  }

  function handleSave() {
    if (!draft.label.trim() || !draft.template.trim()) return;
    const entry = {
      label: draft.label.trim(),
      template: draft.template.trim(),
      variables: draft.variables?.length ? draft.variables : undefined
    };
    if (editing === "__new__") {
      add(entry);
    } else if (editing) {
      update(editing, entry);
    }
    setEditing(null);
  }

  return (
    <div className="grid gap-5">
      {/* Built-in templates — toggle on/off */}
      <div>
        <div className="mono mb-2 text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--text-tertiary)" }}>
          {messages.defaults}
        </div>
        <div className="grid gap-1.5">
          {HUGINN_PRESETS.map((preset) => {
            const isDisabled = disabledDefaults.includes(preset.id);
            return (
              <div
                key={preset.id}
                className="flex items-center justify-between rounded-[var(--radius-sm)] px-3 py-2"
                style={{ background: "var(--ink-800)", border: "1px solid var(--line-faint)" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px]" style={{ color: isDisabled ? "var(--text-tertiary)" : "var(--text-primary)" }}>
                    {preset.label}
                  </div>
                  <div className="mono mt-0.5 truncate text-[10px]" style={{ color: "var(--text-quaternary)" }}>
                    {preset.template.slice(0, 60)}…
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleDefault(preset.id)}
                  className="mono shrink-0 rounded px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] transition-colors"
                  style={{
                    background: isDisabled ? "transparent" : "rgba(201,169,97,0.12)",
                    color: isDisabled ? "var(--text-tertiary)" : "var(--rune)",
                    border: isDisabled ? "1px solid var(--line-faint)" : "1px solid rgba(201,169,97,0.25)"
                  }}
                >
                  {isDisabled ? messages.disabled : messages.enabled}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom templates */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--text-tertiary)" }}>
            {messages.custom}
          </div>
          <button
            type="button"
            onClick={startNew}
            disabled={editing !== null}
            className="mono rounded px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors hover:bg-white/5"
            style={{
              color: "var(--rune)",
              border: "1px solid rgba(201,169,97,0.25)",
              opacity: editing !== null ? 0.4 : 1
            }}
          >
            + {messages.addNew}
          </button>
        </div>

        {customs.length === 0 && editing !== "__new__" && (
          <div className="mono rounded-[var(--radius-sm)] px-3 py-4 text-center text-[11px]" style={{ color: "var(--text-tertiary)", background: "var(--ink-800)" }}>
            {messages.empty}
          </div>
        )}

        <div className="grid gap-2">
          {customs.map((ct) =>
            editing === ct.id ? (
              <TemplateForm
                key={ct.id}
                draft={draft}
                setDraft={setDraft}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
                messages={messages}
              />
            ) : (
              <div
                key={ct.id}
                className="flex items-center justify-between rounded-[var(--radius-sm)] px-3 py-2"
                style={{ background: "var(--ink-800)", border: "1px solid var(--line-faint)" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px]" style={{ color: "var(--text-primary)" }}>{ct.label}</div>
                  <div className="mono mt-0.5 truncate text-[10px]" style={{ color: "var(--text-quaternary)" }}>
                    {ct.template.slice(0, 60)}…
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => startEdit(ct)}
                    className="mono rounded px-2 py-0.5 text-[10px] transition-colors hover:bg-white/5"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(ct.id)}
                    className="mono rounded px-2 py-0.5 text-[10px] transition-colors hover:bg-white/5"
                    style={{ color: "var(--critical)" }}
                  >
                    {messages.remove}
                  </button>
                </div>
              </div>
            )
          )}
          {editing === "__new__" && (
            <TemplateForm
              draft={draft}
              setDraft={setDraft}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
              messages={messages}
            />
          )}
        </div>
      </div>
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
  setDraft: (d: Omit<CustomTemplate, "id">) => void;
  onSave: () => void;
  onCancel: () => void;
  messages: Messages;
}>) {
  return (
    <div
      className="grid gap-3 rounded-[var(--radius-md)] p-3"
      style={{ background: "var(--ink-900)", border: "1px solid rgba(201,169,97,0.2)" }}
    >
      <div>
        <label className="mono mb-1 block text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>
          {messages.label}
        </label>
        <input
          type="text"
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          className="w-full rounded-[var(--radius-sm)] bg-transparent px-3 py-1.5 text-[12px] outline-none"
          style={{ color: "var(--text-primary)", border: "1px solid var(--line-faint)" }}
          placeholder="e.g. Weekly Sector Review"
        />
      </div>
      <div>
        <label className="mono mb-1 block text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>
          {messages.template}
        </label>
        <textarea
          value={draft.template}
          onChange={(e) => setDraft({ ...draft, template: e.target.value })}
          rows={3}
          className="w-full resize-y rounded-[var(--radius-sm)] bg-transparent px-3 py-1.5 text-[12px] outline-none"
          style={{ color: "var(--text-primary)", border: "1px solid var(--line-faint)" }}
          placeholder="e.g. Analyze {sector} capital fixation trends this week..."
        />
      </div>
      <div>
        <label className="mono mb-1 block text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>
          {messages.variables}
        </label>
        <input
          type="text"
          value={(draft.variables ?? []).join(", ")}
          onChange={(e) =>
            setDraft({
              ...draft,
              variables: e.target.value
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean)
            })
          }
          className="w-full rounded-[var(--radius-sm)] bg-transparent px-3 py-1.5 text-[12px] outline-none"
          style={{ color: "var(--text-primary)", border: "1px solid var(--line-faint)" }}
          placeholder={messages.variablesHint}
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="mono rounded px-3 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors hover:bg-white/5"
          style={{ color: "var(--text-tertiary)", border: "1px solid var(--line-faint)" }}
        >
          {messages.cancel}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!draft.label.trim() || !draft.template.trim()}
          className="mono rounded px-3 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors"
          style={{
            background: "rgba(201,169,97,0.15)",
            color: "var(--rune)",
            border: "1px solid rgba(201,169,97,0.3)",
            opacity: draft.label.trim() && draft.template.trim() ? 1 : 0.4
          }}
        >
          {messages.save}
        </button>
      </div>
    </div>
  );
}
