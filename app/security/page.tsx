import type { Metadata } from "next";
import { ProseSections, PublicShell } from "@/components/ui/public-shell";
import { getLocale } from "@/lib/i18n/locale";

export async function generateMetadata(): Promise<Metadata> {
  return (await getLocale()) === "ja"
    ? { title: "セキュリティ", description: "Odimのセキュリティ対策：組織分離、鍵情報の管理、基盤の堅牢化。" }
    : { title: "Security", description: "Odim's security posture: tenant isolation, key handling, and platform hardening." };
}

const LAST_UPDATED = "July 6, 2026";

const sections = [
  {
    heading: "Tenant Isolation",
    body: [
      "Every signal, entity, alert, memory record, and audit entry is scoped to an organization. Row-level security is enforced at the database layer, and application reads apply organization filters on every query. Organization memory used by the AI layer is never shared across tenants."
    ]
  },
  {
    heading: "Credentials and Key Material",
    body: [
      "API keys and invite tokens are generated server-side, shown exactly once, and stored only as salted hashes — the platform cannot recover them. Keys carry explicit scopes (for example entities:read or huginn:query) and can be revoked instantly. Payment webhooks are verified with HMAC signatures inside a bounded replay window."
    ]
  },
  {
    heading: "Application Hardening",
    body: [
      "All responses carry a strict Content-Security-Policy with per-request nonces, frame-ancestors denial, HSTS, and referrer and permissions policies. Authentication is enforced in middleware before any route logic runs. API routes authorize first, validate input before domain work, apply per-key and per-route rate limits, and return sanitized JSON errors without stack traces."
    ]
  },
  {
    heading: "Fail-Closed Defaults",
    body: [
      "Optional surfaces — self-serve signup, billing, error tracking — are disabled unless explicitly enabled by environment configuration, and their routes return service-unavailable rather than degrading to an unauthenticated path. Production data access fails closed when backing services are unreachable."
    ]
  },
  {
    heading: "Auditability and Observability",
    body: [
      "AI answers carry source references and confidence indicators, and every query, alert, and workflow approval is written to an append-only audit trail. Logs are structured with secret-field and token-shape redaction applied before anything leaves the process; billing events are recorded append-only with idempotent processing."
    ]
  },
  {
    heading: "Ingestion Integrity",
    body: [
      "The platform ingests public-record sources only. Ingestion is idempotent via content fingerprints, source failures are reported per source rather than silently dropped, and freshness SLAs are tracked so stale data is visible instead of masked."
    ]
  },
  {
    heading: "Reporting a Vulnerability",
    body: [
      "If you believe you have found a security issue, report it through your organization's support channel with reproduction details. Do not test against other organizations' data. We acknowledge reports promptly, and we do not pursue good-faith research conducted within these bounds."
    ]
  }
];

const sectionsJa = [
  {
    heading: "組織分離",
    body: [
      "すべての兆候、対象、通知、記憶項目、監査記録は組織単位で管理します。データベース層で行レベルセキュリティを適用し、アプリケーションの読み取り処理でも、すべてのクエリに組織の絞り込みを加えます。AI層が使う組織の記憶情報を、他の組織と共有することはありません。"
    ]
  },
  {
    heading: "認証情報と鍵情報",
    body: [
      "APIキーと招待情報はサーバー側で生成し、一度だけ表示したうえで、復元できない照合用の値としてのみ保存します。キーには明示的な権限（例：entities:read、huginn:query）が付き、即時に無効化できます。支払いWebhookは、制限時間を設けた再送検証の範囲内でHMAC署名を確認します。"
    ]
  },
  {
    heading: "アプリケーションの堅牢化",
    body: [
      "すべての応答に、通信ごとのnonceを使う厳格なContent-Security-Policy、frame-ancestorsの拒否、HSTS、参照元と権限に関する方針を付けます。認証は、各画面の処理が始まる前に適用します。APIは最初に権限を確認し、処理の前に入力を検証し、キー単位と接続先単位の回数制限を適用して、内部の呼び出し履歴を含まない安全なJSONエラーを返します。"
    ]
  },
  {
    heading: "安全側で停止する初期設定",
    body: [
      "セルフサービス登録、請求、エラー追跡などの任意機能は、環境設定で明示的に有効化されない限り無効です。これらのルートは、認証なしの経路へ安易に切り替えず、サービス利用不可を返します。基盤サービスに接続できない場合も、本番データへのアクセスは許可しません。"
    ]
  },
  {
    heading: "監査可能性と可観測性",
    body: [
      "AIの回答には出典と信頼度を示し、すべての質問、通知、処理手順の承認を追記専用の監査記録に書き込みます。記録は構造化し、秘密情報の項目と認証情報の形式を伏せてから別の処理系へ送ります。請求情報も、重複を防いだ追記専用の履歴として記録します。"
    ]
  },
  {
    heading: "データ取り込みの完全性",
    body: [
      "プラットフォームが取り込むのは公開記録の情報源だけです。内容の指紋を使って冪等に取り込み、情報源の障害は黙って破棄せず、情報源ごとに報告します。更新期限（SLA）を追跡し、古いデータを隠さず見える状態にします。"
    ]
  },
  {
    heading: "脆弱性の報告",
    body: [
      "セキュリティ上の問題を見つけたと思われる場合は、再現方法を添えて所属組織のサポート窓口から報告してください。他の組織のデータを対象にテストしないでください。この範囲を守った善意の調査については、速やかに受領をお知らせし、問題にすることはありません。"
    ]
  }
];

export default async function SecurityPage() {
  const locale = await getLocale();
  return (
    <PublicShell title="Security">
      <p className="mono mt-3 text-[11px] tracking-[0.12em]" style={{ color: "color-mix(in srgb, var(--text) 48%, transparent)" }}>
        {locale === "ja" ? "最終更新：2026年7月6日" : `Last updated: ${LAST_UPDATED}`}
      </p>
      <ProseSections sections={locale === "ja" ? sectionsJa : sections} />
    </PublicShell>
  );
}
