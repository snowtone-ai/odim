# 06 — SCREENS：全画面の詳細仕様

> 前提: `01-PRODUCT-SPEC.md`, `03-ONTOLOGY.md` を読了していること。
> 各画面のビジュアル・色・モーションは `07-DESIGN.md` に従うこと。

---

## 共通レイアウト

```
┌──────┬────────────────────────────────────────────┐
│      │  Topbar（画面タイトル / ライブ状態 / 操作）      │
│ Side ├────────────────────────────────────────────┤
│ bar  │                                            │
│      │           Screen Content                   │
│      │                                            │
└──────┴────────────────────────────────────────────┘
```

- **Sidebar**: 8画面へのナビゲーション。常時表示。アクティブ画面をハイライト。
- **Topbar**: 画面名、ライブ更新インジケータ、画面固有の操作ボタン。
- **画面遷移**: `07-DESIGN.md` のモーション規定に従い、滑らかにクロスフェード + スライド。

---

## Screen 1: 🌍 Reality Map

### 目的
世界の資本移動と物理アセットを地理的に可視化する、Odimの「顔」となる画面。

### Globe か 2D か（確定した設計判断）
**両方を採用し、ズーム階層でシームレスに切り替える。**

```
3D Globe（マクロ）
  ↓ ズームイン（滑らかに地球が展開）
2D Map（ミクロ：国 → 地域 → 都市 → 用地）
```

- **3D Globe = エントリー & マクロ**: 大陸間の資本フローを「弧（arc）」で表現。Odimの「世界OS」アイデンティティを視覚化。`react-globe.gl` で実装。
- **2D Map = 作業ビュー**: 国・地域・都市・用地(parcel)レベルにズームすると2D地図(MapLibre)に切り替わり、変電所・Fab・港湾などのノードを精密に表示。用地レベルでは衛星画像オーバーレイ。
- **理由**: Globeは「資本の世界的な流れ」を直感的に見せ、ブランド体験として強い。2Dは「特定地点の精密分析」に向く。Windy.comと同じ二刀流が最適解。

### レイヤー切り替え
画面左に7レイヤーのトグル：Energy / Compute / Land / Water / Cash / Logistics / Raw Materials。ON/OFFで地図上の表示要素が変わる。

### 時系列スライダー
画面下部に時間軸スライダー：「過去12ヶ月の資本固定の積み上がり」を再生でき、未来側には「予測パイプライン」を表示。

### 右パネル：Live Signal Feed
最新シグナルのストリーム。各シグナルはレイヤー色でタグ付け。クリックで該当オブジェクトの詳細へ。

### データ
`ontology_objects`（PhysicalAsset, GeoLocation）+ `ontology_links` + `raw_signals`。

### 主要インタラクション
- ノードクリック → Entity Intelligence へ遷移。
- フローライン（arc）ホバー → 資本フローの詳細ツールチップ。
- レイヤートグル → 表示要素のフィルタ。

---

## Screen 2: 💰 Capital Flow

### 目的
「誰が誰にいくら資本を動かしたか」をセクター・地理・エンティティの3軸で可視化。

### 構成
1. **セクター・ヒートマップ**（上部）: 7セクター（AI Infra / Semiconductor / Grid / Mining / Defense / Water / Logistics）の資本コミット額をヒートマップ表示。額の大きさで色強度。クリックで詳細展開。
2. **サンキー図**（中央）: エンティティ間の資本フロー。「Microsoft → 電力インフラ → Entergy」のような流れを帯の太さ=金額で表現。`visx` または D3 のSankeyレイアウトでHTML/SVG描画。
3. **地理分布**（右）: 選択セクターの資本が地域別にどう配分されているか。
4. **Narrative→Reality Gap テーブル**（下部）: 各エンティティの「Odim検知 vs 公式発表」のリード日数とRDS。

### データ
`ontology_objects`（CapitalCommitment）+ `ontology_links`（commits_capital_to, funds）。RDSは `lib/resolvers/rds.ts`。

---

## Screen 3: 🔍 Entity Intelligence

### 目的
1つの企業・SPVの「すべてのReality」を1画面に集約（Palantir Gothamの COV = Context Overview に相当）。

### 構成（3カラム）
1. **左：Entityリスト**: 検索 + フィルタ。Top Capital Movers と Unresolved SPVs を並べる。
2. **中央：Entity詳細**:
   - ヒーロー（社名 + Reality Score バー）。
   - KPIカード（Total Committed / Power Reserved / DC Footprint / Narrative Lead）。
   - **Capital Commitment Timeline**: そのEntityのReality層検知の時系列。Narrative Layer（公式発表）も同じ軸に並べ、「Odimが何日先行したか」を視覚化。
3. **右：Ontology Links**: そのEntityに繋がるオブジェクト（電力契約 / 物理アセット / SPV / サプライチェーン）を型別に表示。"Search Around"（再帰CTEでN-hop探索）。

### SPVResolver™ パネル
SPVを選択した場合、親会社候補と確率（"Meta 88% / xAI 42%"）、解決根拠（`resolution_evidence`）を表示。

### Triangulation Confidence UI
各 CapitalCommitment が「7層中いくつのReality層で確認されたか」をビジュアル表示。

### データ
`ontology_objects` + `ontology_links` + 各種resolver出力。

---

## Screen 4: ⚡ Signal Alerts

### 目的
重要な変化を優先度付きで通知する。顧客のDAU/粘着を決める画面。

### 構成（2カラム）
1. **左：アラートキュー**: Critical / High / Medium / Low の4優先度でグループ化。各アラートはタイトル・説明・タグ・時刻。
2. **右：アラート詳細**: 選択アラートのSignal Chain（時系列の証拠連鎖）、親会社候補スコア、Evidence Sources（出典リンク）、操作ボタン（"Huginnに質問" / "Watch Entity"）。

### Alert Rule Builder
ユーザーが独自のアラート条件を設定（"私のWatchlist上の企業が新規電力申請をしたら通知" 等）。

### データ
`alerts` テーブル。Realtime（Supabase）で新着をプッシュ。

---

## Screen 5: 🤖 Huginn Console

### 目的
自然言語でOntologyに質問するAIエージェント画面（`05-HUGINN-MUNIN.md`）。

### 構成（2カラム）
1. **左：対話エリア**: 質問入力 + 回答表示。回答にはReasoning Trace（Huginnが辿った因果鎖）と出典を埋め込む。下部に入力欄。
2. **右：サイドパネル**:
   - **Reasoning Trace**: Huginnが探索したOntologyノードのリスト。
   - **Sources**: 回答の出典。
   - **Munin インジケータ**: 「この組織のMuninは N 件の記憶を持つ」（組織の成長を可視化）。
   - **Quick Queries**: よく使うクエリのショートカット。

### Scenario Simulator
「もしXが起きたら」の仮定クエリに対応。因果連鎖の予測を出力。

### データ
`/api/huginn` 経由。Gemini（無料枠）+ Munin（pgvector）+ Ontology。

---

## Screen 6: 📊 Watchlist & Briefs

### 目的
監視対象を登録し、日次ブリーフを受け取る。

### 構成
1. **Watchlist管理**: 監視したいEntity / セクター / 地域を登録。
2. **Daily Brief プレビュー**: 「あなたのWatchlist上の企業について、昨夜のReality層変化サマリー」をHuginnが生成。
3. **配信設定**: メール / Slack連携の設定。

### データ
ユーザーのwatchlist設定 + `alerts` + Huginn生成サマリー。

---

## Screen 7: 📋 Audit Trail

### 目的
全推論・全シグナルのソース追跡可能な透明性ログ。金融機関のコンプライアンス要件であり、Odimの差別化要素。

### 構成
時系列テーブル：Timestamp / Event Type / Object / Source / Confidence / Agent Action。
CSV/PDFエクスポート対応。

### データ
`audit_log` テーブル。

---

## Screen 8: ⚙️ Settings

### 目的
設定・管理。

### 構成
- **Alert Rules**: アラート条件の管理。
- **API Key管理**: 外部AI Agentが叩くためのAPIキー発行。
- **Team権限管理**: 組織内のユーザーと役割（analyst / admin）。
- **Ontology Explorer**（上級者向け・デフォルト非表示）: Object/Link/Action型の定義を閲覧・編集。一般ユーザーには見せず、設定で開放。

### データ
`orgs`, `users`, アラートルール設定。

---

## 画面間の主要導線

```
Reality Map ──ノードクリック──→ Entity Intelligence
Entity Intelligence ──"Huginnに質問"──→ Huginn Console
Signal Alerts ──"Huginnに質問"──→ Huginn Console
Signal Alerts ──"Watch Entity"──→ Watchlist
Capital Flow ──セクタークリック──→ Entity Intelligence（フィルタ済み）
全画面 ──→ Audit Trail（透明性の確認）
```

---

## 実装上の注意

1. すべての画面で「出典」を必ず辿れるようにする（Odimの命は透明性）。
2. Globe ⇄ 2D Map の切り替えは `07-DESIGN.md` のモーション規定で「滑らかに」。カクつかせない。
3. AIの回答（Huginn）は必ず confidence と出典を伴う。断定UIを作らない。
4. モバイルでは Signal Alerts のみフル対応。他画面はレスポンシブだがPC前提。
