# Odim — Reality Intelligence OS

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-RLS-green?logo=supabase)
![Gemini](https://img.shields.io/badge/Gemini-2.5-orange?logo=google)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

> 企業・国家の「公式発表」と「実際の動き」のズレを、物理的・財務的データから可視化するインテリジェンスプラットフォーム

エネルギー許可申請・土地取得・水利権・資本フロー・データセンター建設などの実態シグナルを監視し、公式ナレーティブとの乖離を検知する。AIアナリスト「Huginn」が証拠グラフをもとに質問に答え、公式発表より前の意思決定シグナルを可視化する。

---

## アーキテクチャ

```
公開データソース（SEC/EDGAR・FERC・EIA・特許・港湾統計...）
    │ daily scraper (GitHub Actions)
    ▼
Supabase（PostgreSQL + RLS）
    ├── 7レイヤーシグナル（energy / capital / land / compute / water / materials / logistics）
    └── narrative vs reality 乖離スコア
    │
    ▼
Huginn AI Analyst
    キャッシュ → 長期記憶(Munin) → ライブシグナル → Web検索 の4段階カスケード
    │ 証拠グラフ + 引用付き回答
    ▼
Next.js 16 (App Router) + MapLibre GL v5
```

---

## 主な機能

- エネルギー・資本・土地・コンピューター・水・原材料・物流の7レイヤーシグナルを地図上で可視化
- SEC/EDGAR・FERC・EIA・特許データ・港湾統計などの公開データソースを毎日自動収集
- AIアナリスト「Huginn」に自然言語で質問し、証拠グラフのパスと引用付きで回答
- 企業・エンティティのナレーティブと実態の乖離スコアを可視化
- ドラッグ&ドロップで構築できるカスタムダッシュボード

---

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| フロントエンド | Next.js 16, TypeScript, Tailwind CSS, MapLibre GL v5 |
| バックエンド | Next.js API Routes, カスタムスクレイパー |
| データベース | Supabase（PostgreSQL + RLS） |
| インフラ | GitHub Actions（CI/CD + daily scrape） |
| AI | Google Gemini, Evidence GraphRAG, Munin（長期記憶） |

---

## 設計の工夫

- Huginnの回答はキャッシュ→長期記憶→ライブシグナル→Web検索の4段階カスケードで構成し、推論コストを最小化
- SupabaseのRLSでテナント間データ混入を構造的に防止
- インジェスションはソースごとに新鮮度チェックと実行状態を管理し、失敗が可視化される設計

---

## セットアップ

```bash
cp .env.example .env.local   # Supabase・Gemini認証情報を記入
pnpm install
node scripts/setup.mjs       # DBマイグレーション・デフォルト組織作成
pnpm dev
```

| コマンド | 内容 |
|---|---|
| `pnpm dev` | 開発サーバー |
| `pnpm typecheck` | 型チェック |
| `pnpm test` | テスト（100件） |
| `pnpm build` | 本番ビルド |
| `pnpm verify` | リリース前フルチェック |
| `pnpm scrape` | スクレイパー実行 |

---

## ライセンス

MIT
