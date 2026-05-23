# 04 — DATA PIPELINE：データ収集・スクレイピング・更新戦略

> 前提: `02-ARCHITECTURE.md`, `03-ONTOLOGY.md` を読了していること。

---

## 1. 基本方針

- **収集方式**: 自社スクレイピング（公開データ）。事業化前は有料データAPIを使わない。
- **更新頻度**: 日次バッチ（GitHub Actions cron）。Odimは中長期判断ツールであり、土地・建設・許認可データは1日1回更新で十分。
- **初期負荷**: 過去データの初回収集（バックフィル）は大規模で時間がかかる。一度集めれば以後は日次差分のみ。
- **地理範囲**: プロダクトはグローバル対応。ただしデータ網羅は **米国優先 → 日本・台湾・EU → その他** の順で充填。Ontologyは国に依存しない汎用設計（`03-ONTOLOGY.md`）なので、データを足すだけで地域拡張できる。

---

## 2. データソース一覧（無料・公開）

`config/sources.json` で定義し、有料API追加時もここを書き換えるだけにする。

### 2.1 Energy Layer

| ソース | 取得物 | 形式 | 備考 |
|---|---|---|---|
| FERC eLibrary | 送電接続申請(ISA)、電力契約 | HTML/PDF | 米国連邦 |
| ERCOT Interconnection Queue | 大規模負荷接続申請 | CSV/HTML | テキサス（AI Hub） |
| 各州PUC（CA/VA/LA/OH等） | 電力会社の設備投資申請 | HTML/PDF | docket検索 |
| EIA（米エネルギー情報局） | 発電所・電力統計 | API（無料）/CSV | |
| 日本: 電力広域機関(OCCTO) | 系統接続 | HTML | 日本拡張時 |

### 2.2 Cash Layer

| ソース | 取得物 | 形式 | 備考 |
|---|---|---|---|
| SEC EDGAR | 8-K, S-1, 10-K | API（無料）/XBRL | 米上場企業 |
| 各国M&A公示 | M&A・買収 | HTML | |
| 政府調達公示（SAM.gov等） | 政府発注 | API（無料） | |

### 2.3 Land Layer

| ソース | 取得物 | 形式 | 備考 |
|---|---|---|---|
| 郡の土地登記（County Recorder） | 用地取得・登記 | HTML（郡ごとに異なる） | 米国は郡単位。重要郡を優先。 |
| 建設許可（Building Permit） | DC/工場の建設許可 | HTML/オープンデータポータル | Socrata等の自治体APIを活用 |
| ゾーニング申請 | 用途変更申請 | HTML | |

### 2.4 Compute Layer

| ソース | 取得物 | 形式 | 備考 |
|---|---|---|---|
| DC建設許可（Land Layerと重複） | データセンター建設 | HTML | |
| クラウドリージョン公示 | 新リージョン | HTML | AWS/Azure/GCP公式 |
| 半導体Fab公示 | Fab建設 | HTML/IR | |

### 2.5 Water Layer

| ソース | 取得物 | 形式 | 備考 |
|---|---|---|---|
| 水道局取水申請 | 工業用水の取水権 | HTML/PDF | 自治体ごと |
| 環境影響評価（EIA） | 水利用を含む環境審査 | PDF | |

### 2.6 Raw Materials Layer

| ソース | 取得物 | 形式 | 備考 |
|---|---|---|---|
| AIS（船舶自動識別）公開フィード | 船舶位置 | 公開APIの無料枠 | コモディティ輸送追跡 |
| 鉱山生産統計 | 銅・鉄・レアアース生産 | HTML/CSV | USGS等 |
| 港湾統計 | コンテナ取扱量 | HTML/CSV | |

### 2.7 Narrative Layer（トリガー兼乖離測定対象）

| ソース | 取得物 | 形式 | 備考 |
|---|---|---|---|
| 企業IR・プレスリリース | 公式発表 | HTML/RSS | Realityとの乖離測定の基準 |
| ニュースRSS | 報道 | RSS | |
| アナリストレポート要約 | 市場予想 | HTML | 取得できる範囲で |

---

## 3. パイプライン構成（日次バッチ）

```
.github/workflows/daily-scrape.yml
  on: schedule (cron: 毎日決まった時刻)
  jobs:
    scrape:
      - run: scrapers/ferc.ts          → raw_signals へ
      - run: scrapers/sec-edgar.ts     → raw_signals へ
      - run: scrapers/building-permits.ts → raw_signals へ
      - run: scrapers/water-districts.ts  → raw_signals へ
      - run: scrapers/ais.ts           → raw_signals へ
      - run: scrapers/narrative.ts     → raw_signals へ
    transform:
      - run: lib/pipeline/normalize.ts   # raw_signals を正規化
      - run: lib/pipeline/ontologize.ts  # オブジェクト/リンクへ変換
      - run: lib/pipeline/resolve.ts     # SPVResolver/RDS/Triangulation 実行
      - run: lib/pipeline/alert.ts       # 閾値超え → alerts 生成
```

---

## 4. パイプラインの5ステージ

### Stage 1: Scrape（収集）
各 `scrapers/*.ts` が Playwright で公開サイトから取得。結果を `raw_signals` テーブルへ INSERT。
- スクレイピング先のサイト構造変更に備え、各スクレイパーは「失敗を検知してログを残し、他を止めない」設計にする。
- robots.txt とレート制限を尊重する（過剰アクセス禁止）。

### Stage 2: Normalize（正規化）
`raw_signals` の生payloadを、共通フォーマットに正規化。
- 企業名の名寄せ（"Meta Platforms Inc." = "Meta" = "META"）。
- 金額のUSD換算、日付のISO化、地名の緯度経度付与（ジオコーディング）。

### Stage 3: Ontologize（Ontology化）
正規化済みシグナルを、`ontology_objects` と `ontology_links` に変換。
- 例: 建設許可シグナル → `Permit_Filing` オブジェクト + `filed_as` リンク。
- 既存オブジェクトとの同一性判定（Entity Resolution）を行い、重複を作らない。

### Stage 4: Resolve（推論）
`lib/resolvers/` の各推論器を実行：
- **SPVResolver™**: `ProjectCodename` の親会社を推定（後述）。
- **RDS**: 各 `DecisionMaker` の Reality Divergence Score を更新。
- **Triangulation**: 各 `CapitalCommitment` の確認層数を計算。
- **Demand Propagation**: 因果リンクを辿り下流の影響を計算。

### Stage 5: Alert（アラート生成）
前日との差分で「重要な変化」を検出し `alerts` を生成。
- 例: SPVの親会社確率が60%→88%に上昇 → High priority alert。
- 例: ある地域の電力申請が前週比+67% → Critical alert。

すべてのステージは `audit_log` に記録する。

---

## 5. SPVResolver™ のロジック（Odim最大のmoat）

匿名SPV/シェル会社（"Project Sucre", "Laidley LLC"等）の真の親会社を推定する。

```
入力: ProjectCodename オブジェクト
処理:
  1. 登記地・設立日・登記代理人のパターン照合
  2. 同SPVが関与する Permit_Filing の規模（電力MW・用地ha）から、
     その規模を必要とする企業を絞り込み
  3. 周辺シグナルの三角測量:
     - 同地域の求人データ（"Azure Infrastructure Engineer 求人 +180%" 等）
     - 申請書の技術仕様が特定企業のDC標準と一致するか
     - 過去の解決済みケースとのパターン類似（Munin が記憶）
  4. 各候補企業に確率を付与
出力: resolved_parent_id + resolution_confidence + resolution_evidence
```

実装上の注意：
- 確率は必ず複数候補で出す（"Meta 88% / xAI 42% / その他"）。単一候補に断定しない。
- 根拠（`resolution_evidence`）を必ず残す。Audit Trailで追跡可能に。
- 過去の正解パターンは Munin（公開スコープ）に蓄積し、精度を上げていく。

---

## 6. 無料枠の現実的制約（監査結果）

| 項目 | 制約 | 対処 |
|---|---|---|
| 衛星SAR/光学画像 | Planet Labs / ICEYE は有料 | 無料枠では衛星機能のUIは作るが、データは「公開された低頻度衛星画像 + 建設許可テキスト」で代替。`config/sources.json` に有料衛星枠を後から追加。 |
| AIS全量データ | 全量リアルタイムは有料 | 無料公開フィードの範囲で。コモディティ輸送の主要航路に絞る。 |
| Supabase DB容量 | 無料枠 500MB | 生シグナルは要約して保存、原本はURL参照。古い `raw_signals` は定期アーカイブ。 |
| GitHub Actions実行時間 | プライベートリポは月2,000分 | スクレイパーを並列化しすぎない。リポジトリをパブリックにすれば無制限（ただしコード公開に注意）。 |
| スクレイピングのサイト構造変更 | 突然壊れる | 各スクレイパーに「取得件数0なら警告」のヘルスチェック。 |

---

## 7. データ品質の原則

1. **出典なきデータは登録しない**。すべての `raw_signals` と `ontology_objects` は `source_refs` を持つ。
2. **生データは消さない**。正規化後も `raw_signals` は残す（監査・再処理のため。容量逼迫時はアーカイブ）。
3. **Narrative と Reality を必ず分離**。`raw_signals.layer = 'narrative'` のデータを「真実」として Ontology の確定リンクにしない。あくまでトリガー・乖離測定用。
4. **更新の冪等性**。日次バッチが二重実行されても重複オブジェクトが生まれないように、Entity Resolution で同一性を保証する。
