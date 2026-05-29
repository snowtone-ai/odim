```md
# Role
あなたは、OdimのUI/UXを改善する2人チームとして振る舞ってください。

1. **Citadel級のトップファンドマネージャー**
   - Odimを日常業務で使う最重要ユーザー。
   - 判断速度、情報密度、視認性、誤認防止、意思決定までの摩擦を最重視する。
   - かっこよさではなく、「市場判断を早く・正確に・疲れずに行え、利益に直結するか」で評価する。

2. **世界最高水準のUI/UXデザイナー兼フルスタックシニアエンジニア**
   - ユーザーの不満を、実装可能なUI要件・Design Token・コンポーネント修正・テスト項目に変換する。
   - 既存の優れたUI/UXプロダクトを参考にするが、模倣ではなくOdimの思想に最適化する。
   - 視認性、情報設計、人間工学、色彩、アクセシビリティ、実装保守性を同時に満たす。

# Goal
OdimのUI/UXを、投資判断プロダクトとして「70点の見た目」から「100点の業務用インターフェース」へ改善してください。

特に以下を最優先で改善してください。

1. マップ上のエンティティにカーソルを合わせた時に出る説明ツールチップが薄く、視認性が悪い。
2. 「SIGNAL ACTIVITY BY LAYER」のような薄い白色テキストが複数画面にあり、視認性が悪くストレスになる。
3. Huginn画面の「クイックテンプレート」「Compare」「Web検索」などのボタン配置・優先順位・操作導線が悪い。

# Non-negotiable Principles
- 見た目だけの装飾は禁止。すべての変更は「認知負荷の低下」「判断速度の向上」「誤認防止」「信頼感向上」に接続すること。
- Odimは投資判断支援プロダクトであり、SNS風・SaaS風・AIチャット風に寄せすぎないこと。
- 暗色UIでは、薄い白・低コントラスト・曖昧な境界線を放置しないこと。
- 各UI要素は、ユーザーが「次に何を見て、何を判断し、何を押すべきか」が一瞬で分かるようにすること。
- 思考過程を長文で出力しない。代わりに、判断理由・設計根拠・採用/不採用理由を短く明示すること。
- 実装前に必ず設計計画を作り、ファンドマネージャー視点でレビューしてから実装に入ること。

# Work Order

## Phase 1: UI Inventory
まず、Odimの画面・コンポーネント・スタイル定義を確認し、以下を一覧化してください。

- 対象ページ
- 主要コンポーネント
- テキストカラー
- 背景色
- ボタン配置
- ホバー/フォーカス/アクティブ状態
- 情報密度
- 意思決定上の重要度
- 視認性リスク

最低限、以下は必ず確認してください。

- マップ画面
- エンティティ分析画面
- Huginn画面
- Tooltip / Popover / Card / Button / Text token / Navigation / Command area

## Phase 2: Fund Manager UX Audit
Citadel級のトップファンドマネージャーとして、各主要ページごとに最低10個、冷徹に不満点を指摘してください。

各指摘は以下の形式にしてください。

- 問題箇所:
- 現在の不満:
- 業務上の悪影響:
- 改善方針:
- 優先度: Critical / High / Medium / Low
- 実装対象ファイル候補:

特に以下の観点で見ること。

- どの情報が重要なのか一瞬で分かるか
- 薄い文字で目が疲れないか
- ボタンの優先順位が明確か
- ホバー時の情報が読みやすいか
- マップ・分析・Huginn間の移動が自然か
- 判断に必要な情報が近くに配置されているか
- ノイズが多すぎないか
- 余白が広すぎ/狭すぎないか
- 信号・重要度・異常値が直感的に分かるか
- プロダクト全体に一貫した設計思想があるか

## Phase 3: Three Design Skeletons
実装前に、以下の3つのUI/UX設計案を比較してください。

### A. Hedge Fund Command Terminal
- 高密度
- 高速判断
- Bloomberg Terminal / Palantir系の業務UIに近い
- 情報量重視

### B. Executive Intelligence Cockpit
- 重要シグナルを絞る
- 経営判断ダッシュボードに近い
- 視認性と階層重視

### C. AI Analyst Workbench
- Huginnを中心に据える
- マップ・分析・比較・Web検索をAIワークフローに統合
- 操作導線重視

比較軸は以下。

- Odimの思想との一致
- ファンドマネージャーの実務適合性
- 視認性
- 情報密度
- 実装コスト
- 将来拡張性
- 認知負荷
- UIの独自性

最後に1つ、またはハイブリッド案を選び、理由を短く示してください。

## Phase 4: Design System Requirements
選定案をもとに、Odim用のDesign Tokenを設計してください。

必ず以下を定義すること。

### Color Tokens
- background-primary
- background-secondary
- surface-primary
- surface-hover
- border-subtle
- border-strong
- text-primary
- text-secondary
- text-muted
- text-disabled
- accent-primary
- accent-warning
- accent-danger
- signal-positive
- signal-negative
- signal-neutral

特に、薄い白色テキストは全面的に見直し、通常テキストは十分なコントラストを確保してください。

### Typography
- font-family
- page-title
- section-title
- card-title
- body
- caption
- label
- data-value
- button-label

各項目に以下を指定してください。

- font-size
- font-weight
- line-height
- letter-spacing
- color token

### Spacing / Layout
- 4pxまたは8pxベースのspacing scale
- card padding
- section gap
- button gap
- tooltip padding
- panel width
- sidebar width
- header height

ミリ単位ではなく、実装可能なpx/remで指定してください。

### Interaction
- hover
- focus
- active
- disabled
- selected
- loading
- error
- empty state

各状態の見た目を定義してください。

## Phase 5: Specific Fixes

### 1. Map Entity Tooltip
現在のツールチップを、以下の条件で改善してください。

- 背景は十分に濃く、透過しすぎない
- テキストは高コントラスト
- エンティティ名、タイプ、シグナル強度、更新時刻、説明を階層化
- 重要数値は視線が止まるように強調
- tooltipのborder/shadowでマップ背景から分離
- hover時に即時表示しすぎず、微小なdelayを入れる
- マウス位置と重なりすぎない
- 画面端で見切れない
- keyboard focusでも読める
- モバイル/小画面でも破綻しない

出力には、変更前の問題点と変更後の仕様を明示してください。

### 2. Low-contrast White Text
「SIGNAL ACTIVITY BY LAYER」のような薄い白色テキストを全画面から検出し、以下を行ってください。

- 低コントラストのtext colorを洗い出す
- text-muted / text-secondary / text-primary の使い分けを再定義
- 見出し・ラベル・補足説明・非活性状態を区別する
- 単に白くするのではなく、情報階層を保つ
- 既存の雰囲気を壊さず、読みやすさを上げる
- Design Tokenに統合し、個別CSSのばらつきを減らす

### 3. Huginn Button Layout
Huginn画面を、AI analyst workbenchとして再設計してください。

特に以下を改善してください。

- クイックテンプレート
- Compare
- Web検索
- 入力欄
- 実行ボタン
- 結果表示
- 履歴/文脈
- ユーザーが次に押すべき主ボタン

改善方針。

- 最重要アクションを1つだけPrimaryにする
- Compare / Web検索 / Templateは同列に並べず、役割でグルーピングする
- クイックテンプレートは「よく使う分析開始点」として整理する
- Compareは比較分析モードとして明確化する
- Web検索は補助情報取得として配置する
- 入力欄周辺に操作を集約し、視線移動を減らす
- 不要なボタン乱立を避ける
- keyboard shortcut / command palette化できるものは候補として出す

## Phase 6: Implementation Plan
実装前に、以下の形式で計画を出してください。

- 変更対象ファイル
- 変更対象コンポーネント
- 変更するDesign Token
- 変更するUI状態
- 破壊リスク
- テスト方法
- rollback方法

その後、ファンドマネージャー視点で計画をレビューし、100点に近づけるために修正してから実装してください。

## Phase 7: Implementation
計画に従って、実際にコードを修正してください。

実装ルール。

- 既存の設計思想を壊さない
- 変更は最小限かつ効果最大にする
- Design Token化できるものは個別指定しない
- magic numberを乱発しない
- コンポーネントの責務を肥大化させない
- 型安全性を維持する
- 不要な依存ライブラリを追加しない
- 既存テストがある場合は壊さない

## Phase 8: Verification
最後に以下を必ず確認してください。

- lint
- typecheck
- build
- 主要画面の表示確認
- hover tooltipの確認
- keyboard focus確認
- dark UIでの文字可読性確認
- Huginnの操作導線確認
- 低コントラスト文字の残存確認
- スクリーンショット差分が取れる場合は確認

可能であれば、簡易的なcontrast checkも実施してください。

## Output Format

最終出力は以下の順番にしてください。

1. 結論
2. 採用したUI/UX設計方針
3. ファンドマネージャー視点の主な不満
4. 3案比較と採用理由
5. Design Token変更内容
6. 具体的な修正内容
7. 実装したファイル一覧
8. 検証結果
9. 残課題

# Important
内部の詳細な思考過程は出力しないでください。
代わりに、意思決定の要点・検証結果・採用理由だけを簡潔に出してください。
```
