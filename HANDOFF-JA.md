# 引き継ぎ

## Summary

- pm-zero v12.1 の knowledge に合わせ、共有ルールを `CLAUDE.md` に集約し、`AGENTS.md` を Codex 用アダプターへ整理しました。
- `.codex/config.toml` を空のプロジェクト設定として追加し、CI と `scripts/verify.mjs` を標準検証フローへ同期しました。
- stale な deny 重複、issues の解決履歴、未使用の UI 運用文書を整理しました。今回のプロダクト UI・DB 動作変更はありません。

## Task Ledger

- Task: PMZ-001 — DONE
- `tasks.md` / `docs/state.md`: 更新済み
- Remaining ready tasks: なし
- Blocked tasks: なし

## Verification Evidence

- `node scripts/setup.mjs`: passed
- `pnpm verify`: passed（構造チェック、lint、typecheck、143/143 tests、build）
- `pnpm release:audit`: passed（91 checks）
- `git diff --check`: passed
- `gitleaks git --no-banner --redact`: passed（既存の合成テスト値は `.gitleaksignore` に fingerprint を明示）
- `pnpm browser:smoke`: Supabase 接続不成立により `/api/watchtower/runs` が HTTP 500。画面 HTML は主要 6 route で取得できたが、外部環境が必要なため残存リスクとして記録。

## Changed Files

- `CLAUDE.md`, `AGENTS.md`, `.claude/settings.json`, `.codex/config.toml`
- `.gitleaksignore`, `scripts/{setup,verify,release-audit}.mjs`
- `.github/workflows/{ci,daily-scrape}.yml`
- `docs/{issues,state,repo-map}.md`, `tasks.md`, `HANDOFF-JA.md`

## Human Actions Needed

- なし。browser smoke の再確認時は到達可能な Supabase 環境を用意してください。

## Residual Risk

- browser smoke の API 検証だけ、Supabase の到達性・設定に依存して未完了です。標準のローカル決定的検証とリリース監査は成功しています。
