import Link from "next/link";
import type { Metadata } from "next";
import { PublicAuthShell } from "@/components/ui/public-shell";
import { InviteAcceptForm } from "@/components/ui/invite-accept-form";
import { getLocale } from "@/lib/i18n/locale";

export const metadata: Metadata = { title: "Accept Invite" };

export const dynamic = "force-dynamic";

export default async function InvitePage({
  searchParams
}: Readonly<{ searchParams: Promise<{ token?: string }> }>) {
  const locale = await getLocale();
  const ja = locale === "ja";
  const { token } = await searchParams;

  return (
    <PublicAuthShell
      eyebrow={ja ? "招待 / ワークスペース" : "INVITATION / WORKSPACE"}
      title={ja ? "チームの証拠スレッドに参加する。" : "Join your team's evidence thread."}
      description={
        ja
          ? "招待されたワークスペースに参加し、ソースから判断までの経路をチームと共有します。"
          : "Join the workspace you were invited to and share the path from source to decision with your team."
      }
      footer={
        <p className="text-[12px]" style={{ color: "color-mix(in srgb, var(--text) 58%, transparent)" }}>
          <Link href="/login" className="transition-colors duration-[var(--motion-micro)] hover:text-[var(--signal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]" style={{ color: "var(--signal)" }}>
            {ja ? "エンタープライズSSOでサインイン" : "Sign in with enterprise SSO"} <span aria-hidden="true">→</span>
          </Link>
        </p>
      }
    >
      <div>
        <p className="mono text-[11px] tracking-[0.14em]" style={{ color: "var(--evidence)" }}>
          {ja ? "招待を確認" : "INVITE ACCEPTANCE"}
        </p>
        <h2 className="mt-4 text-lg font-medium" style={{ color: "var(--text)" }}>
          {ja ? "チームに参加" : "Join your team"}
        </h2>
        <p className="mt-2 text-[14px] leading-6" style={{ color: "color-mix(in srgb, var(--text) 66%, transparent)" }}>
          {ja
            ? "招待リンクからOdimワークスペースに参加します。"
            : "Accept your invite to join the Odim workspace."}
        </p>
        <div className="mt-7">
          <InviteAcceptForm
            token={token ?? ""}
            labels={{
              displayName: ja ? "表示名(任意)" : "Display name (optional)",
              displayNamePlaceholder: ja ? "例: 山田 太郎" : "e.g. Jane Doe",
              submit: ja ? "招待を受諾" : "Accept invite",
              failed: ja ? "受諾に失敗しました" : "Accept failed",
              successTitle: ja ? "参加しました" : "You're in",
              successBody: ja
                ? "ワークスペースへの参加が完了しました。コンソールを開いて開始してください。"
                : "You have joined the workspace. Open the console to get started.",
              openConsole: ja ? "コンソールを開く" : "Open Console",
              missingToken: ja
                ? "招待トークンがありません。招待リンクを確認してください。"
                : "Missing invite token. Check your invite link."
            }}
          />
        </div>
      </div>
    </PublicAuthShell>
  );
}
