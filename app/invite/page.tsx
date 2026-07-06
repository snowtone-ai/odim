import type { Metadata } from "next";

export const metadata: Metadata = { title: "Accept Invite" };

import { InviteAcceptForm } from "@/components/ui/invite-accept-form";
import { getLocale } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  searchParams
}: Readonly<{ searchParams: Promise<{ token?: string }> }>) {
  const locale = await getLocale();
  const ja = locale === "ja";
  const { token } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div
        className="w-full max-w-md rounded-[var(--radius-md)] p-6"
        style={{ background: "var(--surface-primary)", border: "1px solid var(--line-faint)" }}
      >
        <h1 className="text-lg" style={{ color: "var(--text-primary)" }}>
          {ja ? "チームに参加" : "Join your team"}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          {ja
            ? "招待リンクからOdimワークスペースに参加します。"
            : "Accept your invite to join the Odim workspace."}
        </p>
        <div className="mt-5">
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
    </main>
  );
}
