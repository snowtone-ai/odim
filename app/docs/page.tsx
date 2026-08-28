import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { PublicShell } from "@/components/ui/public-shell";
import { parseMarkdown, type InlineSegment } from "@/lib/docs/markdown";
import { getLocale } from "@/lib/i18n/locale";

export async function generateMetadata(): Promise<Metadata> {
  return (await getLocale()) === "ja"
    ? {
        title: "APIリファレンス",
        description: "Odim公開REST API v1のリファレンス — 認証、キーの権限、エンドポイント、ページネーション、レスポンス形式。"
      }
    : {
        title: "API Documentation",
        description: "Odim public REST API v1 reference — authentication, key scopes, endpoints, pagination, and response shape."
      };
}

function Inline({ segments }: { segments: InlineSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.code ? (
          <code
            key={index}
            className="mono rounded-[4px] px-1.5 py-0.5 text-[12px]"
            style={{ border: "1px solid color-mix(in srgb, var(--text) 18%, transparent)", background: "color-mix(in srgb, var(--surface) 60%, transparent)", color: "var(--evidence)" }}
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

export default async function ApiDocsPage() {
  // The locale-specific API reference is repo-controlled trusted content and is
  // rendered as React elements — no raw HTML injection.
  const locale = await getLocale();
  const markdown = readFileSync(
    path.join(process.cwd(), "docs", locale === "ja" ? "api-reference.ja.md" : "api-reference.md"),
    "utf8"
  );
  const blocks = parseMarkdown(markdown);

  return (
    <PublicShell title="API Reference">
        <p className="mt-5 max-w-2xl text-[14px] leading-7" style={{ color: "color-mix(in srgb, var(--text) 72%, transparent)" }}>
        {locale === "ja"
          ? "対象、兆候、通知、情報源の状態、Huginnへの質問をプログラムから利用できます。APIキーは組織ごとに設定画面から発行し、明示した読み取り権限を持たせます。"
          : "Programmatic access to entities, signals, alerts, source health, and Huginn queries. API keys are issued per organization from Settings and carry explicit read scopes."}
      </p>

      {blocks.map((block, index) => {
        if (block.type === "heading") {
          // The document h1 is replaced by the page title; demote levels by one.
          return block.level === 1 ? null : (
            <h2
              key={index}
              className={`font-semibold ${block.level === 2 ? "mt-10 text-base" : "mt-6 text-sm"}`}
              style={{ color: "var(--text)" }}
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
                  className="text-[14px] leading-7"
                  style={{ color: "color-mix(in srgb, var(--text) 72%, transparent)", marginLeft: `${item.indent * 16}px` }}
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
              className="mono mt-3 overflow-x-auto rounded-[4px] p-4 text-[12px] leading-relaxed"
              style={{ border: "1px solid color-mix(in srgb, var(--text) 18%, transparent)", background: "var(--surface)", color: "color-mix(in srgb, var(--text) 72%, transparent)" }}
            >
              <code>{block.code}</code>
            </pre>
          );
        }
        return (
          <p key={index} className="mt-3 text-[14px] leading-7" style={{ color: "color-mix(in srgb, var(--text) 72%, transparent)" }}>
            <Inline segments={block.segments} />
          </p>
        );
      })}
    </PublicShell>
  );
}
