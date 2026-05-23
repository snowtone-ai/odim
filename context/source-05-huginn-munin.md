# 05 — HUGINN & MUNIN：AIエージェントの記憶・推論アーキテクチャ

> 前提: `00-VISION.md`, `03-ONTOLOGY.md` を読了していること。
> このファイルは、最新のAIエージェント記憶研究（2025-2026）を解析・統合した設計です。

---

## 1. コンセプト

北欧神話のオーディンは2羽の鴉を持つ：
- **Huginn（フギン）= 思考** → Odimでは **能動的に推論し、Ontologyを探索し、回答を生成するエージェント**。
- **Munin（ムニン）= 記憶** → Odimでは **組織ごとに育つ記憶層**。

### 核心思想：組織ごとに育つAI
ユーザー（組織）は自分専用の Huginn / Munin を持つ。企業のノウハウ・機密情報・過去の判断は組織内に蓄積され、**他組織からは完全に分断**される。使えば使うほど、その組織のHuginn/Muninは賢くなる。これは単なるネーミングではなく、機能設計そのものである。

---

## 2. 最新研究の解析（2025-2026の到達点）

実装の前に、何を参考にしたかを明示する。実装者はこれらの「いいとこ取り」をする。

| 研究 / 技術 | 何が優れているか | Odimへの採用 |
|---|---|---|
| **MemGPT / Letta**（UC Berkeley） | OS的な3階層記憶（Core=RAM / Archival=ディスク / Recall=会話履歴）。エージェント自身が記憶を読み書きする。 | ★3階層構造をMuninの骨格に採用 |
| **Mem0**（ECAI 2025, arXiv:2504.19413） | 選択的記憶。単一パス階層抽出 + マルチシグナル検索（類似度だけでなく recency + importance）。 | ★検索を「マルチシグナル」にする |
| **A-Mem**（2025） | Zettelkasten式のリンクされたメモリノート。85-93%のトークン削減。 | ★メモリ間リンク（`linked_memory_ids`）を採用 |
| **Memori**（2026） | セマンティック・トリプル（主語-述語-目的語）で81.95%精度を5%コストで達成。 | ★重要な記憶はトリプル形式で構造化保存 |
| **Multi-scope memory**（業界標準パターン） | 各記憶に user_id / agent_id / session_id / org_id のスコープタグを付け、検索時に合成。 | ★org_id スコープが組織分断の要 |
| **記憶ライフサイクル**（2026の主要課題） | 記憶の consolidation（統合）/ promotion（昇格）/ demotion（降格）/ retirement（引退）。これが無いと記憶が「干し草の山」になる。 | ★decay_score によるライフサイクル管理を採用 |

> **設計判断**: 外部の有料記憶サービス（Mem0クラウド版、Zep等）は使わない（コストゼロ原則）。
> 上記研究の**思想だけ**を取り込み、pgvector（無料・Supabase内蔵）上に自前実装する。

---

## 3. Munin（記憶層）のアーキテクチャ

### 3.1 3階層構造（MemGPT/Letta式）

```
┌─────────────────────────────────────────────────┐
│  Core Memory（コア記憶）= RAM                       │
│  常にHuginnのコンテキストに入る。最重要・最頻出。       │
│  例: その組織の投資テーマ、監視対象の優先企業、         │
│      組織独自のルール・ノウハウ                       │
│  → munin_memory.agent_scope = 'core'              │
├─────────────────────────────────────────────────┤
│  Archival Memory（アーカイブ記憶）= ディスク           │
│  pgvectorで意味検索。必要時にHuginnが明示的に検索。    │
│  例: 過去の全分析結果、SPV解決の成功パターン、          │
│      過去のシナリオシミュレーション結果                │
│  → munin_memory.agent_scope = 'archival'          │
├─────────────────────────────────────────────────┤
│  Recall Memory（想起記憶）= 会話ログ                  │
│  Huginnとの過去の対話履歴。時系列で検索可能。           │
│  → munin_memory.agent_scope = 'recall'            │
└─────────────────────────────────────────────────┘
```

### 3.2 Multi-scope（組織分断の要）

すべての記憶レコード（`munin_memory`）は以下のスコープを持つ：

| スコープ | 用途 |
|---|---|
| `org_id` | **必須**。組織の境界。RLSで強制。他組織から絶対に見えない。 |
| `user_id` | 個人スコープの記憶（その人の分析の好み等） |
| `agent_scope` | core / archival / recall |
| `session_id`（content内） | 会話セッション単位 |

**組織分断の実装**: `03-ONTOLOGY.md` のRLSポリシーで、`munin_memory` は `org_id = 自分のorg` の行しか読めない。
公開Ontology（`ontology_objects.org_visible IS NULL`）は全組織共通だが、Muninの記憶は完全分離。

### 3.3 メモリのリンク（A-Mem式）

各記憶は `linked_memory_ids` で他の記憶と繋がる。
例: 「Laidley LLC を Meta と解決した」記憶 ←リンク→ 「Project Horizon を NVIDIA と解決した」記憶。
→ Huginnが「これは過去のLaidleyパターンに似ている」と想起できる。

### 3.4 セマンティック・トリプル（Memori式）

重要な事実は「主語-述語-目的語」のトリプルでも保存する。
例: `(Meta, controls_via_spv, Laidley LLC)` / `(Laidley LLC, located_in, Louisiana)`。
非構造テキストより検索効率・精度が高い。

### 3.5 メモリ・ライフサイクル

`decay_score`（0-1, 初期1.0）で記憶の寿命を管理：
- アクセスされるたび `decay_score` を回復、`last_accessed_at` 更新。
- 日次バッチで未アクセスの記憶の `decay_score` を逓減。
- `consolidation`: 類似記憶を統合（重複削減）。
- `promotion`: 頻繁に検索される archival 記憶を core に昇格。
- `demotion`: 使われない core 記憶を archival に降格。
- `retirement`: `decay_score` が閾値未満の記憶をアーカイブ（物理削除はしない）。

---

## 4. Huginn（思考層）のアーキテクチャ

### 4.1 Huginnの役割
ユーザー（または外部AI Agent）の自然言語クエリを受け、以下を行う：
1. クエリを理解し、必要な情報を特定。
2. **Munin** から関連記憶を検索（マルチシグナル検索）。
3. **Ontology**（`ontology_objects`/`ontology_links`）を再帰的に探索し、因果鎖を辿る。
4. LLM（Gemini）で推論し、回答を生成。
5. 推論過程（Reasoning Trace）と出典を提示。
6. 新しい知見を **Munin** に書き戻す（組織の記憶が育つ）。

### 4.2 マルチシグナル検索（Mem0式）

Muninから記憶を引き出すとき、コサイン類似度だけに頼らない：
```
retrieval_score = w1 * semantic_similarity   (pgvectorのコサイン距離)
                + w2 * recency                (last_accessed_at の新しさ)
                + w3 * importance             (munin_memory.importance)
                + w4 * link_proximity         (現在の話題からのリンク距離)
```
これにより「5分前の記憶」と「5週間前の意味的に同一な記憶」を区別できる。

### 4.3 Huginnの処理フロー（擬似コード）

```
function huginn_query(org_id, user_id, question):
    # 1. Core Memory を常にコンテキストへ
    core = load_core_memory(org_id)

    # 2. マルチシグナル検索で Archival/Recall から関連記憶
    memories = multi_signal_search(org_id, question, top_k=10)

    # 3. Ontology を探索（再帰CTEで因果鎖を取得）
    ontology_subgraph = walk_ontology(question_entities, max_hops=3)

    # 4. LLM（Gemini）に推論させる
    prompt = build_prompt(core, memories, ontology_subgraph, question)
    answer, reasoning_trace = gemini_generate(prompt)   # provider.ts 経由

    # 5. 出典を付与
    answer = attach_sources(answer, ontology_subgraph)

    # 6. 新しい知見を Munin に書き戻す
    write_memory(org_id, user_id, 'recall', question + answer)
    if is_significant(answer):
        write_memory(org_id, user_id, 'archival', extract_insight(answer))

    # 7. 監査ログ
    audit_log('huginn_query', actor='huginn', detail=reasoning_trace)

    return answer, reasoning_trace
```

### 4.4 Gemini無料枠への適合

- **モデル**: `gemini-2.5-flash`（安定既定）/ `gemini-2.5-flash-lite`（軽量処理）/ `gemini-flash-latest`（実験的な最新追随）。
- **レート制限対策**: Huginnクエリはサーバー側でキューイング。Google AI Studioで確認した現在のRPM/RPD/TPMに合わせ、`AI_MAX_RPM` / `AI_MAX_RPD` でスロットリングする。
- **429リトライ**: 指数バックオフ。
- **トークン節約**: A-Mem式リンクとトリプル形式で、コンテキストに詰めるトークンを最小化（研究では85-93%削減実績）。
- **コンテキストキャッシュ**: 繰り返し使うCore Memory部分はキャッシュ対象にする。
- 環境変数 `AI_MODEL` / `AI_PROVIDER` で、事業化時に有料Geminiモデル / Claude / GPT へ差し替え。

---

## 5. Scenario Simulator（Huginnの応用機能）

「もしTSMC Fab 4がFAST-41承認を得たら？」のような仮定クエリに対し：
1. 仮定イベントをOntologyに「仮想オブジェクト」として一時挿入。
2. `propagate_demand` Action で因果リンクを辿り、影響を受けるオブジェクト群を特定。
3. 各影響に確率と時間軸（何ヶ月後か）を付与。
4. 結果をMuninに保存（同じ仮定が再度問われたら高速応答）。

---

## 6. UI（Huginn Console 画面）との対応

`06-SCREENS.md` の Huginn Console 画面で、以下を可視化：
- **対話エリア**: 自然言語の質問と回答。
- **Reasoning Trace パネル**: Huginnが辿ったOntologyノード、検索したMunin記憶。
- **Sources パネル**: 回答の出典（FERC filing, SEC等）。
- **Memory インジケータ**: 「この組織のMuninは N 件の記憶を持つ」と成長を可視化。

---

## 7. 実装上の絶対ルール

1. **組織分断は神聖**。`munin_memory` への全クエリは必ず `org_id` フィルタを通す。RLSに加えてアプリ層でも二重チェック。
2. **記憶には必ず出典 or 生成根拠**を付ける。幻覚（hallucination）を記憶として固定しない。
3. **Huginnは断定しない**。確率・信頼度・出典を常に添える（`00-VISION.md` の哲学）。
4. **公開Ontology と Munin私的記憶を混同しない**。公開Ontologyは事実、Muninは組織の解釈・ノウハウ。
5. **記憶のライフサイクルを必ず回す**。さもないとMuninは数ヶ月で「干し草の山」になり検索精度が落ちる（2026研究の最大の教訓）。
