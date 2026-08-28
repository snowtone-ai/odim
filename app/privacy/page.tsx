import type { Metadata } from "next";
import { ProseSections, PublicShell } from "@/components/ui/public-shell";
import { getLocale } from "@/lib/i18n/locale";

export async function generateMetadata(): Promise<Metadata> {
  return (await getLocale()) === "ja"
    ? { title: "プライバシーポリシー", description: "Odimが組織・アカウントのデータを収集、利用、保護する方法。" }
    : { title: "Privacy Policy", description: "How Odim collects, uses, and protects organization and account data." };
}

const LAST_UPDATED = "July 6, 2026";

const sections = [
  {
    heading: "1. What This Policy Covers",
    body: [
      "This policy describes how Odim handles personal and organizational data when you use the platform, its dashboard, and its API. It covers account data you provide, operational data the Service generates, and the public-record data the Service ingests."
    ]
  },
  {
    heading: "2. Data We Collect",
    body: [
      "Account data: name or handle, work email address, organization membership, and role, provided at signup or via an organization invite.",
      "Operational data: authentication events, API request logs (route, method, status, timing), audit-trail entries for queries and workflow approvals, and billing state for your organization. API keys and invite tokens are stored only as salted hashes — the Service cannot recover the original values.",
      "Ingested data: signals collected from public sources such as regulatory filings, permits, and procurement records. This data concerns organizations and public actors, not Service users; it is processed to build entity intelligence and is attributed to its original public source."
    ]
  },
  {
    heading: "3. How We Use Data",
    body: [
      "We use account and operational data to operate the Service: authenticating access, enforcing per-organization isolation, applying plan entitlements and rate limits, maintaining audit trails, detecting abuse, and diagnosing failures.",
      "We do not sell personal data, and we do not use your organization's queries or private memory to train models for other customers. Organization memory is isolated per tenant."
    ]
  },
  {
    heading: "4. Processors and Subprocessors",
    body: [
      "The Service runs on infrastructure and managed services that process data on our behalf: database and authentication hosting (Supabase), payment processing (Stripe — card details never touch our servers), AI model providers used to answer queries (query text and retrieved context are sent for inference), and error-tracking ingestion for operational diagnostics with secret redaction applied before delivery.",
      "Each processor receives only the data required for its function."
    ]
  },
  {
    heading: "5. Cookies and Sessions",
    body: [
      "The Service uses a session cookie for authenticated access and a locale preference cookie. It does not use third-party advertising or cross-site tracking cookies."
    ]
  },
  {
    heading: "6. Retention and Deletion",
    body: [
      "Account and organization data is retained while your subscription is active. Audit trails and billing event records are retained as append-only history for integrity and compliance purposes.",
      "When an organization is closed, its account data and tenant-isolated memory are deleted or irreversibly anonymized within a reasonable period, except where retention is required by law (for example, billing records)."
    ]
  },
  {
    heading: "7. Security",
    body: [
      "Data is encrypted in transit, tenant isolation is enforced at the database layer with row-level security, secrets and key material are hashed or redacted in logs, and access to production systems is restricted. See the Security page for the full posture."
    ]
  },
  {
    heading: "8. Your Rights",
    body: [
      "Subject to applicable law, you may request access to, correction of, or deletion of your personal data, and you may object to or restrict certain processing. Requests can be made through your organization's administrator or support channel and will be honored within the timelines required by applicable law, including the APPI (Japan) and, where applicable, the GDPR."
    ]
  },
  {
    heading: "9. Changes and Contact",
    body: [
      "We may update this policy as the Service evolves; material changes will be announced with reasonable advance notice. Privacy questions and requests can be raised through your organization's support channel."
    ]
  }
];

const sectionsJa = [
  {
    heading: "1. 本ポリシーの対象",
    body: [
      "本ポリシーでは、プラットフォーム、その分析画面、APIを利用する際にOdimが個人データと組織データをどのように扱うかを説明します。利用者が提供するアカウントデータ、本サービスが生成する運用データ、本サービスが取り込む公開記録のデータを対象とします。"
    ]
  },
  {
    heading: "2. 収集するデータ",
    body: [
      "アカウントデータ：登録時または組織からの招待を通じて提供される氏名またはハンドルネーム、業務用メールアドレス、組織への所属、役割。",
      "運用データ：認証の履歴、API呼び出しの記録（接続先、通信方式、結果、処理時間）、質問と処理手順の承認履歴、組織の請求状態。APIキーと招待情報は復元できない照合用の値としてのみ保存します。",
      "取り込みデータ：規制当局への届出、許認可、調達記録などの公開情報源から収集した兆候。これは本サービスの利用者ではなく組織や公的な関係者に関するデータであり、対象分析を構築するために処理し、元の公開情報源を記載します。"
    ]
  },
  {
    heading: "3. データの利用方法",
    body: [
      "アカウントデータと運用データは、本サービスの運営、アクセス認証、組織ごとの分離、プランの利用条件とレート制限の適用、監査記録の維持、不正利用の検知、障害の調査に利用します。",
      "個人データを販売しません。また、利用者の組織の質問や非公開の記憶情報を、他の顧客向けモデルの学習には利用しません。組織の記憶情報は組織ごとに分離します。"
    ]
  },
  {
    heading: "4. 委託先と再委託先",
    body: [
      "本サービスは、当社に代わってデータを処理する基盤と管理サービス上で運営します。データベースと認証のホスティング（Supabase）、決済処理（Stripe。カード情報が当社のサーバーに届くことはありません）、質問への回答に使うAIモデル提供者（質問文と取得した文脈を推論のために送信）、運用診断のためのエラー追跡の取り込み（送信前に秘密情報を伏せます）が含まれます。",
      "各委託先が受け取るのは、その機能に必要なデータだけです。"
    ]
  },
  {
    heading: "5. Cookieとセッション",
    body: [
      "本サービスは、認証済みアクセスのためのセッションCookieと、表示言語の設定を保存するCookieを使います。第三者広告用のCookieや、サイトをまたいだ追跡用Cookieは使いません。"
    ]
  },
  {
    heading: "6. 保持と削除",
    body: [
      "アカウントデータと組織データは、契約が有効な間保持します。監査記録と請求イベントの記録は、完全性とコンプライアンスのため、追記専用の履歴として保持します。",
      "組織が閉鎖された場合、そのアカウントデータと組織ごとに分離された記憶情報は、合理的な期間内に削除または復元できない形で匿名化します。ただし、請求記録など法令で保持が必要なものを除きます。"
    ]
  },
  {
    heading: "7. セキュリティ",
    body: [
      "データは通信中に暗号化し、データベース層の行レベルセキュリティで組織分離を適用します。秘密情報と鍵情報はハッシュ化するかログで伏せ、本番システムへのアクセスを制限します。対策の詳細はセキュリティページをご覧ください。"
    ]
  },
  {
    heading: "8. 利用者の権利",
    body: [
      "適用法令の範囲で、利用者は個人データへのアクセス、訂正、削除を請求し、特定の処理に異議を申し立てたり制限を求めたりできます。請求は所属組織の管理者またはサポート窓口から行えます。APPI（日本）や、該当する場合のGDPRを含む適用法令が定める期限内に対応します。"
    ]
  },
  {
    heading: "9. 変更と問い合わせ",
    body: [
      "本サービスの発展に応じて、このポリシーを更新することがあります。重要な変更は十分な事前通知を行ってお知らせします。プライバシーに関する質問や請求は、所属組織のサポート窓口から問い合わせてください。"
    ]
  }
];

export default async function PrivacyPage() {
  const locale = await getLocale();
  return (
    <PublicShell title="Privacy Policy">
      <p className="mono mt-3 text-[11px] tracking-[0.12em]" style={{ color: "color-mix(in srgb, var(--text) 48%, transparent)" }}>
        {locale === "ja" ? "最終更新：2026年7月6日" : `Last updated: ${LAST_UPDATED}`}
      </p>
      <ProseSections sections={locale === "ja" ? sectionsJa : sections} />
    </PublicShell>
  );
}
