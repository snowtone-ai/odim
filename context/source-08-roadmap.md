# 08 — ROADMAP：実装順序とマイルストーン

> 前提: 全ファイルを読了していること。

---

## 1. 「全機能を同時にローンチ」の正しい解釈

ユーザーの要望は「段階的にプロダクトを進めるのは好きではない、理想は全機能同時ローンチ」。

これは **「機能を間引いて小さくローンチするな」** という意味であり、
**「実装作業に依存順序を持つな」** という意味ではない（依存順序は技術的必然）。

したがって本ロードマップの原則：
- **設計は一括** — 8画面・全機能の設計（このContext Folder）は既に完成している。
- **実装は依存順** — 下層（DB・Ontology）から上層（UI）へ積む。
- **ローンチは一括** — 全機能が揃った状態で初めて公開する。途中の中途半端な公開はしない。

---

## 2. 実装フェーズ（依存順。各フェーズは「作業の塊」であり、公開単位ではない）

### Phase A：基盤（土台）
- リポジトリ初期化（Next.js 16.2.6 + React 19.2.6 + TypeScript 6.0.3 + Tailwind CSS 4.3.0）。
- `07-DESIGN.md` のデザイントークンを `styles/tokens.css` に実装。
- 共通レイアウト（Sidebar + Topbar）とデザインシステム部品（`components/ui/`）。
- Supabase接続、`03-ONTOLOGY.md` のDBマイグレーション適用。
- `lib/ai/provider.ts`（AI抽象化レイヤー、Gemini無料枠接続）。
- **受け入れ基準**: 空のアプリが起動し、8画面のルーティングが存在し、デザイントークンが効いている。

### Phase B：データ基盤
- `scrapers/` のスクレイパー群（FERC・SEC EDGAR・建設許可を最優先）。
- `.github/workflows/daily-scrape.yml`（GitHub Actions日次cron）。
- `lib/pipeline/`（normalize → ontologize）。
- 過去データのバックフィル（初回の大規模収集）。
- **受け入れ基準**: 日次バッチが動き、`ontology_objects`/`ontology_links` に実データが入る。

### Phase C：推論層
- `lib/resolvers/`：SPVResolver™、RDS、Triangulation、Demand Propagation。
- `lib/pipeline/alert.ts`（アラート生成）。
- **受け入れ基準**: 実データに対しSPV解決・各スコアが算出され、`alerts` が生成される。

### Phase D：Huginn / Munin
- `lib/munin/`（3階層記憶、pgvector、マルチスコープ、ライフサイクル）。
- `lib/huginn/`（マルチシグナル検索、Ontology探索、Gemini推論）。
- `/api/huginn` Route Handler。
- **受け入れ基準**: 自然言語クエリにOntologyベースで回答し、Reasoning Traceと出典が出る。組織分離が機能する。

### Phase E：フロントエンド（5画面）— v3.0完了済み
`06-SCREENS.md` に従い実装。v3.0（2026-05）で完了。8画面→5画面に統合再設計済み：
1. Reality Map（MapLibre GLネイティブ、Palantir Gotham品質）— 完了
2. Entity Intelligence（Capital Flow + Watchlist統合）— 完了
3. Signal Alerts — 完了
4. Huginn（HuginnInput + HuginnConsole インタラクティブClient Component）— 完了
5. Settings（Audit Trail統合）— 完了
- 追加: CommandPalette（Cmd+K）— 完了
- 追加: EntityLink（画面間ナビ）— 完了
- **受け入れ基準**: 全5画面が `07-DESIGN.md` 準拠で動作し、画面遷移が「ぬるっと」している。✓ 達成（pnpm build / typecheck / test 49/49 パス）。

### Phase F：仕上げ・監査
- 認証・組織管理・RLSの最終確認。
- i18n（日英）完成。
- モバイル対応（Alert画面）。
- パフォーマンス最適化（無料枠のレート制限内に収める）。
- セキュリティ監査（組織分離・出典追跡の検証）。
- **受け入れ基準**: 「無料枠で動く完全な商用品質プロダクト」が完成。事業化＝APIキー差し替えのみ。

---

## 3. マイルストーン定義

| マイルストーン | 状態 |
|---|---|
| **M1: Skeleton** | アプリ起動、ルーティング、デザインシステム稼働（Phase A完了） ✓ |
| **M2: Data Alive** | 日次バッチでOntologyに実データ充填（Phase B完了） |
| **M3: Intelligence** | 推論層が動き、アラートが出る（Phase C完了） |
| **M4: Agent** | Huginn/Muninが動作、組織分離OK（Phase D完了） |
| **M5: Full Product** | 5画面完成、全機能統合（Phase E完了） ✓ v3.0達成 |
| **M6: Launch-Ready** | 監査通過、無料枠で動く完全な商用品質（Phase F完了）→ 公開／コンテスト提出 |

---

## 4. 「商用リリース可能な状態」の定義

ユーザーの目標は「MVPではなく、完全な商用リリース可能状態まで一気に作り切る」。
本Context Folderにおける「商用リリース可能」の厳密な定義：

1. 5画面すべてが `07-DESIGN.md` 品質で完成している（v3.0で達成済み）。
2. 7つのReality Layerすべてにデータパイプラインが存在する（網羅率は米国優先で地域差あり）。
3. Huginn/Muninが組織分離込みで動作する。
4. 全推論に出典と信頼度が付き、Audit Trailで追跡できる。
5. 無料枠（Gemini Flash / Supabase / Vercel）で動作する。
6. 事業化への移行が「`.env` のキー差し替え + `config/sources.json` への有料ソース追加」だけで完結する（コード書き換え不要）。

→ この状態を達成すれば、ビジネスプランコンテスト提出・クローズドβ・投資家デモのすべてに耐える。

---

## 5. 各フェーズ共通の品質ゲート

どのフェーズも、完了前に以下を確認：
- [ ] `07-DESIGN.md` のアンチスロップ・チェックリストを全項目クリア。
- [ ] すべての推論・データに出典(`source_refs`)がある。
- [ ] 組織分離（RLS）が破られていない。
- [ ] Google AI Studioで確認した現在のGeminiレート制限（RPM/RPD/TPM）を超えていない。
- [ ] Narrative と Reality を混同していない。
- [ ] `09-GLOSSARY.md` の用語を正しく使っている。
