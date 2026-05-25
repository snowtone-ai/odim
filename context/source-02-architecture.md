# 02 — ARCHITECTURE：技術スタックとシステム構成

> 前提: `00-VISION.md`, `01-PRODUCT-SPEC.md` を読了していること。

---

## 1. 設計原則（最重要）

### 原則1：コストゼロ
事業化前は、Claude Pro / ChatGPT Plus 以外の金銭コストを発生させない。すべて無料枠・OSSで構成する。

### 原則2：設定差し替え原則
無料 → 有料への移行は「コード書き換え」ではなく「環境変数の差し替え」で完結する。
- APIキー、データソースURL、レート上限はすべて `.env` に外出し。
- AIプロバイダは抽象化レイヤー（`lib/ai/provider.ts`）越しに呼ぶ。Gemini → Claude/GPT への差し替えが1ファイルで済む。
- データソースは `config/sources.json` で定義。スクレイパー → 有料API への差し替えが設定変更で済む。

### 原則3：単独開発者が Claude Code / CodeX で実装可能な複雑度に収める
- マイクロサービスにしない。モノリス + サーバーレス関数。
- 運用負荷の高いインフラ（自前Kafka、自前k8s）を初期に入れない。
- 「動くもの」を最短で。複雑な最適化は後回し。

---

## 2. 確定技術スタック

### 2.1 フロントエンド

| 要素 | 採用技術 | 理由 |
|---|---|---|
| フレームワーク | **Next.js 16.2.6（App Router）+ React 19.2.6** | SSR/CSR hybrid。Vercel無料枠と完全統合。Next.js公式のVersion 16系ドキュメントとnpm registry確認に基づく。 |
| 言語 | **TypeScript（strict mode）** | 型安全。CodeXの実装ミスを型で検出。 |
| スタイリング | **Tailwind CSS 4.3.0 + 独自デザイントークン** | ただしデフォルトTailwindの見た目は禁止（`07-DESIGN.md`）。 |
| アニメーション | **Motion（旧 Framer Motion）** | 「ぬるっとした」画面遷移・パネル開閉の実現。 |
| 3D地球儀 | **react-globe.gl**（Three.js / WebGL ラッパー） | マクロ表示。Soumaは過去にGlobe実装経験あり。 |
| 2D地図 | **MapLibre GL JS + 無料タイル**（OpenFreeMap または CARTO無料枠） | ミクロ表示。Mapboxは有料枠があるため不採用、MapLibreはOSSで完全無料。 |
| チャート | **visx（D3ベース）または Recharts** | サンキー図・時系列・ヒートマップ。 |
| 状態管理 | **Zustand** | 軽量。WebGLキャンバスとReact UIの即時同期に必要。 |
| 国際化 | **next-intl** | 日英バイリンガル。 |

### 2.2 バックエンド / データ

| 要素 | 採用技術 | 理由 |
|---|---|---|
| DB | **Supabase（PostgreSQL）無料枠** | DB + Auth + Realtime + Storage が1つで揃う。 |
| ベクトル検索 | **pgvector（Supabase内蔵）** | Munin（AI記憶）の意味検索。追加コストゼロ。 |
| グラフ表現 | **PostgreSQL リレーショナル + 再帰CTE**（初期）／ Apache AGE（将来） | 単独開発者にはグラフDBは運用過剰。Ontologyは隣接リスト + 再帰クエリで表現。 |
| 認証 | **Supabase Auth** | エンタープライズSSOは事業化後に追加。 |
| 行レベルセキュリティ | **Supabase RLS** | 組織(org)ごとのデータ分離を強制（Huginn/Munin分断に必須）。 |
| API層 | **Next.js Route Handlers（/app/api）** | バックエンドを別サービスにせず、Next.js内に統合。 |

### 2.3 データパイプライン

| 要素 | 採用技術 | 理由 |
|---|---|---|
| スクレイピング | **Playwright** | FERC/PUC/建設許可サイトの構造化抽出。 |
| スケジューラ | **GitHub Actions（cron）** | ★無料。日次cronでスクレイパーを実行 → Supabaseへ書込。Soumaは既にGitHub利用者。 |
| 変換/正規化 | **TypeScriptスクリプト**（dbtは将来） | 初期は単純なETLスクリプトで十分。 |

> **Kafka不採用の判断**: ユーザーは「無料ならKafka」と言ったが、自前Kafkaは単独開発者には運用負荷が過大。
> かつOdimのユースケースは中長期判断であり、日次バッチで要件を満たす（ユーザー自身も「1日1回更新で良い」と述べている）。
> → **GitHub Actions による日次バッチを採用**。これが「無料 かつ 運用負荷最小」の最適解。

### 2.4 AI

| 要素 | 採用技術 | 理由 |
|---|---|---|
| LLM（事業化前） | **Gemini API 無料枠** | 下記2.5参照。 |
| LLM抽象化 | **`lib/ai/provider.ts`** | Gemini ⇄ Claude/GPT を1ファイルで差し替え可能に。 |
| 埋め込み | **Gemini Embedding（無料枠）または ローカル埋め込み** | Muninのベクトル化。 |

### 2.5 Gemini API（事業化前のAI基盤）— 2026年5月24日時点の正確な情報

リサーチ結果（2026年5月24日時点）:
- Google公式モデル一覧では、モデル名は **stable / preview / latest / experimental** の4種で扱われる。
- 本番・検証の既定は、安定モデル文字列 **`gemini-2.5-flash`** を使う。
- 最新追随が必要な実験・デモ用途では **`gemini-flash-latest`** を環境変数で選べるようにする。ただし `latest` はGoogle側で差し替わるため、監査性が必要な処理では使わない。
- 公式レート制限ページは、RPM / TPM / RPD がモデル・プロジェクト・使用量ティアに依存し、有効な上限は **Google AI Studio で確認する** 方針を明記している。
- Free tier は参加国のユーザー向けに存在するが、実効上限は固定値としてコードや仕様に埋め込まない。
- 429エラー（レート超過）のリトライ処理は必須実装。

**Odimでの採用方針:**
- **主モデル: `gemini-2.5-flash`**（安定モデル指定）
- **最新追随 alias: `gemini-flash-latest`**（実験用途。監査対象の推論には非推奨）
- **軽量処理候補: `gemini-2.5-flash-lite`**（大量処理・要約・分類用途）
- 環境変数 `AI_PROVIDER` / `AI_MODEL` で切り替え。事業化時は有料Geminiモデル、Claude、GPT等へ provider 層で差し替え。
- **429対策**: 指数バックオフ + リトライ。Huginnのクエリはサーバー側でキューイングし、`AI_MAX_RPM` / `AI_MAX_RPD` に設定された現在のAI Studio実効上限に収める。

> **【監査で判明した制約 — 実装者は必ず認識せよ】**
> Gemini無料枠は「ポートフォリオ / デモ / ビジネスコンテスト」には使えるが、
> 複数組織が同時利用する「本番商用」には不足する可能性が高い。
> これは設計の欠陥ではなく、事業化フェーズで `AI_MODEL` と APIキーを有料に差し替えれば解消する想定。
> 無料枠の間は、AI Studioで確認した実効レート上限に合わせて「同時アクティブ組織数」を絞ったクローズドβとして運用する。

### 2.6 ホスティング

| 要素 | 採用技術 | 無料枠での制約 |
|---|---|---|
| フロント | **Vercel 無料枠（Hobby）** | 商用利用は本来Pro必要 → 事業化時にアップグレード |
| バックエンド/DB | **Supabase 無料枠** | DB 500MB、帯域制限あり → 事業化時にアップグレード |
| スクレイパー実行 | **GitHub Actions 無料枠** | 月2,000分（パブリックリポジトリは無制限） |

---

## 3. システム構成図

```
┌──────────────── データ収集（日次バッチ）─────────────────┐
│                                                          │
│  GitHub Actions (cron, 1日1回)                            │
│    └─ Playwright スクレイパー群                            │
│         ├─ FERC / ERCOT / 州PUC                          │
│         ├─ SEC EDGAR (8-K, S-1)                          │
│         ├─ 郡の土地登記 / 建設許可                          │
│         ├─ 水道局取水申請                                  │
│         └─ AIS / コモディティ出荷（公開分）                  │
│              │                                           │
│              ▼ 書き込み                                   │
└──────────────┼───────────────────────────────────────────┘
               │
┌──────────────▼───────────── Supabase ────────────────────┐
│  PostgreSQL                                              │
│    ├─ raw_signals      （生シグナル）                      │
│    ├─ ontology_objects （オブジェクト：03-ONTOLOGY.md）     │
│    ├─ ontology_links   （リンク）                          │
│    ├─ entities         （企業・SPV）                       │
│    ├─ alerts           （生成されたアラート）                │
│    ├─ munin_memory     （AI記憶 + pgvector）               │
│    └─ audit_log        （透明性ログ）                       │
│  + Auth + RLS（org分離）+ Realtime（Alert push）           │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼──────────── Next.js（Vercel）──────────────┐
│  /app/api （Route Handlers）                              │
│    ├─ /api/huginn   … AIエージェント（Gemini呼び出し）       │
│    ├─ /api/signals  … シグナル取得                         │
│    ├─ /api/entities … エンティティ取得                      │
│    └─ /api/alerts   … アラート                             │
│                                                          │
│  /app （8画面のフロントエンド）                              │
│    Reality Map / Capital Flow / Entity / Alerts /         │
│    Huginn Console / Watchlist / Audit / Settings          │
└──────────────────────────────────────────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
   人間ユーザー       AI Agent（外部）
   (ブラウザ)        (API / 将来MCP経由)
```

---

## 4. データフロー（シグナルが価値になるまで）

```
① 収集    GitHub Actions cron → Playwright → 生データ取得
② 正規化  生データ → raw_signals テーブルへ構造化保存
③ Ontology化  raw_signals → オブジェクト/リンクに変換（03-ONTOLOGY.md）
④ 推論    SPVResolver / RDS / Triangulation が因果接続・スコア付与
⑤ アラート  閾値を超えた変化を alerts テーブルへ
⑥ 提示    フロントエンドが Map / Entity / Alert で可視化
⑦ 対話    Huginn が Ontology を辿って自然言語で回答
⑧ 記憶    対話・判断を Munin（org別）に蓄積
⑨ 監査    全ステップを audit_log に記録（ソース追跡可能）
```

---

## 5. ディレクトリ構成（実装の出発点）

```
odim/
├── .env.local                 # APIキー等（gitignore）
├── .env.example               # 環境変数のテンプレート
├── config/
│   └── sources.json           # データソース定義（差し替え可能に）
├── app/
│   ├── (dashboard)/
│   │   ├── map/                # Reality Map
│   │   ├── capital-flow/       # Capital Flow
│   │   ├── entity/             # Entity Intelligence
│   │   ├── alerts/             # Signal Alerts
│   │   ├── huginn/             # Huginn Console
│   │   ├── watchlist/          # Watchlist & Briefs
│   │   ├── audit/              # Audit Trail
│   │   └── settings/           # Settings
│   ├── api/
│   │   ├── huginn/route.ts
│   │   ├── signals/route.ts
│   │   ├── entities/route.ts
│   │   └── alerts/route.ts
│   └── layout.tsx
├── components/
│   ├── globe/                  # react-globe.gl ラッパー
│   ├── map/                    # MapLibre ラッパー
│   ├── charts/                 # サンキー図・時系列等
│   └── ui/                     # デザインシステム部品（07-DESIGN.md準拠）
├── lib/
│   ├── ai/
│   │   └── provider.ts         # AI抽象化（Gemini⇄Claude⇄GPT）
│   ├── huginn/                 # Huginnエージェントロジック
│   ├── munin/                  # Munin記憶ロジック（source-05-huginn-munin.md）
│   ├── ontology/               # Ontology操作
│   ├── resolvers/              # SPVResolver, RDS, Triangulation
│   └── supabase/               # Supabaseクライアント
├── scrapers/                   # Playwrightスクレイパー群
│   ├── ferc.ts
│   ├── sec-edgar.ts
│   ├── building-permits.ts
│   └── ...
├── .github/workflows/
│   └── daily-scrape.yml        # GitHub Actions 日次cron
├── styles/
│   └── tokens.css              # デザイントークン（07-DESIGN.md準拠）
└── supabase/
    └── migrations/             # DBマイグレーション（03-ONTOLOGY.md準拠）
```

---

## 6. 監査で修正した技術的矛盾（実装者への注意）

| 当初案の矛盾 | 修正 |
|---|---|
| 「グローバル launch」+「自社スクレイピング」+「コスト0」 | 全世界の公開データを一度にスクレイピングするのは非現実的。→ プロダクトは「グローバル対応」だが、初期データ網羅は米国優先。Ontologyは国を問わず汎用設計にし、データ充填は段階的（`04-DATA-PIPELINE.md`）。 |
| 「Kafkaでリアルタイム」 | 単独開発・無料・中長期ユースケースの3条件から、Kafkaは過剰。→ GitHub Actions日次バッチを採用。 |
| 「全機能を同時にローンチ」+「完璧な商用品質」+「単独実装」 | 全機能の設計・UIは同時に完成させる。ただし実装は `08-ROADMAP.md` の順序で進める（設計は一括、コーディングは依存順）。「同時ローンチ」は守れる。 |
| 「衛星SARで建設進捗検知」+「コスト0」 | Planet Labs / ICEYE は有料。→ 無料枠では衛星機能のUIは完成させるが、データは「公開された低頻度衛星画像 + 建設許可テキスト」で代替。有料衛星APIは事業化時に `config/sources.json` で追加。 |
| Graph DB（Neo4j等）導入 | 単独開発者には運用過剰。→ PostgreSQLのリレーショナル + 再帰CTEでOntologyを表現。 |
