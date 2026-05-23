# 03 — ONTOLOGY：Capital Fixation Ontology（データモデルの中核）

> 前提: `00-VISION.md`, `02-ARCHITECTURE.md` を読了していること。
> このファイルはOdimの心臓部です。ここを誤ると全機能が崩れます。

---

## 1. Ontologyとは何か（実装者向け定義）

Odimにおける Ontology とは、**現実世界の意思決定を「オブジェクト」と「リンク」と「アクション」で表現した意味のグラフ**である。

- 通常のDB: 「数字の行」を保存する。
- Odimの Ontology: 「意味を持つ実体（オブジェクト）」と「実体間の因果関係（リンク）」を保存する。

例：「Meta が Louisiana に DC を建てる」は、通常DBなら1行のレコードだが、Odimでは：
```
[DecisionMaker: Meta] --commits_capital_to--> [CapitalCommitment: $10B投資]
[CapitalCommitment: $10B投資] --funds--> [PhysicalAsset: Richland Parish DC]
[PhysicalAsset: Richland Parish DC] --requires_power_of--> [CapitalCommitment: Entergy 2.2GW PPA]
[PhysicalAsset: Richland Parish DC] --located_at--> [GeoLocation: Richland Parish, LA]
[DecisionMaker: Meta] --controlled_via_SPV--> [ProjectCodename: Laidley LLC]
```
という**グラフ**として表現される。

---

## 2. Object Types（オブジェクト型）— 6種

すべてのオブジェクトは共通フィールドを持つ：`id`, `org_visible`（公開Ontologyか組織専用か）, `created_at`, `updated_at`, `source_refs`（出典）。

### 2.1 DecisionMaker（意思決定主体）
意思決定を行う実体。

| フィールド | 型 | 説明 |
|---|---|---|
| `name` | text | 名称 |
| `type` | enum | `corporation` / `government` / `sovereign_fund` / `utility` / `spv` |
| `parent_id` | uuid? | 親 DecisionMaker（SPVの場合） |
| `shell_probability` | float | シェル会社である確率（0-1） |
| `reality_score` | int | 0-100。後述。 |
| `ticker` | text? | 上場企業の場合のティッカー |
| `hq_location_id` | uuid? | 本社の GeoLocation |

### 2.2 CapitalCommitment（資本コミットメント）
不可逆的な資本の約束。

| フィールド | 型 | 説明 |
|---|---|---|
| `amount_usd` | numeric? | 金額（USD換算、不明ならnull） |
| `type` | enum | `ppa` / `m_and_a` / `equipment_order` / `land_purchase` / `loan` / `capex` / `contract` |
| `counterparty_id` | uuid? | 相手方 DecisionMaker |
| `execution_date` | date? | 実行日 |
| `irrevocability_score` | float | 不可逆性スコア（0-1）。コンクリート＞契約＞意向。 |
| `status` | enum | `rumored` / `filed` / `executed` / `operational` |

### 2.3 PhysicalAsset（物理アセット）
物理的に存在する/建設されるもの。

| フィールド | 型 | 説明 |
|---|---|---|
| `type` | enum | `data_center` / `fab` / `substation` / `port` / `mine` / `power_plant` / `factory` |
| `location_id` | uuid | GeoLocation |
| `capacity_value` | numeric? | 容量（MW、ガロン/日 等） |
| `capacity_unit` | text? | 容量の単位 |
| `status` | enum | `planned` / `permitted` / `under_construction` / `operational` |
| `power_draw_live` | numeric? | 実測電力消費（取得できる場合） |

### 2.4 Permit_Filing（許認可・申請）
法的拘束力のある申請・届出。

| フィールド | 型 | 説明 |
|---|---|---|
| `source` | enum | `ferc` / `state_puc` / `building_permit` / `sec_8k` / `sec_s1` / `water_district` / `cfius` / `env_review` |
| `jurisdiction` | text | 管轄（州・郡・国） |
| `applicant_raw` | text | 申請者名（生データ。redact/SPVの場合あり） |
| `applicant_resolved_id` | uuid? | SPVResolver™で解決された実際の DecisionMaker |
| `filing_date` | date | 申請日 |
| `status` | enum | `submitted` / `under_review` / `approved` / `rejected` / `withdrawn` |
| `document_url` | text | 原本URL |

### 2.5 ProjectCodename（プロジェクト仮称・SPV）
匿名SPV、シェル会社、プロジェクトのコード名。**第一級オブジェクトとして扱う**（Odim独自の重要設計）。

| フィールド | 型 | 説明 |
|---|---|---|
| `alias` | text | 仮称（例: "Project Sucre", "Laidley LLC"） |
| `registered_jurisdiction` | text? | 登記地（例: Delaware） |
| `formation_date` | date? | 設立日 |
| `resolved_parent_id` | uuid? | SPVResolver™が特定した親 DecisionMaker |
| `resolution_confidence` | float | 親特定の信頼度（0-1） |
| `resolution_evidence` | jsonb | 特定根拠（シグナルのリスト） |

### 2.6 GeoLocation（地理位置）
地理的な場所。

| フィールド | 型 | 説明 |
|---|---|---|
| `lat` | float | 緯度 |
| `lng` | float | 経度 |
| `name` | text | 地名 |
| `jurisdiction` | text | 管轄 |
| `land_area_ha` | numeric? | 土地面積（ヘクタール） |
| `zoning` | text? | ゾーニング区分 |
| `scale_level` | enum | `country` / `region` / `city` / `parcel`（Mapのズーム階層と対応） |

---

## 3. Link Types（リンク型）— 因果鎖の骨

リンクは方向性を持つ。共通フィールド：`id`, `from_object_id`, `to_object_id`, `type`, `confidence`（0-1）, `org_visible`, `source_refs`。

| Link Type | from → to | 意味 |
|---|---|---|
| `commits_capital_to` | DecisionMaker → CapitalCommitment | 資本をコミットした |
| `funds` | CapitalCommitment → PhysicalAsset | 資本がアセットを生む |
| `requires_power_of` | PhysicalAsset → CapitalCommitment(PPA) | アセットが電力契約を必要とする |
| `located_at` | PhysicalAsset → GeoLocation | アセットの位置 |
| `controlled_via_spv` | DecisionMaker → ProjectCodename | SPV経由で支配 |
| `filed_as` | DecisionMaker → Permit_Filing | 申請を行った |
| `precedes_announcement_by` | Permit_Filing → CapitalCommitment | 申請が公式発表に先行（Lead time付き） |
| `co_locates_with` | PhysicalAsset → PhysicalAsset | 近接して立地（Fab ⇄ 水処理 等） |
| `consumes_input` | PhysicalAsset → PhysicalAsset/CapitalCommitment | 入力を消費（Fab ⇄ EUV 等） |
| `supplies` | DecisionMaker → DecisionMaker | サプライチェーン上流→下流 |
| `triggers_demand_in` | CapitalCommitment → DecisionMaker | 需要を誘発（DC建設→GPUサプライヤー） |

---

## 4. Action Types（アクション型）— AIエージェントが実行できる「動詞」

Action Types は、Huginn が Ontology に対して実行できる操作。Palantir の Ontology の「Action」概念に対応。

| Action | 入力 | 出力 | 実装場所 |
|---|---|---|---|
| `infer_real_owner` | ProjectCodename | 親DecisionMaker + 信頼度 | `lib/resolvers/spv-resolver.ts` |
| `estimate_capex` | Permit_Filing（電力kV等） | 推定CapEx金額 | `lib/resolvers/capex-estimator.ts` |
| `propagate_demand` | CapitalCommitment + 産業ノード | 下流の影響を受けるDecisionMaker群 | `lib/resolvers/demand-propagator.ts` |
| `compute_rds` | DecisionMaker | Reality Divergence Score | `lib/resolvers/rds.ts` |
| `triangulate` | CapitalCommitment | 確認層数 + 信頼度 | `lib/resolvers/triangulation.ts` |
| `simulate_scenario` | 仮定イベント | 因果連鎖の予測結果 | `lib/resolvers/scenario.ts` |

---

## 5. 重要な派生スコア（Odimの差別化の数値的核心）

### 5.1 Reality Score（0-100）
DecisionMaker（企業）が「Reality層でどれだけ濃く観測されているか」。
```
reality_score = f(
    関連する CapitalCommitment の数と irrevocability_score の総和,
    確認できた Reality Layer の種類数（7層中いくつ）,
    最新シグナルの鮮度
)
```
高い = 物理現実で実体が濃く確認できる。低い = Narrativeばかりで実体が薄い。

### 5.2 Reality Divergence Score / RDS（-100 〜 +100）
「言ってること（Narrative）」と「やってること（Reality）」の乖離。
```
RDS > 0 : Realityが先行（発表前に動いている）→ 機会
RDS < 0 : Narrativeが先行（言うだけで動いていない）→ 警戒
RDS ≈ 0 : 一致
```

### 5.3 Triangulation Confidence（0-1）
1つの CapitalCommitment が、いくつの**独立した** Reality Layer で確認されたか。
```
7層中5層で確認 → 0.85（高信頼）
7層中1層のみ   → 0.30（要注意）
```
PageRank的思想：多くの独立シグナルに裏付けられたものほど信頼が高い。

### 5.4 Signal Freshness Index（0-1）
各シグナルの「鮮度」と「他社も持っているか（独自性）」。独自かつ新鮮なシグナルをUIで強調するために使う。

---

## 6. DBスキーマ（PostgreSQL / Supabase マイグレーション）

```sql
-- 組織（マルチテナント）
create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier text not null default 'enterprise',  -- intelligence/enterprise/sovereign
  created_at timestamptz default now()
);

-- ユーザー（Supabase auth.users と紐付け）
create table users (
  id uuid primary key references auth.users(id),
  org_id uuid not null references orgs(id),
  display_name text,
  role text not null default 'analyst'  -- analyst/admin
);

-- ===== Ontology コア =====
-- オブジェクト（6型を単一テーブル + type で区別。属性はjsonb）
create table ontology_objects (
  id uuid primary key default gen_random_uuid(),
  object_type text not null,   -- decision_maker/capital_commitment/physical_asset/permit_filing/project_codename/geo_location
  attributes jsonb not null default '{}',
  org_visible uuid references orgs(id),  -- null = 公開Ontology / 値あり = その組織専用
  source_refs jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on ontology_objects (object_type);
create index on ontology_objects using gin (attributes);

-- リンク（因果鎖）
create table ontology_links (
  id uuid primary key default gen_random_uuid(),
  from_object_id uuid not null references ontology_objects(id),
  to_object_id uuid not null references ontology_objects(id),
  link_type text not null,
  confidence float not null default 0.5,
  org_visible uuid references orgs(id),
  source_refs jsonb default '[]',
  created_at timestamptz default now()
);
create index on ontology_links (from_object_id);
create index on ontology_links (to_object_id);

-- ===== 生シグナル =====
create table raw_signals (
  id uuid primary key default gen_random_uuid(),
  layer text not null,  -- energy/cash/land/compute/water/raw_materials/logistics/narrative
  source text not null,
  payload jsonb not null,
  freshness float default 1.0,
  is_proprietary boolean default false,  -- Odim独自シグナルか
  observed_at timestamptz not null,
  ingested_at timestamptz default now()
);
create index on raw_signals (layer, observed_at);

-- ===== アラート =====
create table alerts (
  id uuid primary key default gen_random_uuid(),
  priority text not null,  -- critical/high/medium/low
  title text not null,
  description text,
  related_object_id uuid references ontology_objects(id),
  evidence jsonb default '[]',
  org_id uuid references orgs(id),  -- null = 全組織共通アラート
  created_at timestamptz default now()
);

-- ===== Munin（AI記憶）→ 詳細は 05-HUGINN-MUNIN.md =====
create table munin_memory (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),     -- ★組織分離の要
  user_id uuid references users(id),
  agent_scope text not null,                    -- core/archival/recall
  content text not null,
  embedding vector(768),                        -- pgvector（Gemini埋め込み次元）
  importance float default 0.5,
  decay_score float default 1.0,
  linked_memory_ids uuid[] default '{}',        -- A-Mem式リンク
  created_at timestamptz default now(),
  last_accessed_at timestamptz default now()
);
create index on munin_memory using ivfflat (embedding vector_cosine_ops);

-- ===== 監査ログ =====
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  object_id uuid,
  actor text not null,         -- system/huginn/user:<id>
  detail jsonb,
  confidence float,
  created_at timestamptz default now()
);

-- ===== 行レベルセキュリティ（組織分離）=====
alter table munin_memory enable row level security;
create policy munin_org_isolation on munin_memory
  using (org_id = (select org_id from users where id = auth.uid()));
-- 同様のRLSを alerts, ontology_objects(org_visible), ontology_links(org_visible) にも適用。
```

---

## 7. Ontologyグラフの探索（再帰CTE）

グラフDBを使わずにPostgreSQLでN-hop探索を行う例（Entity Intelligence の "Search Around" 機能）：

```sql
-- あるオブジェクトから3ホップ以内に繋がる全オブジェクトを取得
with recursive graph_walk as (
  select o.id, o.object_type, o.attributes, 0 as depth
  from ontology_objects o where o.id = :start_id
  union all
  select o.id, o.object_type, o.attributes, gw.depth + 1
  from graph_walk gw
  join ontology_links l on l.from_object_id = gw.id
  join ontology_objects o on o.id = l.to_object_id
  where gw.depth < 3
)
select distinct * from graph_walk;
```

---

## 8. 実装上の絶対ルール

1. オブジェクトとリンクには**必ず `source_refs`（出典）を入れる**。出典のないオブジェクトは作らない。Odimの命は透明性。
2. `org_visible` が null = 公開Ontology（全組織が見る）。値あり = その組織専用（Munin・機密ノウハウ）。混同するとデータ漏洩。
3. すべての推論結果（SPV解決、RDS等）は `audit_log` に記録する。「なぜそう判断したか」を後から完全再現できること。
4. `confidence` を持たないリンク・スコアを作らない。Odimは不確実性を必ず明示する。
