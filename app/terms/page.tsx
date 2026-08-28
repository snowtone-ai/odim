import type { Metadata } from "next";
import { ProseSections, PublicShell } from "@/components/ui/public-shell";
import { getLocale } from "@/lib/i18n/locale";

export async function generateMetadata(): Promise<Metadata> {
  return (await getLocale()) === "ja"
    ? { title: "利用規約", description: "OdimとAPIの利用条件。" }
    : { title: "Terms of Service", description: "Terms governing use of the Odim Reality Intelligence OS and its API." };
}

const LAST_UPDATED = "July 6, 2026";

const sections = [
  {
    heading: "1. The Service",
    body: [
      "Odim (\"the Service\", \"we\", \"us\") is a reality-intelligence platform that ingests public-record signals — regulatory filings, permits, interconnection queues, procurement records, and similar sources — and connects them into source-referenced, confidence-scored intelligence for organizations.",
      "The Service provides detection and analysis of publicly observable capital commitments. It does not provide price predictions, investment advice, legal advice, or recommendations to buy or sell any security or asset."
    ]
  },
  {
    heading: "2. Accounts and Organizations",
    body: [
      "Access is provisioned per organization. You are responsible for maintaining the confidentiality of your credentials, API keys, and invite links, and for all activity that occurs under your organization's account.",
      "You must notify us promptly of any unauthorized use of your account or any other breach of security you become aware of."
    ]
  },
  {
    heading: "3. Acceptable Use",
    body: [
      "You may not: attempt to access data belonging to another organization; probe, scan, or test the vulnerability of the Service without written authorization; circumvent rate limits, authentication, or usage restrictions; resell or redistribute the Service or its output as a competing product; or use the Service in violation of applicable law, including securities and sanctions regulations.",
      "API access is subject to the key scopes granted to you and the rate limits of your plan. We may suspend keys or accounts that exceed reasonable use or endanger platform integrity."
    ]
  },
  {
    heading: "4. Subscriptions and Billing",
    body: [
      "Paid plans, trial periods, seat counts, and API rate ceilings are described at the point of purchase. Fees are billed through our payment processor and are non-refundable except where required by law.",
      "We may change plan pricing or entitlements with reasonable advance notice; changes apply from your next billing period."
    ]
  },
  {
    heading: "5. Intelligence Output and No Reliance",
    body: [
      "Signals, scores, alerts, and AI-generated answers are produced from public sources and probabilistic models. Every output carries source references and confidence indicators, and narrative data is never treated as ground truth — but outputs may still be incomplete, delayed, or wrong.",
      "You are solely responsible for decisions made using the Service. To the maximum extent permitted by law, we disclaim all liability for trading, investment, procurement, or policy decisions based on Service output."
    ]
  },
  {
    heading: "6. Intellectual Property",
    body: [
      "We retain all rights in the Service, its software, ontology, and models. You retain all rights in the data and queries you submit. You receive a limited, non-exclusive, non-transferable license to use Service output for your organization's internal purposes for the duration of your subscription."
    ]
  },
  {
    heading: "7. Termination",
    body: [
      "You may stop using the Service at any time. We may suspend or terminate access for material breach of these terms, non-payment, or where required by law. Upon termination, your organization's data is retained or deleted in accordance with our Privacy Policy."
    ]
  },
  {
    heading: "8. Disclaimers and Limitation of Liability",
    body: [
      "The Service is provided \"as is\" and \"as available\" without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, and non-infringement.",
      "To the maximum extent permitted by law, our aggregate liability arising out of or relating to the Service is limited to the fees you paid in the twelve months preceding the claim. We are not liable for indirect, incidental, consequential, or punitive damages."
    ]
  },
  {
    heading: "9. Changes to These Terms",
    body: [
      "We may update these terms from time to time. Material changes will be announced through the Service or by email with reasonable advance notice. Continued use after the effective date constitutes acceptance."
    ]
  },
  {
    heading: "10. Governing Law and Contact",
    body: [
      "These terms are governed by the laws of Japan, without regard to conflict-of-law principles. Disputes are subject to the exclusive jurisdiction of the Tokyo District Court.",
      "Questions about these terms can be raised through your organization's support channel."
    ]
  }
];

const sectionsJa = [
  {
    heading: "1. 本サービス",
    body: [
      "Odim（以下「本サービス」「当社」といいます）は、規制当局への届出、許認可、接続待ち案件、調達記録などの公開記録に含まれる兆候を取り込み、出典を参照でき信頼度を付けた分析情報として組織向けに結び付ける現実分析プラットフォームです。",
      "本サービスは、公開情報として確認できる資本投下の確定を検出・分析します。価格予測、投資助言、法律上の助言、証券や資産の売買の推奨は行いません。"
    ]
  },
  {
    heading: "2. アカウントと組織",
    body: [
      "アクセスは組織単位で提供します。認証情報、APIキー、招待リンクの機密性を保ち、組織のアカウントで行われるすべての活動を管理する責任は利用者にあります。",
      "アカウントの不正利用、その他把握したセキュリティ侵害については、速やかに当社へ通知してください。"
    ]
  },
  {
    heading: "3. 許可されない利用",
    body: [
      "次の行為をしてはなりません：他の組織のデータへアクセスしようとすること、書面による許可なく本サービスの脆弱性を調査・スキャン・テストすること、レート制限・認証・利用制限を回避すること、本サービスまたは出力を競合製品として再販売・再配布すること、証券規制や制裁規制を含む適用法令に違反して利用すること。",
      "APIの利用は、付与されたキーの権限とプランのレート制限に従います。合理的な範囲を超えて利用したキーやアカウント、プラットフォームの完全性を脅かすキーやアカウントを、当社は停止できます。"
    ]
  },
  {
    heading: "4. 契約と請求",
    body: [
      "有料プラン、試用期間、利用席数、APIのレート上限は購入時に表示します。料金は当社の決済処理事業者を通じて請求し、法令で必要とされる場合を除き返金しません。",
      "当社は、十分な事前通知を行ったうえで料金プランや利用できる機能を変更できます。変更は次の請求期間から適用します。"
    ]
  },
  {
    heading: "5. 分析情報の出力と依拠の禁止",
    body: [
      "兆候、評価値、通知、AIが生成する回答は、公開情報と確率モデルから作られます。すべての出力に出典と信頼度を示しますが、報道情報を絶対的な事実として扱うことはなく、出力に不足、遅延、誤りが含まれる場合があります。",
      "本サービスを使って行う判断については、利用者が単独で責任を負います。法令で認められる最大限の範囲で、本サービスの出力に基づく取引、投資、調達、政策上の判断について、当社は一切の責任を負いません。"
    ]
  },
  {
    heading: "6. 知的財産",
    body: [
      "本サービス、そのソフトウェア、データ構造、モデルに関するすべての権利は当社が保持します。利用者が送信するデータと質問に関する権利は利用者に帰属します。利用者には、契約期間中、組織内の目的に限って本サービスの出力を使う、限定的・非独占的・譲渡不可のライセンスを付与します。"
    ]
  },
  {
    heading: "7. 利用の終了",
    body: [
      "利用者はいつでも本サービスの利用を停止できます。当社は、本規約への重大な違反、料金の未払い、または法令上必要な場合にアクセスを停止または終了できます。終了後の組織データは、プライバシーポリシーに従って保持または削除します。"
    ]
  },
  {
    heading: "8. 免責と責任の制限",
    body: [
      "本サービスは、明示または黙示を問わず、商品性、特定目的への適合性、権利非侵害を含むいかなる保証もなく、「現状有姿」かつ「提供可能な範囲」で提供します。",
      "法令で認められる最大限の範囲で、本サービスに起因または関連して当社が負う責任の総額は、請求の前12か月間に利用者が支払った料金を上限とします。間接損害、付随的損害、結果的損害、懲罰的損害について当社は責任を負いません。"
    ]
  },
  {
    heading: "9. 本規約の変更",
    body: [
      "当社は、本サービスの発展に応じて本規約を随時更新できます。重要な変更は、十分な事前通知を行ったうえで本サービスまたはメールでお知らせします。変更の発効日以後も利用を続けた場合、変更後の規約に同意したものとみなします。"
    ]
  },
  {
    heading: "10. 準拠法と問い合わせ",
    body: [
      "本規約は、法の抵触に関する原則にかかわらず、日本法に準拠します。紛争については、東京地方裁判所を専属的合意管轄裁判所とします。",
      "本規約についての質問は、所属組織のサポート窓口から問い合わせてください。"
    ]
  }
];

export default async function TermsPage() {
  const locale = await getLocale();
  return (
    <PublicShell title="Terms of Service">
      <p className="mono mt-3 text-[11px] tracking-[0.12em]" style={{ color: "color-mix(in srgb, var(--text) 48%, transparent)" }}>
        {locale === "ja" ? "最終更新：2026年7月6日" : `Last updated: ${LAST_UPDATED}`}
      </p>
      <ProseSections sections={locale === "ja" ? sectionsJa : sections} />
    </PublicShell>
  );
}
