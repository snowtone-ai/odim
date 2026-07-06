import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create Organization" };

import { SignupForm } from "@/components/ui/signup-form";
import { getLocale } from "@/lib/i18n/locale";
import { selfServeSignupEnabled } from "@/lib/onboarding/signup";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const locale = await getLocale();
  const ja = locale === "ja";
  const enabled = selfServeSignupEnabled();

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div
        className="w-full max-w-md rounded-[var(--radius-md)] p-6"
        style={{ background: "var(--surface-primary)", border: "1px solid var(--line-faint)" }}
      >
        <h1 className="text-lg" style={{ color: "var(--text-primary)" }}>
          {ja ? "ワークスペースを作成" : "Create your workspace"}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          {ja
            ? "14日間のトライアルで組織を作成します。クレジットカードは不要です。"
            : "Start a 14-day trial workspace. No credit card required."}
        </p>
        <div className="mt-5">
          {enabled ? (
            <SignupForm
              labels={{
                orgName: ja ? "組織名" : "Organization name",
                orgNamePlaceholder: ja ? "例: Yggdrasil Capital" : "e.g. Yggdrasil Capital",
                email: ja ? "管理者メールアドレス" : "Admin email",
                emailPlaceholder: "you@company.com",
                displayName: ja ? "表示名(任意)" : "Display name (optional)",
                displayNamePlaceholder: ja ? "例: 山田 太郎" : "e.g. Jane Doe",
                submit: ja ? "ワークスペースを作成" : "Create workspace",
                failed: ja ? "作成に失敗しました" : "Signup failed",
                successTitle: ja ? "ワークスペースを作成しました" : "Workspace created",
                successBody: ja
                  ? "次のステップ: 設定画面でAPIキーを発行し、チームを招待してください。"
                  : "Next steps: issue an API key in Settings and invite your team.",
                nextSettings: ja ? "設定を開く" : "Open Settings",
                nextMap: ja ? "コンソールを開く" : "Open Console"
              }}
            />
          ) : (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {ja
                ? "セルフサーブ登録はこの環境では無効です。管理者にお問い合わせいただくか、エンタープライズサインインをご利用ください。"
                : "Self-serve signup is not enabled in this environment. Contact your administrator or use enterprise sign-in."}
            </p>
          )}
        </div>
        <p className="mt-5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          <a href="/login" style={{ color: "var(--text-secondary)" }}>
            {ja ? "エンタープライズSSOでサインイン →" : "Sign in with enterprise SSO →"}
          </a>
        </p>
      </div>
    </main>
  );
}
