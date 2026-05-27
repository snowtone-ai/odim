# 06 — SCREENS：全画面の詳細仕様（v3.0）

> 前提: `01-PRODUCT-SPEC.md`, `03-ONTOLOGY.md` を読了していること。
> 各画面のビジュアル・色・モーションは `07-DESIGN.md` に従うこと。
>
> **v3.0変更点（2026-05）**: 8画面 → 5画面。Capital Flow・Watchlist・Audit TrailをEntity/Settingsに統合。Globeを廃止しMapLibre一本化。

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

- **Sidebar**: 5画面へのナビゲーション（Map / Entities / Alerts / Huginn / Settings）。常時表示。アクティブ画面をハイライト。
- **Topbar**: 画面名、ライブ更新インジケータ、画面固有の操作ボタン。
- **CommandPalette**: Cmd+K（または `/`）で全画面から呼び出せるグローバル検索。エンティティ・アラート・設定を検索し即時ナビゲート。`components/ui/command-palette.tsx`。
- **画面遷移**: `07-DESIGN.md` のモーション規定に従い、滑らかにクロスフェード + スライド。

---

## Screen 1: Reality Map（/map）

### 目的
世界の資本移動と物理アセットを地理的に可視化する、Odimの「顔」となる画面。Palantir Gothamレベルの地図品質を実現する。

### 地図実装（v3.0確定設計）
**MapLibre GL JS + CARTO Dark Matter タイル** のみ。3D Globe（react-globe.gl）は廃止（→ `10-DECISIONS.md` D-02-v2）。

```
コンポーネント: components/ui/reality-map.tsx
データ層:       lib/map/types.ts, lib/map/entities.ts, lib/map/connections.ts
```

### レイヤー構成（MapLibreネイティブレイヤー）

| レイヤー | 種別 | 内容 |
|---|---|---|
| シンボルレイヤー | Symbol | エンティティアイコン（SDF基板）。bolt/coin/mountain/chip/droplet/gem/truck の7種アイコン |
| クラスタリング | Circle + Symbol | clusterMaxZoom 8, radius 50。ズームアウト時にクラスタ表示 |
| 接続ライン | Line | Ontologyリンクからの接続線。confidence比例の幅・不透明度 |
| 信頼度リング | Circle | エンティティ周囲の信頼度可視化リング |
| アニメーションパルス | Circle | score>75のエンティティに拍動アニメーション |
| 選択グロー | Circle | 選択エンティティのグロー強調表示 |

### インタラクション

- **ホバー**: ポップアップ表示（エンティティ名・スコア・セクター）
- **クリック**: 選択 + ネットワークハイライト + flyTo（地図が対象へ滑らかに移動）
- **マップ検索バー**: 画面左上フロート。`/` または Cmd+F でフォーカス
- **EntityLink**: クリックで `/entity?id=X` へ画面遷移（`components/ui/entity-link.tsx`）

### データ
`entities` + `entity_links`（Ontologyリンク）+ 各種resolverスコア。

### 実装注意
- Globeと2Dの切り替えロジックは不要（廃止済み）。
- タイルはCARTO Dark Matter（無料枠）固定。
- マーカードリフト防止のため座標は `lib/map/entities.ts` で固定管理。

---

## Screen 2: Entity Intelligence（/entity）

### 目的
1つの企業・SPVの「すべてのReality」を1画面に集約（Palantir Gotham の COV = Context Overview に相当）。v3.0でCapital FlowとWatchlistを統合し、情報密度を最大化した。

### 実装
```
コンポーネント: components/ui/entity-workstation.tsx（Client Component）
```

### 構成（3カラム）

1. **左：Entityリスト**
   - 検索 + フィルタ（全エンティティ / Watchedのみ）。
   - Top Capital Movers と Unresolved SPVs を並べる。

2. **中央：Entity詳細**
   - ヒーロー（社名 + Reality Score バー）。
   - KPIカード（Total Committed / Power Reserved / DC Footprint / Narrative Lead）。
   - **Capital Commitment Timeline**: Reality層検知の時系列。Narrative Layer（公式発表）も同軸に並べ、「Odimが何日先行したか」を視覚化。
   - **セクター・ヒートマップ**（旧Capital Flowから統合）: 7セクター（AI Infra / Semiconductor / Grid / Mining / Defense / Water / Logistics）の資本コミット額。
   - **Narrative→Reality Gap テーブル**（旧Capital Flowから統合）: 各エンティティの「Odim検知 vs 公式発表」のリード日数とRDS。
   - **Daily Brief**（旧Watchlistから統合）: HuginnがWatchlist上エンティティの最新変化をサマリー表示。

3. **右：Ontology Links**
   - そのEntityに繋がるオブジェクト（電力契約 / 物理アセット / SPV / サプライチェーン）を型別に表示。"Search Around"（再帰CTEでN-hop探索）。

### SPVResolver™ パネル
SPVを選択した場合、親会社候補と確率（"Meta 88% / xAI 42%"）、解決根拠（`resolution_evidence`）を表示。

### Triangulation Confidence UI
各 CapitalCommitment が「7層中いくつのReality層で確認されたか」をビジュアル表示。

### データ
`ontology_objects` + `ontology_links` + 各種resolver出力 + `alerts`（Watchedフィルタ用）。

---

## Screen 3: Signal Alerts（/alerts）

### 目的
重要な変化を優先度付きで通知する。顧客のDAU/粘着を決める画面。

### 構成（2カラム）

1. **左：アラートキュー**: Critical / High / Medium / Low の4優先度でグループ化。各アラートはタイトル・説明・タグ・時刻。
2. **右：アラート詳細**: 選択アラートのSignal Chain（時系列の証拠連鎖）、親会社候補スコア、Evidence Sources（出典リンク）、操作ボタン（"Huginnに質問" → Huginn画面へ遷移 / "Watch Entity" → EntityLink経由）。

### データ
`alerts` テーブル。Realtime（Supabase）で新着をプッシュ。

---

## Screen 4: Huginn（/huginn）

### 目的
自然言語でOntologyに質問するAIエージェント画面（`source-05-huginn-munin.md`）。v3.0でインタラクティブなClient Componentに移行。

### 実装
```
コンポーネント: components/ui/huginn-console.tsx（Client Component）
               components/ui/huginn-input.tsx（クエリ入力・ローディング状態管理）
```

### 構成（2カラム）

1. **左：対話エリア**
   - `HuginnInput`: クエリ入力欄。送信中はローディング状態を表示。
   - `HuginnConsole`: 回答表示。Reasoning Trace（Huginnが辿った因果鎖）と出典を埋め込む。

2. **右：サイドパネル**
   - **Reasoning Trace**: Huginnが探索したOntologyノードのリスト。
   - **Sources**: 回答の出典。
   - **Munin インジケータ**: 信頼度バー + 総レコード数（count grid は廃止）。
   - **Quick Queries**: よく使うクエリのショートカット。

### v3.0の変更点
- **Sycophancy バッジ**: UIから削除。バックエンドでの検出 + anti-sycophancyプロンプトによる自動リトライは継続（サイレント）。
- **Munin count grid**（セクター別グリッド表示）: 削除。信頼度バー + 総レコード数のみ表示。

### データ
`/api/huginn` 経由。Gemini（無料枠）+ Munin（pgvector）+ Ontology。

---

## Screen 5: Settings（/settings）

### 目的
設定・管理・透明性ログ。v3.0でAudit Trailを統合し全ログを省略なく表示。

### 構成

- **Alert Rules**: アラート条件の管理。
- **API Key管理**: 外部AI Agentが叩くためのAPIキー発行。ハッシュ保存。発行時に一度だけ平文を表示。
- **Team権限管理**: 組織内のユーザーと役割（analyst / admin）。
- **Seed Memory Manager** (`components/ui/seed-memory-manager.tsx`): ファクト/オピニオンのCRUD。
- **Audit Trail**（旧スタンドアロン画面から統合）: 時系列テーブル：Timestamp / Event Type / Object / Source / Confidence / Agent Action。省略なし全ログ。CSV/PDFエクスポート対応。

### データ
`orgs`, `users`, アラートルール設定, `audit_log`。

---

## 画面間の主要導線

```
Reality Map ──クリック──→ Entity Intelligence（EntityLink: /entity?id=X）
Entity Intelligence ──"Huginnに質問"──→ Huginn
Signal Alerts ──"Huginnに質問"──→ Huginn
Signal Alerts ──"Watch Entity"──→ Entity Intelligence（Watchedフィルタ）
全画面 ──Cmd+K──→ CommandPalette（グローバル検索）
全画面 ──→ Settings（透明性・監査の確認）
```

---

## 実装上の注意

1. すべての画面で「出典」を必ず辿れるようにする（Odimの命は透明性）。
2. Map は MapLibre 単一実装。Globe の実装・切り替えロジックは入れない。
3. AIの回答（Huginn）は必ず confidence と出典を伴う。断定UIを作らない。
4. モバイルでは Signal Alerts のみフル対応。他画面はレスポンシブだがPC前提。
5. CommandPaletteはKeyboardEvent（Cmd+K）でハンドリング。`components/ui/command-palette.tsx` を参照。
