import Link from "next/link";
import type { Metadata } from "next";
import { PublicAuthShell } from "@/components/ui/public-shell";
import { SignupForm } from "@/components/ui/signup-form";
import { getLocale } from "@/lib/i18n/locale";
import { selfServeSignupEnabled } from "@/lib/onboarding/signup";

export async function generateMetadata(): Promise<Metadata> {
  return (await getLocale()) === "ja" ? { title: "ワークスペースを作成" } : { title: "Create Organization" };
}

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const locale = await getLocale();
  const ja = locale === "ja";
  const enabled = selfServeSignupEnabled();

  return (
    <PublicAuthShell
      eyebrow={ja ? "登録 / ワークスペース" : "ONBOARDING / WORKSPACE"}
      title={ja ? "根拠を追えるチームの作業場を作る。" : "Create a workspace for decisions you can verify."}
      description={
        ja
          ? "公開記録を組織の視点で追跡し、出典から判断に至る経路をチームで共有できます。"
          : "Track public records through your organization's lens and keep the path from source to decision visible to the team."
      }
      footer={
        <p className="text-[12px]" style={{ color: "color-mix(in srgb, var(--text) 58%, transparent)" }}>
          <Link href="/login" className="transition-colors duration-[var(--motion-micro)] hover:text-[var(--signal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]" style={{ color: "var(--signal)" }}>
            {ja ? "組織の認証でサインイン" : "Sign in with enterprise SSO"} <span aria-hidden="true">→</span>
          </Link>
        </p>
      }
    >
      <div>
        <p className="mono text-[11px] tracking-[0.14em]" style={{ color: "var(--evidence)" }}>
          {ja ? "14日間 / クレジットカード不要" : "14 DAYS / NO CREDIT CARD"}
        </p>
        <h2 className="mt-4 text-lg font-medium" style={{ color: "var(--text)" }}>
          {ja ? "ワークスペースを作成" : "Create your workspace"}
        </h2>
        <p className="mt-2 text-[14px] leading-6" style={{ color: "color-mix(in srgb, var(--text) 66%, transparent)" }}>
          {ja
            ? "14日間の試用版として組織を作成します。クレジットカードは不要です。"
            : "Start a 14-day trial workspace. No credit card required."}
        </p>
        <div className="mt-7">
          {enabled ? (
            <SignupForm
              labels={{
                orgName: ja ? "組織名" : "Organization name",
                orgNamePlaceholder: ja ? "例: Yggdrasil Capital" : "e.g. Yggdrasil Capital",
                email: ja ? "管理者メールアドレス" : "Admin email",
                emailPlaceholder: "you@company.com",
                displayName: ja ? "表示名（任意）" : "Display name (optional)",
                displayNamePlaceholder: ja ? "例: 山田 太郎" : "e.g. Jane Doe",
                submit: ja ? "ワークスペースを作成" : "Create workspace",
                failed: ja ? "作成に失敗しました" : "Signup failed",
                successEyebrow: ja ? "ワークスペースの準備ができました" : "WORKSPACE READY",
                trialLabel: ja ? "試用期間の終了日" : "trial ends",
                successTitle: ja ? "ワークスペースを作成しました" : "Workspace created",
                successBody: ja
                  ? "次のステップ: 設定画面でAPIキーを発行し、チームを招待してください。"
                  : "Next steps: issue an API key in Settings and invite your team.",
                nextSettings: ja ? "設定を開く" : "Open Settings",
                nextMap: ja ? "分析画面を開く" : "Open Console"
              }}
            />
          ) : (
            <p className="border-l pl-4 text-[14px] leading-6" style={{ borderColor: "var(--critical)", color: "color-mix(in srgb, var(--text) 66%, transparent)" }}>
              {ja
                ? "利用者自身による登録はこの環境では無効です。管理者にお問い合わせいただくか、組織の認証をご利用ください。"
                : "Self-serve signup is not enabled in this environment. Contact your administrator or use enterprise sign-in."}
            </p>
          )}
        </div>
      </div>
    </PublicAuthShell>
  );
}
