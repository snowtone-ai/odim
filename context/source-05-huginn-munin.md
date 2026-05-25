# 05 — HUGINN & MUNIN：AIエージェントの思考・記憶アーキテクチャ（v2.0 改訂版）

> **このファイルは v2.0 改訂版です。** `context/source-05-huginn-munin.md` が Huginn/Munin の最新正典です。
> 実装は CodeX 5.5 が担当します。実装着手前に本ファイルを最後まで読んでください。
> 前提: `00-VISION.md`, `03-ONTOLOGY.md`, `04-DATA-PIPELINE.md` を読了していること。

---

## 0. v1.0 からの変更点サマリ（差分の要点）

v1.0 は「3階層記憶 + マルチシグナル検索 + メモリリンク + org分離」という骨格だった。
v2.0 は、2026年5月時点の先端研究リサーチを反映し、以下を**追加・修正**した。

| # | 変更 | 理由（出典） |
|---|---|---|
| C1 | **書込時ゲーティング**を最優先機構として追加 | 読込フィルタは8:1ディストラクタ比で精度0%に崩壊、書込ゲートは100%維持（arXiv:2603.15994, 2026-03） |
| C2 | **事実記憶 / 意見記憶の物理分離**（テーブル分割） | 過去の意見が現在の判断を歪める（sycophancy）。投資判断では致命的 |
| C3 | **Reality検索 / Narrative検索の関数分離** | Odimのコア思想「Reality>Narrative」を構造で守る。ナラティブが判断根拠に侵入するのを防ぐ |
| C4 | **Seed Memory（プロジェクト機能）**を追加 | ユーザーが自社情報を能動的に登録・編集する機能 |
| C5 | **Dream（夜間記憶整理バッチ）**を追加 | Anthropic Dreaming（2026-05）の構造を Gemini+pgvector で再現 |
| C6 | **3層リトリーバルカスケード**に拡張 | Munin単独依存からの脱却。Munin→Odimキャッシュ→Web の適応的経路 |
| C7 | **Outcomes Grader（独立LLM評価）**を追加 | sycophancyを別インスタンスで検出。因果的に独立した評価 |
| C8 | **Retrieval-induced forgetting**をライフサイクルに追加 | 非ヒット記憶の能動的減衰で「引きずられ」を抑制 |
| C9 | **6月ドッグフーディング評価フレームワーク**を追加（第11章） | 1ヶ月の自己利用の評価基準 |

---

## 1. コンセプト

北欧神話のオーディンは2羽の鴉を持つ。**Huginn（思考）**＝飛び出して推論するエージェント。**Munin（記憶）**＝組織ごとに育つ記憶層。

### 核心思想：組織ごとに育つAI
ユーザー（組織 = org）は自分専用の Huginn / Munin を持つ。組織のノウハウ・機密・過去判断は org 内に蓄積され、他組織からは完全に分断される。

### v2.0で最重要の追加思想：記憶は「育てる」と同時に「汚染から守る」
記憶を増やすこと自体は価値ではない。**間違った記憶・古い意見・ナラティブの混入は、Huginnの判断を歪める負債**である。
v2.0 の設計の半分は「記憶をどう増やすか」、もう半分は「記憶にどう汚染させないか」に費やされている。
これは Odim のユースケース（投資判断・経済安全保障）では、機能ではなく**安全要件**である。

---

## 2. 設計の根拠となった研究（2026年5月時点）

実装者は「なぜこの設計なのか」を理解するため、根拠を把握すること。

| 研究 / 技術 | 要点 | Odimへの反映 |
|---|---|---|
| **Write-Time Gating**（arXiv:2603.15994, Zahn & Chana, 2026-03） | 記憶を「読む段階」でのフィルタは8:1ディストラクタ比で精度0%に崩壊。「書く段階」でのゲートは100%維持。 | 第4.4章（書込ゲート）= v2.0の中核 |
| **Anthropic Dreaming**（2026-05-06リリース） | エージェントが非稼働時に記憶を整理・統合・矛盾解消。入力ストアは不変、新ストアを生成。 | 第4.7章（Dream）。Gemini+pgvectorで構造を再現 |
| **Letta Sleep-time Compute**（arXiv:2504.13171, 2025-04） | 想定クエリを事前推論し、ピーク時の計算を削減。 | 第5.5章（Sleep-time Compute）。6月以降の拡張 |
| **Self-RAG**（arXiv:2310.11511） | LLM自身がreflection tokenで「検索すべきか」「結果を採用すべきか」を判断。 | 第5.3章（self-assessment） |
| **SEAKR**（arXiv:2406.19215） | self-aware uncertaintyが閾値超過時のみ検索する適応的RAG。 | 第5.1章（カスケードのゲート判定） |
| **Agentic RAG Survey**（arXiv:2501.09136） | reflection/planning/tool-use/multi-agentの4パターン。KBで答えられない時Web検索フォールバック。 | 第5.1章（3層カスケード） |
| **PI-LLM**（arXiv:2506.08184） | proactive interferenceでLLMのretrieval精度が対数線形に0%へ。「過去を無視せよ」のプロンプト指示はほぼ効かない。 | 第4章全体：プロンプトでなく構造で守る原則 |
| **OpenAI sycophancy インシデント**（2025-04〜05、公式ブログ） | GPT-4oのsycophancyアップデートを公式ロールバック。「user memoryがsycophancyを悪化させる可能性がある」と明記（ただし広範な増幅の証拠はないと留保）。 | 第6章（sycophancy対策） |
| **投資AIバイアス研究**（arXiv:2507.20957, ACM ICAIF 2025） | LLMはtechnology/large-cap/contrarianの3軸に潜在バイアス。3段階のバイアステストフレームワーク。 | 第6章・第11章（評価） |
| **CLS理論 / 海馬-新皮質**（McClelland et al. 1995） | 高速・パターン分離（海馬）+低速・分散（新皮質）の二重学習系。 | Munin=海馬的、Procedural層=新皮質的 |
| **Retrieval-induced forgetting**（Anderson et al. 1994） | 検索行為自体が競合記憶を抑制する適応的忘却。 | 第4.6章（RIF減衰） |

> v2.0 で外部の有料記憶サービス（Mem0クラウド、Zep等）は引き続き**使わない**。研究の思想だけを Supabase(pgvector) 上に自前実装する（コストゼロ原則）。

---

## 3. アーキテクチャ全体図

```
                          ┌──────────────────────────┐
   ユーザーの質問 ─────────▶│      HUGINN（思考層）       │
                          │  - self-assessment       │
                          │  - 3層リトリーバルカスケード  │
                          │  - Gemini推論             │
                          └───────┬──────────────────┘
                                  │ 検索（4.4の書込ゲートを必ず通る）
            ┌─────────────────────┼─────────────────────┐
            ▼                     ▼                     ▼
   ┌────────────────┐   ┌──────────────────┐   ┌──────────────────┐
   │ Layer 1: MUNIN  │   │ Layer 2: Odim内部  │   │ Layer 3: Web検索   │
   │ （記憶層）        │   │ キャッシュ/Ontology │   │ （2系統に分離）     │
   │                │   │ - ontology_objects│   │ A:reality_gapfill │
   │ ・munin_memory  │   │ - raw_signals     │   │   →許可ドメインのみ │
   │  (事実/手続/Seed)│   │ - entities        │   │   →判断根拠になれる │
   │ ・munin_opinions│   │                   │   │ B:narrative_capture│
   │  (意見/過去判断) │   │                   │   │   →一般Web         │
   │  ※既定で読まない │   │                   │   │   →判断根拠不可     │
   └────────┬───────┘   └──────────────────┘   └────────┬─────────┘
            │                                            │
            │  夜間バッチ                          書込時：source_type判定
            ▼                                            ▼
   ┌────────────────┐                          ┌──────────────────┐
   │ DREAM（夜間整理） │                          │ 書込ゲート(4.4)     │
   │ ・重複統合       │                          │ web_narrative は    │
   │ ・矛盾解消       │                          │ munin_memoryに      │
   │ ・パターン昇格   │                          │ 入れない（構造的遮断）│
   └────────────────┘                          └──────────────────┘
            │
            ▼
   ┌────────────────────────────────────────────────────┐
   │ Huginn回答 → Outcomes Grader（独立Geminiインスタンス） │
   │ sycophancy / 引きずられ を因果独立に評価               │
   └────────────────────────────────────────────────────┘
```

---

## 4. Munin — 記憶層

### 4.1 記憶の4つのクラス（v2.0の最重要設計）

すべての記憶は、書込時に必ず4クラスのいずれかに分類される。**クラスによって格納先テーブルと扱いが物理的に異なる。**

| クラス | 定義 | 格納先 | Huginnの既定動作 |
|---|---|---|---|
| **fact（事実）** | 検証可能な客観的事実。「Meta は Richland Parish に DC建設許可を申請」 | `munin_memory` | 既定で読む（判断根拠になれる） |
| **procedure（手続き）** | 組織の作業ルール・分析手順。「電力申請は2.2GW超を優先監視」 | `munin_memory` | 既定で読む（判断根拠になれる） |
| **seed（シード）** | ユーザーが能動的に登録した自社情報・設定（第4.3章） | `munin_memory`（`is_seed=true`） | 既定で読む。最高信頼度・減衰免除 |
| **opinion（意見）** | 主観的判断・過去の結論・好み。「このセクターは強気と判断した」 | `munin_opinions`（別テーブル） | **既定で読まない**。明示要求時のみ |

> **なぜ opinion を物理分離するか**：あなた（Souma）が指摘した「ChatGPTが過去チャットに引きずられた」現象の正体は、過去の意見・結論が現在の質問の文脈に混入することである。
> fact は混入してよい（事実は事実）。opinion の混入こそが sycophancy・引きずられの原因。
> よって opinion を別テーブルに隔離し、Huginn は**意識的に「過去の自分の判断を参照する」と決めた場合のみ**読み込む。

### 4.2 3階層スコープ（Core / Archival / Recall）

記憶クラスとは直交する軸。「どれだけ手元に近いか」を表す（MemGPT/Letta式）。

```
Core Memory     = 常にHuginnのコンテキストに入る。容量小。検索不要。
                  （seed・最重要fact・最重要procedure）
Archival Memory = pgvectorで意味検索。容量大。Huginnが明示的に検索。
                  （大量のfact、過去の分析）
Recall Memory   = 直近の会話ログ。時系列検索。期間短い。
```

`munin_memory.agent_scope` で `core` / `archival` / `recall` を区別。

### 4.3 Seed Memory（プロジェクト機能 = ユーザー能動編集）

**目的**：組織がOdim利用開始時に、自社・自分の情報を能動的に登録し、Huginn/Munin をカスタマイズする。

**仕様**：
- 専用UI（`07-DESIGN.md`準拠の設定画面内）から、組織管理者が自由テキスト or 構造化フォームで登録。
- 登録例：自社の事業領域、監視したい競合・セクター、投資テーマ、分析の方針、独自のリスク基準、Huginnへの指示。
- 登録された記憶は `munin_memory` に `memory_class='seed'`, `is_seed=true`, `agent_scope='core'` で保存。
- **Seed記憶の特権**：
  1. `salience_score` は常に最大値（ユーザーが明示的に書いた＝最高信頼）。
  2. **減衰しない**（`decay_score` 逓減の対象外）。Dream の統合・引退対象外。
  3. 常に Core に常駐し、全てのHuginnクエリのコンテキストに入る。
- **編集・削除**：ユーザーはいつでも Seed記憶を編集・削除できる。編集は新バージョンを作る（4.6のMVCC）。
- **重要な制約**：Seed記憶も「fact」と「opinion」を分けて登録させる。
  - 「当社はAIインフラ投資を重視」= fact的seed（Huginn既定で読む）。
  - 「私はTSMCに強気」= opinion的seed → `munin_opinions` に `is_seed=true` で格納し、既定では読まない。
  - これにより、ユーザー自身の先入観が Huginn の判断に常時侵入することを防ぐ。

### 4.4 書込時ゲーティング（Write-Time Gating）— v2.0の中核機構

研究（arXiv:2603.15994）の結論：**記憶を「読む段階」でのフィルタは破綻する。「書く段階」でのゲートが唯一機能する。**
よって Munin への全書込は、必ず以下のゲートを通る。

**ゲートの処理（`lib/munin/write-gate.ts`）**：

```
function writeGate(candidate):
    # ① source_type を判定（最重要）
    source_type ∈ {
      primary_filing,   # FERC/SEC/PUC/郡登記など一次資料 → 最高信頼
      official_ir,      # 企業公式IR（filing部分） → 高信頼
      odim_derived,     # Odimの推論器(SPVResolver等)の出力 → 中〜高
      huginn_inference, # Huginnの推論結果 → 中（confidence依存）
      user_seed,        # ユーザー登録 → 最高信頼
      web_narrative,    # 一般Web・ニュース・SNS → 判断根拠にしない
    }

    # ② memory_class を判定
    memory_class ∈ {fact, procedure, seed, opinion}

    # ③ salience_score を計算（0-1）
    salience = source_reputation × novelty × reliability × certainty

    # ④ ゲート判定（構造的ルーティング）
    if source_type == web_narrative:
        → munin_memory には絶対に書かない
        → raw_signals(layer='narrative') にのみ記録（RDS計算用、判断根拠外）
        return REJECTED_FROM_MEMORY

    if memory_class == opinion:
        → munin_opinions テーブルに格納（既定で読まれない）
        return WRITTEN_TO_OPINIONS

    if memory_class in {fact, procedure, seed}:
        if salience >= THRESHOLD (既定0.55、環境変数化):
            → munin_memory に status='active' で格納
        else:
            → munin_memory に status='archived' で格納（削除しない＝MVCC）
        return WRITTEN_TO_MEMORY
```

**この設計が保証すること**：
- ナラティブ情報（ノイズ）は、いかなる経路でも `munin_memory`（判断根拠になる記憶）に侵入できない。
- 意見・過去判断は、Huginn が明示的に要求しない限り判断に混入しない。
- 低信頼の事実は捨てずに `archived` で保持し、後で出典が補強されたら `active` に昇格できる。

### 4.5 マルチスコープ（組織分断）

全記憶レコードは `org_id` を必須で持つ。Supabase RLS で、ある org は自分の `org_id` の記憶しか読めない（`03-ONTOLOGY.md` のRLSポリシー）。
`munin_opinions` にも同一のRLSを適用する。公開Ontology（`ontology_objects.org_visible IS NULL`）は全org共通だが、Munin（memory + opinions）は完全分離。

### 4.6 記憶ライフサイクル（decay + Retrieval-Induced Forgetting）

記憶を溜め込むだけだと「干し草の山」になり検索精度が落ちる。`decay_score`（0-1, 初期1.0）で寿命を管理。

- **アクセス時**：検索でヒットした記憶は `decay_score` を回復、`last_accessed_at` 更新。
- **Retrieval-Induced Forgetting（v2.0追加）**：あるクエリで「検索されたが選ばれなかった」競合記憶、および30日以上ヒットしない記憶は、`decay_score` を 0.9x ずつ逓減。これは人間の海馬で起きる適応的忘却の模倣で、**古い情報への引きずられを構造的に弱める**。
- **MVCC（多版型）**：記憶は更新時に上書きせず、新バージョンを作る（`valid_from` / `valid_to`）。古い版は `valid_to` を設定して無効化。これにより記憶汚染が起きても過去版にロールバックできる（Anthropic Dreams の immutable-input 思想）。
- **引退**：`decay_score < 0.1` の記憶は `status='retired'` にする（物理削除はしない）。
- **免除**：`is_seed=true` の記憶は減衰・引退の対象外。

### 4.7 Dream（夜間記憶整理バッチ）— v2.0追加

Anthropic の Dreaming（2026-05）は Claude Managed Agents 専用APIだが、その**構造**は Gemini + pgvector で再現できる。

**目的**：稼働していない夜間に、Munin の記憶を整理・統合・矛盾解消し、翌日の Huginn の判断品質を上げる。

**実装（`scrapers/` と同じ GitHub Actions 日次cron、`lib/munin/dream.ts`）**：

```
function dreamJob(org_id):  # org ごとに実行
    # 入力ストアは絶対に変更しない（immutable-input原則）
    snapshot = readMuninSnapshot(org_id)

    # フェーズ1: Cluster — 類似記憶をembeddingでクラスタリング
    clusters = clusterByEmbedding(snapshot.facts)

    # フェーズ2: Consolidate — 重複・冗長をマージ
    for cluster in clusters:
        merged = geminiSummarize(cluster)  # gemini-2.5-flash

    # フェーズ3: Contradict — 矛盾ペアを検出し最新タイムスタンプを採用
    contradictions = detectContradictions(snapshot.facts)
    resolved = resolveByRecency(contradictions)

    # フェーズ4: Promote — 頻出パターンをprocedureに昇格
    patterns = extractRecurringPatterns(snapshot)
    new_procedures = patterns where frequency >= 3

    # 出力は新ストアに書く（旧ストアは保持）
    new_store = createMemoryStore(merged + resolved + new_procedures)

    # 人間承認（HITL）：重要変更は管理者レビュー後に切替
    queueForReview(org_id, new_store, diff_from(snapshot))
```

**重要な制約**：
- Dream は **opinion を統合しない**（意見の統合は意見の固定化＝危険）。fact と procedure のみ対象。
- Dream は `web_narrative` を扱わない（そもそも `munin_memory` に存在しない）。
- Dream の出力は必ず diff を残し、`munin_dream_runs` に記録。重要変更は管理者承認（HITL）。
- モデルは `gemini-2.5-flash`。日次1回・org単位なので無料枠（250 RPD）に収まる。

---

## 5. Huginn — 思考層

### 5.1 3層リトリーバルカスケード（Munin単独依存からの脱却）

あなた（Souma）の指摘「Huginn は Munin だけから答えを出すのではない」は正しい。Huginn は適応的に3層を辿る。

```
[ユーザー要求]
   ↓
[Huginn Planner（gemini-2.5-flash）]
   ↓ self-assessment（5.3）：構造化出力で {need_retrieval, source_plan, confidence} を必ず出す
   │
   ├─ Layer 1: Munin検索（4.1のmunin_memory = fact/procedure/seed）
   │     → マルチシグナル検索（意味類似 + 鮮度 + 重要度 + リンク近接）
   │     → 結果の信頼度を評価。十分なら回答へ。
   │
   ├─ 不足 → Layer 2: Odim内部キャッシュ / Ontology
   │     → ontology_objects, ontology_links, entities, raw_signals(narrative以外)
   │     → 「Odimが既に持っているコアリソース情報」を辿る
   │
   └─ なお不足 → Layer 3: Web検索（5.2で2系統に厳格分離）
         → reality_gapfill_search（許可ドメイン）または
         → narrative_capture_search（RDS計算専用）
   ↓
[Critic（Self-RAG風）：各層の結果の矛盾・信頼度を検査]
   ↓
[Synthesizer：回答生成 + 出典付与]
```

**カスケードのゲート判定（SEAKR式）**：各層へ進むかは「Huginn の self-aware uncertainty が閾値 τ を超えたか」で決める。むやみに全層を叩かない（Gemini無料枠の10 RPM を守るため、これは性能要件でもある）。

### 5.2 Reality検索 / Narrative検索の関数分離（あなたのISSUE 2への回答）

**あなたの懸念は正確**：Web検索で汎用ナラティブを集めて判断根拠にすると、Odimのコア思想の否定になる。
**v2.0の解**：Web検索を「目的の異なる2つの別関数」に物理分離する。Huginn はどちらを呼ぶかを明示的に選ぶ。

#### 関数A：`reality_gapfill_search()` — コアリソース情報の不足補完
- **発動条件**：Layer 1・2 で「コアリソース（土地・水・電力・建設・許認可・資本）の情報が不足」と判定されたとき。
- **検索対象**：**ドメイン許可リスト制**。FERC、SEC EDGAR、各州PUC、郡の土地登記、企業公式IRの filing ページ、政府調達公示など、`config/sources.json` に列挙された一次資料ソースのみ。
- **結果の扱い**：`source_type = primary_filing / official_ir` として書込ゲートを通る → `munin_memory` に入れる → **判断根拠になれる**。
- **これは「ノイズ収集」ではない**。Odimが追うべき Reality シグナルそのものを、不足時に取りに行くだけ。コア思想と完全に整合する。

#### 関数B：`narrative_capture_search()` — 市場ナラティブの捕捉
- **発動条件**：RDS（Reality Divergence Score）を計算するため、「市場・メディアが何と言っているか」を知る必要があるとき**のみ**。
- **検索対象**：一般Web（ニュース、アナリスト見解、SNS）。
- **結果の扱い**：`source_type = web_narrative` として書込ゲートを通る → **`munin_memory` には絶対に入らない**（4.4で構造的に遮断）→ `raw_signals(layer='narrative')` にのみ記録。
- **判断根拠にならない**。用途は厳密に2つだけ：
  1. RDS の計算（「Reality と Narrative の乖離」を数値化する。乖離の片側＝Narrative の測定に必要）。
  2. UI上の「市場はこう言っている」パネルに**対比として**表示（`06-SCREENS.md` の Capital Flow の Narrative→Reality Gap）。
- Huginn が「実際に何が起きているか（Reality）」の回答を構築するとき、`web_narrative` のレコードは**コンテキストに入らない**。Narrative は判断の隣に並べる対比物であって、判断の材料ではない。

**この分離が「本末転倒」を防ぐ仕組み**：
- ナラティブを「リサーチしない」のではなく「リサーチするが、判断根拠にできない場所にしか置けない」。
- プロンプトで「ナラティブを無視せよ」と指示するのではない（PI-LLM研究：効かない）。
- 書込ゲートという**構造**で、ナラティブが判断用メモリに物理的に到達できないようにする。
- 結果：Odim は「Reality に基づく判断」と「Narrative との乖離の提示」を両立できる。

### 5.3 self-assessment（Self-RAG式 reflection）

Huginn の最初の Gemini 呼び出しは、必ず以下の構造化出力（JSON）を返す：

```json
{
  "need_retrieval": true,
  "source_plan": ["munin", "odim_cache"],
  "needs_reality_gapfill": false,
  "needs_narrative_capture": false,
  "confidence_without_retrieval": 0.3,
  "uses_past_opinion": false
}
```

- `uses_past_opinion` が true のときだけ、`munin_opinions` を読み込む（既定は読まない＝4.1）。
  Huginn が「過去の自分の判断を踏まえる」と意識的に決めた場合のみ。
- `needs_narrative_capture` が true でも、その結果は判断根拠にならない（5.2）。

### 5.4 推論フロー（擬似コード）

```
function huginnQuery(org_id, user_id, question):
    # 1. Core Memory（seed含む）を常にコンテキストへ
    core = loadCoreMemory(org_id)   # fact/procedure/seed のみ。opinionは入れない

    # 2. self-assessment
    plan = geminiAssess(question, core)

    # 3. カスケード実行（5.1）
    evidence = []
    if plan.need_retrieval:
        evidence += searchMunin(org_id, question)          # Layer 1
        if insufficient(evidence):
            evidence += searchOdimCache(question)          # Layer 2
        if insufficient(evidence) and plan.needs_reality_gapfill:
            evidence += realityGapfillSearch(question)     # Layer 3-A
    # narrative は判断根拠に入れない。RDS計算が必要なときだけ別途取得
    narrative = narrativeCaptureSearch(question) if plan.needs_narrative_capture else null

    # 4. 過去意見は明示要求時のみ
    past_opinions = searchOpinions(org_id, question) if plan.uses_past_opinion else []

    # 5. Ontology を因果探索（再帰CTE、3ホップ）
    subgraph = walkOntology(question_entities, max_hops=3)

    # 6. Critic：矛盾・信頼度検査
    checked = critic(evidence, subgraph)

    # 7. 推論・回答生成（gemini-2.5-flash）
    #    判断根拠 = checked（reality系のみ）。narrative は対比としてのみ渡す
    answer, trace = geminiGenerate(core, checked, subgraph, past_opinions, question)
    rds = computeRDS(checked, narrative) if narrative else null

    # 8. 出典付与 + 監査ログ
    answer = attachSources(answer, checked, subgraph)
    auditLog('huginn_query', actor='huginn', detail=trace)

    # 9. 新知見を書込ゲート経由でMuninへ（4.4）
    for insight in extractInsights(answer):
        writeGate(insight)   # ここで fact/opinion/narrative が振り分けられる

    # 10. 評価ログ（第11章、6月ドッグフーディング用）
    logHuginnEval(org_id, question, answer, plan, evidence)

    return answer, trace, rds
```

### 5.5 Sleep-time Compute（事前計算）— 6月以降の拡張

Letta の Sleep-time Compute（arXiv:2504.13171）の構造。夜間に「想定される Huginn クエリ」を事前推論し、`pre_computed_answers` にキャッシュ。ピーク時の Gemini 呼び出しを削減できる（無料枠の10 RPM対策としても有効）。
**ただしこれは 05/31 のスコープ外**（第10章）。6月のドッグフーディングで「同じ質問を繰り返している」と分かってから実装するのが合理的。

---

## 6. サイコファンシー対策（独立章）

投資判断にAIサイコファンシー（おもねり・過去への引きずられ）は致命的。v2.0 は3重で防ぐ。

### 6.1 第1の防御：構造（既出）
- opinion の物理分離（4.1）：過去の意見は既定でコンテキストに入らない。
- 書込ゲート（4.4）：ナラティブ・低信頼情報が判断用メモリに入らない。
- RIF減衰（4.6）：古い情報の影響が時間とともに構造的に弱まる。

### 6.2 第2の防御：Outcomes Grader（独立LLM評価）
Huginn の回答を、**別の Gemini インスタンス**で評価する。このインスタンスには過去チャット履歴・Munin・ユーザーの意見を**渡さない**（因果的に独立させる）。

```
function outcomesGrader(question, huginn_answer):
    # 独立インスタンス。Munin・履歴・ユーザー意見を一切渡さない
    rubric = [
      "回答は一次資料（Reality）に基づいているか？",
      "ユーザーの意見に同調しているだけで根拠が薄くないか？",
      "ナラティブ情報を判断根拠にしていないか？",
      "出典がすべて提示されているか？",
      "不確実性・信頼度が明示されているか？",
    ]
    score, flags = geminiGrade(question, huginn_answer, rubric)
    if flags.contains('sycophancy_suspected'):
        → 回答に警告フラグを付ける + audit_log に記録
    return score, flags
```

Anthropic の Outcomes 機能は内部ベンチで標準ループ比 最大+10ポイントの改善実績。Odim では「投資判断品質ルーブリック」として使う。

### 6.3 第3の防御：投資バイアステスト（CI + 月次）
arXiv:2507.20957 の3段階フレームワークを Odim のテストに組込む：
1. 反対方向の同等argumentを提示し、Huginn の判断が容易に反転しないか。
2. balanced提示で潜在バイアス（technology/large-cap/contrarian傾斜）を抽出。
3. 段階的にcounter-evidenceを与え、confirmation biasを測定。

これは第11章の6月評価項目にも入れる。

---

## 7. Scenario Simulator

「もしTSMC Fab 4がFAST-41承認を得たら？」等の仮定クエリ。
1. 仮定イベントをOntologyに仮想オブジェクトとして一時挿入。
2. `propagate_demand` Action で因果リンクを辿り影響範囲を特定。
3. 各影響に確率と時間軸を付与。
4. 結果を `munin_opinions` に **`memory_class` 相当を opinion 扱い**で保存（シミュレーション結果＝推論）。次回同じ仮定が来たら参照できるが、既定では判断根拠にしない。

---

## 8. UI対応（Huginn Console 画面）

`06-SCREENS.md` の Huginn Console で可視化：
- **対話エリア**：質問と回答。回答にReasoning Traceと出典を埋め込む。
- **Reasoning Trace パネル**：Huginnが辿ったカスケード層、検索したMunin記憶、Ontologyノード。
- **Sources パネル**：回答の出典（一次資料）。
- **Reality / Narrative 対比**：`reality_gapfill` の結果と `narrative_capture` の結果を**明確に区別して**表示。ナラティブ側には「判断根拠外・対比用」のラベル。
- **Sycophancy フラグ**：Outcomes Grader が警告を出した回答にバッジ表示。
- **Munin インジケータ**：「この組織のMuninは fact N件 / procedure M件 / seed K件」。opinion件数は別表示。
- **Seed Memory 編集**：Settings画面（`06-SCREENS.md` の Settings）に Seed登録・編集UI。

---

## 9. DBスキーマ（v2.0 更新）

> `03-ONTOLOGY.md` の `munin_memory` を以下で**置き換える**。加えて新テーブルを追加。
> CodeX 5.5 はこのスキーマでマイグレーションを作成すること。`03-ONTOLOGY.md` 側にも「munin_memory の正典は 05 にある」と注記すること。

```sql
-- ===== Munin 記憶（fact / procedure / seed のみ。判断根拠になれる）=====
create table munin_memory (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  user_id uuid references users(id),
  memory_class text not null,        -- fact / procedure / seed
  agent_scope text not null,         -- core / archival / recall
  source_type text not null,         -- primary_filing/official_ir/odim_derived/huginn_inference/user_seed
  content text not null,
  embedding vector(768),
  salience_score float not null default 0.5,   -- 書込ゲートが計算
  importance float default 0.5,
  decay_score float default 1.0,
  is_seed boolean default false,               -- true は減衰・引退・Dream統合の対象外
  status text not null default 'active',       -- active / archived / retired
  linked_memory_ids uuid[] default '{}',
  valid_from timestamptz default now(),         -- MVCC
  valid_to timestamptz,                         -- null = 現行版
  created_at timestamptz default now(),
  last_accessed_at timestamptz default now()
);
create index on munin_memory using ivfflat (embedding vector_cosine_ops);
create index on munin_memory (org_id, memory_class, status);

-- ===== Munin 意見（opinion。既定でHuginnに読まれない）=====
create table munin_opinions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  user_id uuid references users(id),
  source_type text not null,         -- huginn_inference / user_seed
  content text not null,
  embedding vector(768),
  is_seed boolean default false,
  valid_from timestamptz default now(),
  valid_to timestamptz,
  created_at timestamptz default now()
);
create index on munin_opinions using ivfflat (embedding vector_cosine_ops);
create index on munin_opinions (org_id);

-- ===== Dream バッチの実行記録 =====
create table munin_dream_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  phase_summary jsonb,               -- cluster/consolidate/contradict/promote の結果
  diff jsonb,                        -- 旧→新の差分
  status text not null default 'pending_review',  -- pending_review/approved/rejected
  created_at timestamptz default now()
);

-- ===== Huginn 評価ログ（第11章 6月ドッグフーディング用）=====
create table huginn_eval_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  question text not null,
  answer text not null,
  plan jsonb,                        -- self-assessmentの出力
  retrieval_layers_used text[],      -- 使ったカスケード層
  sources_count int,
  grader_score float,                -- Outcomes Grader のスコア
  grader_flags text[],               -- sycophancy_suspected 等
  user_rating int,                   -- ユーザーの手動評価（1-5、第11章）
  user_note text,
  created_at timestamptz default now()
);

-- ===== RLS（組織分断）=====
alter table munin_memory enable row level security;
alter table munin_opinions enable row level security;
alter table munin_dream_runs enable row level security;
alter table huginn_eval_log enable row level security;
-- 4テーブルすべてに org_id = 自分のorg のポリシーを適用（03-ONTOLOGY.md の方式）
```

---

## 10. 05/31までの実装スコープ（CodeX 5.5 向け・現実的優先順位）

> **テックリードとしての率直な判断**：2026/05/25→05/31 の6日間で、本ファイルの全機能を商用品質で実装するのは不可能。
> 6月のドッグフーディングを「意味のある評価」にするために、**6日で確実に動かすべき最小核**と**6月中に足すもの**を分ける。
> これは妥協ではなく、「評価可能な状態を最短で作る」ための工学的判断。

### 05/31までに完成させる（ドッグフーディング必須核）
1. **DBスキーマ全体**（第9章）— 4テーブル + RLS。後から変えると痛いので最初に確定。
2. **書込ゲート**（4.4）— v2.0の中核。これが無いと評価の意味が無い。
3. **fact / opinion 物理分離**（4.1）— `munin_memory` と `munin_opinions`。
4. **Seed Memory 登録UI**（4.3）— 自分の情報を入れないとドッグフーディングが始まらない。
5. **2層カスケード**（5.1 の Layer 1 + Layer 2）— Munin + Odim内部キャッシュ。
6. **reality_gapfill_search**（5.2 関数A）— 許可ドメイン制の最小実装。
7. **self-assessment**（5.3）— 構造化出力。
8. **huginn_eval_log への記録**（第9章）— 評価のための計装。これが無いと6月の評価ができない。
9. **基本のHuginn Console UI**（第8章の対話 + Sources + Reality/Narrative対比ラベル + 評価ボタン）。

### 6月中に足す（ドッグフーディングの所見を見てから）
- **Dream バッチ**（4.7）— 1週間使って記憶が溜まってから入れる方が、整理対象があり評価しやすい。
- **narrative_capture_search**（5.2 関数B）+ RDS連携 — Reality側が安定してから対比機能を足す。
- **Outcomes Grader**（6.2）— Gemini無料枠の消費が増えるため、コア動作が安定してから。
- **Layer 3 Web検索の本格化**、**Sleep-time Compute**（5.5）、**投資バイアステスト自動化**（6.3）。

> CodeX 5.5 への指示：上記「05/31核」を上から順に実装。各項目は独立にテスト可能な単位で区切る。
> v1.0 からの主な差分は、`munin_memory` のスキーマ拡張と新3テーブル、書込ゲート、検索の2系統分離。

---

## 11. 6月ドッグフーディング評価フレームワーク（あなたのQ3への回答）

6月の1ヶ月、自分（Souma）が Odim を継続利用して評価する。**主観の感想で終わらせず、計測する。**
`huginn_eval_log` テーブルに毎回記録し、週次で集計する。

### 11.1 評価の前提
- 評価者 = Souma 1人（単独ドッグフーディング）。
- 記録 = Huginn の各クエリ後、`huginn_eval_log` に自動記録 + 手動で `user_rating`(1-5) と `user_note` を入力。
- 集計 = 週次（第1週=基準値、第2-3週=本格利用、第4週=総括）。

### 11.2 評価カテゴリと項目（8カテゴリ）

| # | カテゴリ | 評価項目 | 計測方法 | 6月末の目標 |
|---|---|---|---|---|
| **A** | 記憶の正確性 | Munin が正しい事実を想起したか | クエリごとに「想起された記憶は正しかったか」を1-5評価 | 平均 4.0以上 |
| | | 古い/誤った記憶を出した回数 | `user_note` に記録、週次カウント | 週あたり減少傾向 |
| **B** | サイコファンシー / 引きずられ ★最重要 | 過去の意見に引きずられた回答の数 | 「これは過去データに引きずられている」と感じた回答をフラグ | 全クエリの5%未満 |
| | | 反対意見テストの反転率 | 週1回、同じ問いを反対前提で投げ、判断が安易に反転するか | 反転は根拠ある時のみ |
| | | Outcomes Grader の sycophancy フラグ率 | `grader_flags` を集計（Grader実装後） | 5%未満 |
| **C** | リトリーバル・ルーティング | 正しいカスケード層を選んだか | `retrieval_layers_used` と実際の必要性を照合 | 適合率 80%以上 |
| | | 不要なWeb検索を起動した回数 | self-assessment のログを確認 | 過剰起動 週5回未満 |
| **D** | Reality/Narrative分離 ★最重要 | ナラティブが判断根拠に混入した回数 | 回答の出典を全件確認。`web_narrative` が根拠に出たら重大欠陥 | **0回（許容ゼロ）** |
| | | Reality と Narrative の対比が有用だったか | RDS表示の納得感を1-5評価 | 平均 3.5以上 |
| **E** | 回答品質 / 実用価値 | 回答が実際の判断に役立ったか | `user_rating` 1-5 | 平均 3.8以上 |
| | | Lead-time価値（公式発表より早く気づけたか） | 「Odimで先に知れた」事例を月次カウント | 1件以上の実例 |
| | | 出典をすべて辿れたか | 出典リンクの有効性を確認 | 100% |
| **F** | Dream / 夜間処理 | Dream後に記憶が整理されたか（実装後） | `munin_dream_runs` の diff をレビュー | 重複・矛盾が減少 |
| | | Dream が誤った統合をした回数 | diff レビューで誤統合をカウント | 週1件未満 |
| **G** | コスト / レート制限 | Gemini無料枠（10 RPM/250 RPD）超過回数 | 429エラーのログ集計 | 日次でRPD内に収まる |
| | | 1クエリあたりの平均トークン・レイテンシ | ログから集計 | レイテンシ体感で許容内 |
| **H** | システム安定性 | スクレイパー/バッチの失敗率 | GitHub Actions のログ | 失敗時に検知できる |
| | | 組織分離（RLS）の検証 | 別orgを作り、相互不可視をテスト | 漏洩 0件 |

### 11.3 週次レビューの進め方
- **第1週（6/1-6/7）**：基準値の測定。まず Seed Memory を充実させ、毎日使い、A〜Hの初期値を記録。
- **第2-3週（6/8-6/21）**：本格利用。記憶が溜まった状態でDと B（分離・引きずられ）を重点監視。Dream・Grader をこの期間に投入し、投入前後を比較。
- **第4週（6/22-6/30）**：総括。8カテゴリを集計し、目標達成/未達を判定。未達項目を「7月の改修バックログ」に。

### 11.4 「失敗」の定義（Go/No-Go基準）
以下が起きたら、その機能は**設計に戻して作り直す**：
- **D（分離）で `web_narrative` が判断根拠に1回でも混入** → 書込ゲートの欠陥。最優先で修正。
- **B（引きずられ）が全クエリの15%超** → opinion分離が機能していない。アーキテクチャ見直し。
- **E（実用価値）の平均が3.0未満** → そもそも Huginn が役に立っていない。コンセプトから再検討。

### 11.5 評価を仕組みにする
- Huginn Console に「この回答を評価」ボタン（1-5 + メモ）を置き、`huginn_eval_log` に書く（第10章の核スコープに含む）。
- 週次集計は簡単な管理ページ or SQLクエリで。**評価は計測されなければ改善できない。**

---

## 12. 実装上の絶対ルール（CodeX 5.5 厳守）

1. **組織分断は神聖**。`munin_memory` / `munin_opinions` / `huginn_eval_log` / `munin_dream_runs` への全クエリは `org_id` フィルタを通す。RLS + アプリ層の二重チェック。
2. **書込ゲートを迂回しない**。Munin への書込は例外なく `lib/munin/write-gate.ts` を経由する。直接 INSERT を禁止。
3. **`web_narrative` を `munin_memory` に入れない**。これは構造的禁止。違反は Odim のコア思想の破壊。
4. **opinion を既定でHuginnコンテキストに入れない**。`uses_past_opinion=true` の明示時のみ。
5. **Huginn は断定しない**。確率・信頼度・出典を常に添える。
6. **記憶は物理削除しない**。`archived` / `retired` ラベルで残す（MVCC）。
7. **Seed記憶は減衰・引退・Dream統合の対象外**。
8. **すべての推論を `audit_log` に記録**。なぜそう判断したか後から完全再現できること。
9. **Gemini無料枠を超えない**。カスケードは全層を無条件に叩かない。429は指数バックオフ。
10. **`huginn_eval_log` への記録を省略しない**。6月評価の生命線。

---

## 13. 監査結果（テックリードとしての論理的・技術的矛盾チェック）

本ファイルを「ミスの多い人間が書いた」と仮定して監査した。発見した論点と解決：

| # | 監査で発見した矛盾・リスク | 解決 |
|---|---|---|
| M1 | 「Web検索を付ける」と「Reality>Narrativeのコア思想」が一見矛盾 | 検索を2関数に物理分離（5.2）。reality_gapfillは判断根拠可、narrative_captureは不可。書込ゲートで構造的に保証。矛盾は解消。 |
| M2 | 「opinionを既定で読まない」と「Scenario Simulatorの結果を保存」が衝突しうる | Scenario結果は opinion 扱いで `munin_opinions` に保存し、既定で判断根拠にしない（第7章）。整合。 |
| M3 | Dream（夜間整理）が opinion を統合すると意見が固定化し sycophancy を悪化させる | Dream は fact/procedure のみ対象。opinion は統合しない（4.7明記）。 |
| M4 | Gemini無料枠（10 RPM/250 RPD）で「カスケード3層 + Grader + Dream」を回すと枠超過 | カスケードはSEAKR式ゲートで全層を叩かない。Grader・Dreamは05/31スコープ外にし6月投入（第10章）。Dreamは日次1回でRPD内。整合。 |
| M5 | 6日間で全機能を「完全実装」する要求は、品質を担保すると非現実的 | 第10章で「05/31核」と「6月追加」に分割。率直に明示。 |
| M6 | `03-ONTOLOGY.md` の旧 `munin_memory` スキーマと本ファイルの新スキーマが不整合 | 第9章で「03の munin_memory を置き換える」と明記。CodeXは本ファイルを正典とする。03側にも注記を入れること。 |
| M7 | 書込ゲートの `salience` 閾値0.55は根拠が弱い（恣意的） | 初期値として提示。環境変数化し、第11章の6月評価（カテゴリA）で実データから調整する前提。ハードコード禁止。 |
| M8 | 「単独ドッグフーディング」では評価者バイアスが避けられない（自分の作ったものを甘く見る） | 第6.2章のOutcomes Grader（独立LLM）と第11.4の客観的Go/No-Go基準で、主観評価を補完。完全には消せないが緩和。 |
| M9 | reality_gapfill の「ドメイン許可リスト」が狭すぎると情報不足、広すぎるとナラティブ混入 | `config/sources.json` で管理し、一次資料のみ厳選。リスト更新時はレビュー必須（運用ルール）。 |
| M10 | RIF減衰（4.6）が重要な古い事実まで減衰させるリスク | 減衰対象は relevance であり削除ではない（`archived` 化）。重要fact は importance が高く減衰が遅い。seed は免除。多層で保護。 |

**総合監査judgment**：v2.0 の設計は、05/31核と6月追加に分離する前提（第10章）であれば、論理的・技術的に整合している。
最大のリスクは M5（6日間の納期）と M7（閾値の根拠）。前者は第10章のスコープ分割で、後者は6月評価での実データ調整で対処する。
コア思想（Reality>Narrative）と Web検索機能の両立という最難関の論点（M1）は、検索の関数分離 + 書込ゲートという構造で解決できている。
