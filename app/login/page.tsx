import Link from "next/link";
import type { Metadata } from "next";
import { PublicAuthShell } from "@/components/ui/public-shell";
import { getLocale } from "@/lib/i18n/locale";
import { getMessages } from "@/lib/i18n/messages";

export async function generateMetadata(): Promise<Metadata> {
  return (await getLocale()) === "ja" ? { title: "サインイン" } : { title: "Sign In" };
}

export default async function LoginPage() {
  const locale = await getLocale();
  const ja = locale === "ja";
  const publicLabels = getMessages(locale).common.public;

  return (
    <PublicAuthShell
      eyebrow={ja ? "組織の認証" : "ACCESS / ENTERPRISE"}
      title={ja ? "根拠を確認できるワークスペースに入る。" : "Enter the evidence workspace."}
      description={ja ? "Odimのワークスペースは組織の認証基盤を使います。アクセス権、情報源の文脈、分析担当者の操作を正しいチームの範囲に保ちます。" : "Odim workspaces use your organization's identity provider so access, source context, and analyst actions remain scoped to the right team."}
      footer={
        <p className="text-[12px]" style={{ color: "color-mix(in srgb, var(--text) 58%, transparent)" }}>
          {ja ? "Odimを初めて利用する方へ？" : "New to Odim?"}{" "}
          <Link href="/signup" className="transition-colors duration-[var(--motion-micro)] hover:text-[var(--signal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]" style={{ color: "var(--signal)" }}>
            {publicLabels.createWorkspace} <span aria-hidden="true">→</span>
          </Link>
        </p>
      }
    >
      <div>
        <p className="mono text-[11px] tracking-[0.14em]" style={{ color: "var(--evidence)" }}>
          {ja ? "組織の認証へ進む" : "SSO HANDOFF"}
        </p>
        <h2 className="mt-4 text-lg font-medium" style={{ color: "var(--text)" }}>
          {ja ? "組織向けサインインが必要です" : "Enterprise sign-in required"}
        </h2>
        <p className="mt-3 text-[14px] leading-6" style={{ color: "color-mix(in srgb, var(--text) 68%, transparent)" }}>
          {ja ? "組織の認証画面でサインインし、" : "Complete SSO with your identity provider, then return through "}
          <code className="mono text-[12px]" style={{ color: "var(--evidence)" }}>/api/auth/callback</code>
          {ja ? "に戻ってください。" : "."}
        </p>
        <div className="mt-7 border-t pt-5" style={{ borderColor: "color-mix(in srgb, var(--text) 14%, transparent)" }}>
          <p className="text-[12px] leading-5" style={{ color: "color-mix(in srgb, var(--text) 48%, transparent)" }}>
          {ja ? "認証方法とログイン状態は組織が管理します。Odim側で別のパスワードを設けることはありません。" : "Your organization controls the identity provider and session policy. Odim does not create a second password for enterprise access."}
          </p>
        </div>
      </div>
    </PublicAuthShell>
  );
}
