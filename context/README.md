# ODIM Context Folder for Implementation

> このフォルダは、**AIエージェント（Claude Code等）がOdimというプロダクトを正確に理解し、ゼロから実装できるようにするための正典 (canonical source)** です。

---

## このフォルダの読み方

実装者は **必ず以下の順序で** 読んでください。各ファイルは前のファイルの前提を共有します。

| # | ファイル | 内容 | 誰が読むべきか |
|---|---|---|---|
| 00 | source-00-vision.md | Odimとは何か。Mission / 哲学 / 解く問題 | 全員（最初に必読） |
| 01 | source-01-product-spec.md | プロダクト全体仕様。機能・ターゲット・ビジネスモデル | 全員 |
| 02 | source-02-architecture.md | 技術スタック・システム構成・データフロー | 実装者 |
| 03 | source-03-ontology.md | Capital Fixation Ontology（データモデルの中核） | 実装者（DB設計時） |
| 04 | source-04-data-pipeline.md | データ収集・スクレイピング・更新戦略 | バックエンド実装者 |
| 05 | source-05-huginn-munin.md | AIエージェントの思考・記憶アーキテクチャ | AI機能実装者 |
| 06 | source-06-screens.md | 全画面の詳細仕様（5画面 v3.0） | フロントエンド実装者 |
| 07 | source-07-design.md | デザインシステム（色・フォント・余白・モーション） | フロントエンド実装者（最重要） |
| 08 | source-08-roadmap.md | 実装順序・マイルストーン・受け入れ基準 | 全員 |
| 09 | source-09-glossary.md | Odim固有用語の定義集 | 全員（参照として随時） |
| 10 | source-10-decisions.md | 重要な意思決定の記録・監査結果 | 設計判断に迷ったとき |

---

## 絶対に違反してはいけないこと

1. **コストゼロ原則** — 事業化前は、Claude Pro / ChatGPT Plus 以外の金銭コストを発生させない。すべて無料枠・OSSで構成する（詳細は source-02-architecture.md）。
2. **設定差し替え原則** — 無料から有料への移行は「コード書き換え」ではなく「環境変数の差し替え」で完結する。APIキー・データソースURLはすべて .env に外出しする。
3. **Reality > Narrative 原則** — Odimの全機能は、「物語(Narrative)」ではなく「現実(Reality)」を優先する（詳細は source-00-vision.md）。
4. **Ontologyファースト原則** — データは「数字の行」ではなく、オブジェクトとリンクの「因果のグラフ」として扱う（詳細は source-03-ontology.md）。
5. **アンチスロップ原則** — フロントエンドは「いかにもAIが作った」見た目を排除する（詳細は source-07-design.md）。
6. **組織分離原則** — Huginn/Munin（AI機能）は、組織(org)ごとに完全にデータ分断する（詳細は source-05-huginn-munin.md）。

---

## プロダクト一行要約

**Odim** = フェイクとノイズに溢れた世界で、企業・国家の「本当の意思決定」を、公式発表より前に検知する Reality Intelligence OS。

- 製品名: **Odim**（北欧神話の主神オーディン、使鴉・Huginn（思考）/ Munin（記憶）に由来）
- タグライン: **"No fakes. No noise. Just truth, and profit."**（短縮形: "Seize truth. Seize profit."）

---

## バージョン

- Context Folder Version: 3.0（2026-05）
- 主要変更: 8画面から5画面へ統合、Globe廃止、CommandPalette追加、Huginn UI簡略化
- 想定実装者: Claude Code / AI Agent
