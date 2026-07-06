import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { PublicShell } from "@/components/ui/public-shell";
import { parseMarkdown, type InlineSegment } from "@/lib/docs/markdown";

export const metadata: Metadata = {
  title: "API Documentation",
  description:
    "Odim public REST API v1 reference — authentication, key scopes, endpoints, pagination, and response shape."
};

function Inline({ segments }: { segments: InlineSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.code ? (
          <code
            key={index}
            className="mono rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[12px]"
            style={{ border: "1px solid var(--line-faint)", color: "var(--rune)" }}
          >
            {segment.text}
          </code>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </>
  );
}

export default function ApiDocsPage() {
  // docs/api-reference.md is repo-controlled trusted content, read at build time
  // (static route) and rendered as React elements — no raw HTML injection.
  const markdown = readFileSync(path.join(process.cwd(), "docs", "api-reference.md"), "utf8");
  const blocks = parseMarkdown(markdown);

  return (
    <PublicShell title="API Reference">
      <p className="mt-4 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Programmatic access to entities, signals, alerts, source health, and Huginn queries.
        API keys are issued per organization from Settings and carry explicit read scopes.
      </p>

      {blocks.map((block, index) => {
        if (block.type === "heading") {
          // The document h1 is replaced by the page title; demote levels by one.
          return block.level === 1 ? null : (
            <h2
              key={index}
              className={`font-semibold ${block.level === 2 ? "mt-10 text-base" : "mt-6 text-sm"}`}
              style={{ color: "var(--text-primary)" }}
            >
              <Inline segments={block.segments} />
            </h2>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={index} className="mt-3 grid gap-1.5">
              {block.items.map((item, itemIndex) => (
                <li
                  key={itemIndex}
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--text-secondary)", marginLeft: `${item.indent * 16}px` }}
                >
                  <Inline segments={item.segments} />
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "code") {
          return (
            <pre
              key={index}
              className="mono mt-3 overflow-x-auto rounded-[var(--radius-md)] p-4 text-[12px] leading-relaxed"
              style={{ border: "1px solid var(--line-faint)", background: "var(--ink-900)", color: "var(--text-secondary)" }}
            >
              <code>{block.code}</code>
            </pre>
          );
        }
        return (
          <p key={index} className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            <Inline segments={block.segments} />
          </p>
        );
      })}
    </PublicShell>
  );
}
