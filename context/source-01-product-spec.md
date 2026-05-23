# 01 — PRODUCT SPEC：プロダクト全体仕様

> 前提: `00-VISION.md` を読了していること。

---

## 1. プロダクト構成（全体像）

Odimは **1つのWebアプリケーション** で、8つの画面（Screen）からなる。

```
ØDIM Web App
│
├── 🌍 Reality Map      … 世界の資本移動を地図/地球儀で可視化
├── 💰 Capital Flow     … セクター/エンティティ別の資本フロー
├── 🔍 Entity Intelligence … 企業・SPVの詳細インテリジェンス
├── ⚡ Signal Alerts    … 優先度付きアラート
├── 🤖 Huginn Console   … 自然言語でOntologyに質問するAIエージェント
├── 📊 Watchlist & Briefs … 監視リスト + 日次ブリーフ
├── 📋 Audit Trail      … 全推論・全シグナルの透明性ログ
└── ⚙️ Settings         … アラートルール/APIキー/権限/Ontology Explorer
```

各画面の詳細仕様は `06-SCREENS.md` を参照。

---

## 2. ターゲットユーザー（ペルソナ）

### Tier 1：ヘッジファンド／クオンツファンド 【初期ターゲット・最優先】
- **規模**: 運用資産 $500M〜$10B、リサーチチーム5〜15人
- **顕在ニーズ**: alpha source の枯渇。衛星・クレカデータは競合も持っている
- **潜在ニーズ**: 「他社が買えないデータ」ではなく「他社に見えない因果構造」
- **支払意欲**: $500K〜$2.5M/年（業界調査の中央値）
- **Odimの刺さり方**: 個別の代替データではなく、Ontology上で因果を辿れる唯一の基盤
- **ユースケース**: 中長期（数週間〜数ヶ月）の投資判断。スキャルピングではない。

### Tier 2：事業会社の戦略・M&A・調達部門
- **顕在ニーズ**: 競合の動きを事前に把握したい
- **潜在ニーズ**: 自社サプライヤーが「本当に」キャパを確保しているか検証したい
- **支払意欲**: $200K〜$800K/年

### Tier 3：政府・経済安全保障機関
- **顕在ニーズ**: 外国企業の重要インフラ投資のモニタリング
- **支払意欲**: $1M〜$10M/年（要 on-prem 対応）

### Tier 4：PE／インフラファンド
- **顕在ニーズ**: DC/Grid/Fab投資のDue Diligence高速化
- **支払意欲**: $300K〜$1.5M/年

### 除外：個人投資家
支払意欲が低く、Odimのシグナル粒度（147日のLead time）を活かせる資本規模を持たないため、初期ターゲットから除外。将来Tier制で部分開放の可能性は残すが、設計には含めない。

---

## 3. 機能一覧（What Odim does）

### 3.1 中核機能（Core）

| 機能 | 説明 |
|---|---|
| **Reality Map** | 3D地球儀(マクロ) ⇄ 2D地図(ミクロ)。資本移動・物理アセットを地理可視化。レイヤー切替（Energy/Compute/Land/Water/Cash/Logistics）。時系列スライダー。 |
| **Capital Flow** | セクター別ヒートマップ + エンティティ間サンキー図。「誰が誰にいくら動かしたか」。 |
| **Entity Intelligence** | 企業/SPVの詳細。Reality Score、Capital Commitment Timeline、Ontology Links。 |
| **Signal Alerts** | 優先度付き（Critical/High/Medium/Low）アラートキュー。証拠チェーン付き。 |
| **Huginn Console** | 自然言語でOntologyに質問。因果推論。Scenario Simulator。 |
| **Watchlist & Briefs** | 監視リスト管理。日次ブリーフをメール/Slack配信。 |
| **Audit Trail** | 全推論・全シグナルのソース追跡可能な透明性ログ。 |

### 3.2 差別化機能（Moat — 他社にない5機能）

| 機能 | 説明 | なぜ強いか |
|---|---|---|
| **SPVResolver™** | 匿名SPV/シェル会社（"Project Sucre"等）の親会社をAIで推定 | 他社が持たない唯一の独自能力 |
| **Reality Divergence Score (RDS)** | 「言ってること」と「やってること」の乖離を企業ごとにスコア化 | IR分析の根本的破壊 |
| **Signal Freshness Index** | 各シグナルに「鮮度」と「他社も持っているか」を付与 | 独自シグナルを色分けで強調 |
| **Scenario Simulator** | 「もしXが起きたら」をOntology上で因果連鎖シミュレーション | 静的データでなく動的予測 |
| **Triangulation Confidence** | 1つのCommitmentが何層の独立シグナルで確認されたか可視化 | 信頼性の根幹（PageRank的） |

### 3.3 Huginn / Munin（AI記憶機能）

組織ごとに育つAI。詳細は `05-HUGINN-MUNIN.md`。最初から実装する。

---

## 4. データ層構造（Odimが扱う7つのReality Layer）

| Layer | 内容 | データソース例 |
|---|---|---|
| **Energy** | 電力使用量・送電網・変電所・電力契約(PPA) | FERC, ERCOT, 各州PUC, 電力会社IR |
| **Cash** | 決済・送金・発注・設備投資・M&A・資金調達・契約 | SEC 8-K/S-1, M&A公示, 契約データ |
| **Land** | 工業用地取得・工場用地・DC用地・港湾拡張 | 郡の土地登記, 建設許可, ゾーニング申請 |
| **Compute** | GPU・データセンター・通信帯域・Fiber | DC建設許可, GPU出荷, クラウドリージョン公示 |
| **Water** | 工業用水・冷却水・水インフラ | 水道局取水申請, 環境影響評価 |
| **Raw Materials** | 銅・鉄・半導体材料・レアアース | コモディティ出荷, AIS船舶追跡, 鉱山生産 |
| **Logistics** | 港湾・コンテナ・トラック・倉庫・配送 | AIS, 港湾統計, 物流データ |

加えて、これらと別に **Narrative Layer**（SNS/ニュース/IR/アナリスト）を「検知トリガー兼乖離測定対象」として持つ。

---

## 5. ビジネスモデル

### 5.1 課金形態
**基本料金 + API使用量比例課金**（2026年のAIプロダクトの主流モデル）。

```
月額請求 = ベース料金（Tier別固定） + 従量課金（Huginn API呼び出し量 × 単価）
```

### 5.2 料金Tier（事業化後の想定）

| Tier | 対象 | ベース料金（概算） | 含むもの |
|---|---|---|---|
| **Intelligence** | ヘッジファンド / PE | $20K〜$50K/月 | 全機能 + API + Huginn無制限 + 専用Alert |
| **Enterprise** | 事業会社 / M&A | $5K〜$15K/月 | Map + Entity + Alert + Huginn(制限付) |
| **Sovereign** | 政府機関 | カスタム | On-prem + 機密データ統合 + 専用Ontology |

### 5.3 Freemium
初期は設けない。完全に Enterprise Sales（Direct Sales）。

### 5.4 【重要】事業化前フェーズの実態
本Context Folderが想定する実装フェーズでは：
- 金銭コスト = 0（Claude Pro / ChatGPT Plus のみ）
- AI = Gemini API 無料枠
- データ = 自社スクレイピング（公開データ）
- ホスティング = Vercel / Supabase 無料枠

**この状態は「完全な商用プロダクトのアーキテクチャ・UIを完成させ、無料枠で動作する状態」**。
事業化＝「無料枠APIキーを有料に差し替える + 有料データフィードを追加する」だけ。
コードの書き換えは発生しない（`02-ARCHITECTURE.md` の「設定差し替え原則」）。

---

## 6. Go-To-Market

- **方式**: Direct Sales（直接営業）
- **初期ターゲット地域**: 米国
- **初期ターゲット顧客**: Tier 1 ヘッジファンド
- **対応地域（プロダクトとして）**: グローバル（ただしデータ網羅性は地域差あり。`04-DATA-PIPELINE.md` 参照）

---

## 7. 対応言語

- **UI**: 日本語 / 英語のバイリンガル（i18n対応必須）
- **データ**: 英語ソースが主。UIで日本語表示も可能に。

---

## 8. 対応プラットフォーム

- **PCファースト**（ヘッジファンドのアナリストはPCで分析する）
- **モバイル**: Alert確認のみ対応（フル機能は不要）。レスポンシブだが、Map/Ontologyの複雑操作はPC前提。

---

## 9. 競合との差別化サマリ

| 競合 | 提供物 | Odimの優位性 |
|---|---|---|
| Bloomberg Terminal | 価格+ニュース+チャット | Reality層 / 因果Ontology / AI Native |
| Palantir Gotham/Foundry | Ontology+分析基盤（受託型） | 自前の「世界Ontology」をプロダクトとして販売 |
| Orbital Insight (Terrascope) | 衛星画像分析（単一ソース） | 7層のReality統合 + 因果接続 |
| Kpler / Windward | 海運・コモディティ追跡 | 電力・水・建設・SPVまでカバー |
| Crayon / Klue | 競合インテリジェンス（表層） | 物理シグナルベースのReality検知 |
| AlphaSense | SEC/IR/レポート検索（Narrative） | Reality verification を持つ |

**Odimのポジション**: 「Narrative層のみの製品」と「単一データソース製品」の間の空白地帯。7つのReality層を因果Ontologyで接続し、Narrative→Reality gap をスコア化する唯一のプラットフォーム。
