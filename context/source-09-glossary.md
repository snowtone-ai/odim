# 09 — GLOSSARY：Odim用語集

> Odim固有の用語を定義します。実装中に用語の意味に迷ったら必ずここを参照してください。

---

## プロダクト全般

| 用語 | 定義 |
|---|---|
| **Odim（オーディム）** | 製品名。北欧神話の主神オーディン（Odin）に由来。Reality Intelligence OS。 |
| **Reality Intelligence OS** | Odimのカテゴリ定義。物理現実の意思決定を構造化情報に変換する基盤。 |
| **Reality Intelligence** | 「人々が言っていること」と「実際にやっていること」の差分を構造的・連続的・因果的に検知する能力。 |

## 3つの層

| 用語 | 定義 |
|---|---|
| **Narrative Layer（物語層）** | SNS・ニュース・IR・アナリスト発言。「人々が何を言っているか」。真実ではなく、検知トリガー兼・乖離測定の対象。 |
| **Price Layer（価格層）** | 株価・商品価格・為替。Narrativeに引きずられる遅行指標。Odimの主戦場ではない。 |
| **Reality Layer（現実層）** | 電力契約・用地取得・建設許可・送金・発注など。「誰が実際に意思決定したか」。嘘がつけない。Odimの主戦場。 |

## 7つのReality Layer（データ層）

| 用語 | 定義 |
|---|---|
| **Energy Layer** | 電力使用量・送電網・変電所・電力契約(PPA)。 |
| **Cash Layer** | 決済・送金・発注・設備投資・M&A・資金調達・契約。 |
| **Land Layer** | 工業用地取得・工場用地・DC用地・港湾拡張。 |
| **Compute Layer** | GPU・データセンター・通信帯域・Fiber。 |
| **Water Layer** | 工業用水・冷却水・水インフラ。 |
| **Raw Materials Layer** | 銅・鉄・半導体材料・レアアース。 |
| **Logistics Layer** | 港湾・コンテナ・トラック・倉庫・配送。 |

## Ontology関連

| 用語 | 定義 |
|---|---|
| **Capital Fixation Ontology** | Odimのデータモデルの正式名。資本が物理に「固定化」される過程をオブジェクトとリンクで表現したグラフ。 |
| **Capital Fixation（資本固定化）** | 資本が物理アセット（建物・送電・土地）として不可逆的に固定される現象。Odimが追う最上位の真実。 |
| **Object Type** | Ontologyのオブジェクト型。6種：DecisionMaker / CapitalCommitment / PhysicalAsset / Permit_Filing / ProjectCodename / GeoLocation。 |
| **Link Type** | オブジェクト間の因果リンクの型。commits_capital_to, requires_power_of など。 |
| **Action Type** | Huginnが Ontology に対して実行できる操作。infer_real_owner など。 |
| **DecisionMaker** | 意思決定主体（法人・政府・SPV・ユーティリティ）。 |
| **CapitalCommitment** | 不可逆的な資本の約束（PPA・M&A・発注・用地購入等）。 |
| **PhysicalAsset** | 物理アセット（DC・Fab・変電所・港湾・鉱山等）。 |
| **Permit_Filing** | 法的拘束力のある許認可・申請（FERC・PUC・建設許可・SEC 8-K等）。 |
| **ProjectCodename** | 匿名SPV・シェル会社・プロジェクト仮称。第一級オブジェクトとして扱う。 |
| **GeoLocation** | 地理位置。country/region/city/parcel の階層を持つ。 |

## 推論・スコア

| 用語 | 定義 |
|---|---|
| **SPVResolver™** | 匿名SPV/シェル会社の真の親会社を推定する推論エンジン。Odim最大のmoat。 |
| **Reality Score** | 0-100。企業がReality層でどれだけ濃く実体として観測されているか。 |
| **Reality Divergence Score (RDS)** | -100〜+100。「言ってること(Narrative)」と「やってること(Reality)」の乖離。正＝Reality先行＝機会、負＝Narrative先行＝警戒。 |
| **Triangulation Confidence** | 0-1。1つのCapitalCommitmentが何層の独立Reality層で確認されたか。PageRank的信頼度。 |
| **Signal Freshness Index** | 0-1。シグナルの鮮度と独自性（他社も持っているか）。 |
| **Narrative→Reality Gap / Lead time** | Odimが現実を検知してから、企業が公式発表するまでの日数。Odimの価値の核。 |

## AIエージェント

| 用語 | 定義 |
|---|---|
| **Huginn（フギン）** | オーディンの鴉「思考」。Odimでは能動的に推論しOntologyを探索し回答するAIエージェント。 |
| **Munin（ムニン）** | オーディンの鴉「記憶」。Odimでは組織ごとに育つAI記憶層。 |
| **Core / Archival / Recall Memory** | Muninの3階層記憶（MemGPT/Letta式）。Core=常時コンテキスト、Archival=ベクトル検索、Recall=会話ログ。 |
| **Multi-scope memory** | 各記憶に org_id / user_id / agent_scope 等のスコープを付与する設計。org_idが組織分離の要。 |
| **マルチシグナル検索** | 記憶検索を、コサイン類似度だけでなく recency + importance + link近接で行う（Mem0式）。 |
| **メモリ・ライフサイクル** | 記憶の統合(consolidation)・昇格(promotion)・降格(demotion)・引退(retirement)。 |
| **Scenario Simulator** | 「もしXが起きたら」の仮定をOntology上で因果連鎖シミュレーションするHuginnの機能。 |

## データパイプライン

| 用語 | 定義 |
|---|---|
| **raw_signals** | スクレイピングで収集した生シグナルを格納するテーブル。 |
| **Scrape→Normalize→Ontologize→Resolve→Alert** | データが価値になるまでの5ステージ。 |
| **Entity Resolution（名寄せ）** | 異なる表記の同一実体を1つにまとめる処理（"Meta Platforms"="META"）。 |
| **バックフィル** | 過去データの初回大規模収集。 |

## 設計・実装

| 用語 | 定義 |
|---|---|
| **設定差し替え原則** | 無料→有料の移行を、コード書き換えでなく環境変数差し替えで完結させる原則。 |
| **コストゼロ原則** | 事業化前は Claude Pro / ChatGPT Plus 以外の金銭コストを発生させない原則。 |
| **アンチスロップ** | 「いかにもAIが作った」見た目を排除すること（`07-DESIGN.md`）。 |
| **ルーン金（rune gold）** | Odimのシグネチャーアクセント色 #C9A961。古い北欧の金細工の色。 |
| **org（組織）** | Odimのテナント単位。Huginn/Muninは org ごとに完全分離。 |
