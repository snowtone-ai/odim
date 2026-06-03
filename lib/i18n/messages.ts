export const locales = ["en", "ja"] as const;
export type Locale = (typeof locales)[number];

export const messages = {
  en: {
    common: {
      live: "Live · Source-backed",
      errorBoundary: {
        title: "Dashboard error",
        message: "The current view failed to render.",
        retry: "Retry"
      }
    },
    shell: {
      productCategory: "Reality Intelligence OS",
      nav: {
        map: "Reality Map",
        entity: "Entity Intelligence",
        alerts: "Signal Alerts",
        huginn: "Huginn",
        settings: "Settings"
      },
      commandPalette: {
        hint: "Search entities, alerts, settings…",
        entities: "Entities",
        alerts: "Alerts",
        settings: "Settings"
      }
    },
    layers: ["Energy", "Cash", "Land", "Compute", "Water", "Raw Materials", "Logistics"],
    screens: {
      map: {
        title: "Reality Map",
        panels: {
          globe: "Substrate Map",
          layers: "Substrate Layers",
          liveFeed: "Live Signal Feed"
        },
        globeNote: "Zoom to explore substrate signals from macro to parcel level",
        searchHint: "Search entities…",
        tooltip: {
          activeSignals: "Active Signals",
          topEntity: "Top Entity",
          gap: "Reality Gap",
          capital: "Capital (30d)"
        },
        filters: {
          label: "Filters",
          timeRange: "Time Range",
          confidence: "Confidence",
          "7d": "7d",
          "30d": "30d",
          "90d": "90d",
          "1y": "1y",
          all: "All",
          newBadge: "New"
        },
        alertOverlay: "Alerts"
      },
      entity: {
        title: "Entity Intelligence",
        panels: {
          entities: "Entities",
          links: "Ontology Links"
        },
        metrics: {
          score: "Reality Score",
          committed: "Committed",
          leadTime: "Lead Time"
        },
        timeline: "Capital Commitment Timeline",
        filterAll: "All",
        filterWatched: "Watched",
        dailyBrief: "Daily Brief",
        narrativeGap: "Narrative–Reality Gap",
        search: "Search entities…",
        sortBy: "Sort by",
        sortScore: "Score",
        sortGap: "Gap",
        sortConfidence: "Confidence",
        sortName: "Name",
        cascadeMap: "Cascade",
        cascadeMapTitle: "3-Level Cascade Map",
        lowCoverage: "Low Cov.",
        cascadeClose: "Close",
        evidenceGraph: "Evidence Graph",
        evidencePaths: "paths",
        citationCoverage: "citation",
        traceCompleteness: "trace"
      },
      alerts: {
        title: "Signal Alerts",
        panels: {
          queue: "Alert Queue",
          chain: "Signal Chain",
          watchtower: "Watchtower Workflows"
        },
        markAllRead: "Mark all read",
        unread: "Unread",
        viewList: "List",
        viewGrouped: "Grouped",
        watchtower: {
          title: "Agentic Watchtower",
          playbooks: "Playbooks",
          runs: "Runs",
          approvals: "Approvals",
          start: "Start",
          approve: "Approve",
          reject: "Reject",
          rerun: "Re-run",
          citations: "Citations",
          trace: "Trace",
          cost: "Tokens",
          risks: "Risks"
        }
      },
      huginn: {
        title: "Huginn",
        panels: {
          dialogue: "Dialogue",
          trace: "Reasoning Trace",
          evidence: "Evidence Paths",
          munin: "Munin",
          sources: "Sources",
          eval: "Answer Eval"
        },
        prompt: "Which entities are committing capital before narrative confirmation?",
        traceNote: "Trace covers org scope, Munin retrieval, ontology context, and source attachment.",
        memoryRecords: "org memory records",
        input: {
          hint: "Ask Huginn…",
          submit: "Ask",
          thinking: "Thinking…",
          prompt: ""
        },
        badges: {
          reality: "Reality evidence",
          narrative: "Contrast only"
        },
        cascadeLayers: {
          munin_core: "Layer 1 · Core Munin",
          munin_archival: "Layer 1 · Archival Munin",
          odim_cache: "Layer 2 · Odim Cache",
          evidence_graph: "Layer 2B · Evidence Graph",
          reality_gapfill: "Layer 3A · Reality Gapfill",
          narrative_capture: "Narrative Capture",
          opinion_search: "Opinion Search",
          precomputed: "Sleep-time Cache"
        },
        eval: {
          rating: "Rating",
          note: "Evaluation note",
          submit: "Submit eval",
          sent: "Eval saved",
          error: "Eval request failed"
        },
        emptyState: "Ask Huginn a question to begin intelligence analysis.",
        showOnMap: "Show on Map",
        webSearch: "Web Search",
        presets: "Quick Templates",
        presetHint: "Fill input with a preset query",
        recentQueries: "Recent Queries",
        clearHistory: "Clear History"
      },
      settings: {
        title: "Settings",
        panels: {
          alertRules: "Alert Rules",
          watchtower: "Watchtower Workflows",
          apiKeys: "API Keys",
          permissions: "Team Permissions",
          ontology: "Ontology Explorer",
          customKnowledge: "Huginn Custom Knowledge",
          auditLog: "Audit Trail"
        },
        copy: {
          alertRules: "Watchlist, layer, and confidence thresholds backed by deterministic alert evidence.",
          watchtower: "Approval-gated agentic workflows with source coverage, trace completeness, and external dispatch controls.",
          apiKeys: "External AI agent access uses org-scoped API routes, extendable to MCP.",
          permissions: "Org roles: analyst / admin.",
          ontology: "Advanced object, link, and action type inspection.",
          customKnowledge: "Source-backed facts and separated opinions that directly inform Huginn's analysis.",
          ingestion: "Scheduled scrape runs, backfill jobs, and source watermark tracking.",
          auditLog: "Security and action events across the organization."
        },
        seed: {
          fact: "Fact",
          opinion: "Opinion",
          create: "Create",
          edit: "Edit",
          delete: "Retire",
          save: "Save",
          cancel: "Cancel",
          content: "Add a source-backed fact or separated opinion to Huginn's knowledge base",
          empty: "No active knowledge entries.",
          error: "Knowledge request failed"
        },
        language: {
          panel: "Language",
          description: "Interface language for all screens."
        },
        sourceHealth: {
          title: "Data Source Health",
          colSource: "Source",
          colLastSuccess: "Last Success",
          colSignals: "Signals",
          colStatus: "Status",
          statusHealthy: "Healthy",
          statusStale: "Stale",
          statusFailing: "Failing"
        },
        alertRuleBuilder: {
          addRule: "Add Rule",
          editRule: "Edit",
          save: "Save",
          cancel: "Cancel",
          labelName: "Name",
          labelLayer: "Layer",
          labelMinConf: "Min Confidence",
          labelPriority: "Priority",
          labelDestination: "Destination",
          labelEnabled: "Enabled",
          deleteRule: "Delete"
        },
        webhook: {
          title: "Slack Webhook",
          configured: "Webhook configured",
          notConfigured: "Webhook not configured (set SLACK_WEBHOOK_URL)",
          testButton: "Send Test",
          testSuccess: "Test sent",
          testFailed: "Test failed",
          minPriority: "Min priority"
        },
        watchtower: {
          title: "Agentic Watchtower",
          playbooks: "Playbooks",
          runs: "Runs",
          approvals: "Approvals",
          start: "Start",
          approve: "Approve",
          reject: "Reject",
          rerun: "Re-run",
          citations: "Citations",
          trace: "Trace",
          cost: "Tokens",
          risks: "Risks"
        },
        huginnTemplates: {
          title: "Huginn Quick Templates",
          addNew: "Add Template",
          label: "Label",
          template: "Template",
          variables: "Variables",
          variablesHint: "Comma-separated, e.g. entity_name, sector",
          save: "Save",
          cancel: "Cancel",
          remove: "Remove",
          defaults: "Built-in Templates",
          custom: "Custom Templates",
          enabled: "Enabled",
          disabled: "Disabled",
          empty: "No custom templates. Click \"Add Template\" to create one."
        }
      }
    }
  },
  ja: {
    common: {
      live: "ライブ / 出典付き",
      errorBoundary: {
        title: "ダッシュボードエラー",
        message: "現在のビューを表示できませんでした。",
        retry: "再試行"
      }
    },
    shell: {
      productCategory: "Reality Intelligence OS",
      nav: {
        map: "リアリティマップ",
        entity: "エンティティ分析",
        alerts: "アラート",
        huginn: "Huginn",
        settings: "設定"
      },
      commandPalette: {
        hint: "エンティティ・アラート・設定を検索…",
        entities: "エンティティ",
        alerts: "アラート",
        settings: "設定"
      }
    },
    layers: ["エネルギー", "資本", "土地", "計算資源", "水", "原材料", "物流"],
    screens: {
      map: {
        title: "リアリティマップ",
        panels: {
          globe: "サブストレートマップ",
          layers: "レイヤー",
          liveFeed: "ライブフィード"
        },
        globeNote: "ズームで基盤層シグナルをマクロから用地レベルまで探索",
        searchHint: "エンティティを検索…",
        tooltip: {
          activeSignals: "アクティブシグナル",
          topEntity: "上位エンティティ",
          gap: "リアリティ乖離",
          capital: "資本（30日）"
        },
        filters: {
          label: "フィルター",
          timeRange: "期間",
          confidence: "信頼度",
          "7d": "7日",
          "30d": "30日",
          "90d": "90日",
          "1y": "1年",
          all: "全期間",
          newBadge: "新着"
        },
        alertOverlay: "アラート"
      },
      entity: {
        title: "エンティティ分析",
        panels: {
          entities: "エンティティ一覧",
          links: "関係リンク"
        },
        metrics: {
          score: "リアリティスコア",
          committed: "確定額",
          leadTime: "先行日数"
        },
        timeline: "資本コミットメント履歴",
        filterAll: "全て",
        filterWatched: "ウォッチ中",
        dailyBrief: "デイリーブリーフ",
        narrativeGap: "ナラティブ乖離",
        search: "エンティティを検索…",
        sortBy: "並び順",
        sortScore: "スコア",
        sortGap: "乖離",
        sortConfidence: "信頼度",
        sortName: "名前",
        cascadeMap: "カスケード",
        cascadeMapTitle: "3階層カスケードマップ",
        lowCoverage: "カバレッジ不足",
        cascadeClose: "閉じる",
        evidenceGraph: "根拠グラフ",
        evidencePaths: "パス",
        citationCoverage: "引用",
        traceCompleteness: "トレース"
      },
      alerts: {
        title: "アラート",
        panels: {
          queue: "アラートキュー",
          chain: "シグナルチェーン",
          watchtower: "Watchtower ワークフロー"
        },
        markAllRead: "全て既読にする",
        unread: "未読",
        viewList: "リスト",
        viewGrouped: "グループ",
        watchtower: {
          title: "Agentic Watchtower",
          playbooks: "プレイブック",
          runs: "実行",
          approvals: "承認",
          start: "開始",
          approve: "承認",
          reject: "却下",
          rerun: "再実行",
          citations: "引用",
          trace: "トレース",
          cost: "トークン",
          risks: "リスク"
        }
      },
      huginn: {
        title: "Huginn",
        panels: {
          dialogue: "対話",
          trace: "推論トレース",
          evidence: "根拠パス",
          munin: "Munin",
          sources: "出典",
          eval: "回答評価"
        },
        prompt: "ナラティブが確認される前に資本を固定しているエンティティはどれか？",
        traceNote: "組織スコープ、Munin検索、オントロジーコンテキスト、出典添付に基づく推論トレースです。",
        memoryRecords: "組織メモリ件数",
        input: {
          hint: "Huginnに質問する…",
          submit: "送信",
          thinking: "処理中…",
          prompt: ""
        },
        badges: {
          reality: "根拠あり",
          narrative: "対比のみ"
        },
        cascadeLayers: {
          munin_core: "Layer 1 · コアMunin",
          munin_archival: "Layer 1 · アーカイブMunin",
          odim_cache: "Layer 2 · Odimキャッシュ",
          evidence_graph: "Layer 2B · 根拠グラフ",
          reality_gapfill: "Layer 3A · リアリティ補完",
          narrative_capture: "ナラティブキャプチャ",
          opinion_search: "意見検索",
          precomputed: "事前計算キャッシュ"
        },
        eval: {
          rating: "評価",
          note: "評価メモ（任意）",
          submit: "評価を送信",
          sent: "保存しました",
          error: "送信に失敗しました"
        },
        emptyState: "Huginnに質問して、インテリジェンス分析を開始してください。",
        showOnMap: "マップで表示",
        webSearch: "Web検索",
        presets: "クイックテンプレート",
        presetHint: "プリセットクエリを入力に反映",
        recentQueries: "最近のクエリ",
        clearHistory: "履歴を消去"
      },
      settings: {
        title: "設定",
        panels: {
          alertRules: "アラートルール",
          watchtower: "Watchtower ワークフロー",
          apiKeys: "APIキー",
          permissions: "チーム権限",
          ontology: "オントロジー",
          customKnowledge: "Huginn カスタムナレッジ",
          auditLog: "監査ログ"
        },
        copy: {
          alertRules: "ウォッチリスト・レイヤー・信頼度のしきい値に基づくルール設定です。",
          watchtower: "出典カバレッジ、推論トレース、人間承認を必須にするエージェント型ワークフローです。",
          apiKeys: "外部AIエージェントのアクセスはAPIファーストで設計されており、MCPへの拡張にも対応しています。",
          permissions: "組織ロール：アナリスト / 管理者",
          ontology: "オブジェクト・リンク・アクションタイプの高度な検査機能です。",
          customKnowledge: "HuginnのAI分析に活用する出典付きファクトと意見シードを管理します。",
          ingestion: "スケジュール済みスクレイプ・補完ジョブ・ウォーターマークの監視です。",
          auditLog: "組織全体のセキュリティ・操作イベントです。"
        },
        seed: {
          fact: "ファクト",
          opinion: "意見",
          create: "作成",
          edit: "編集",
          delete: "削除",
          save: "保存",
          cancel: "キャンセル",
          content: "出典付きのファクト、または意見をHuginnのナレッジベースに追加してください",
          empty: "ナレッジがありません。",
          error: "ナレッジ操作に失敗しました"
        },
        language: {
          panel: "言語設定",
          description: "全画面の表示言語を切り替えます。"
        },
        sourceHealth: {
          title: "データソース状態",
          colSource: "ソース",
          colLastSuccess: "最終成功",
          colSignals: "シグナル数",
          colStatus: "状態",
          statusHealthy: "正常",
          statusStale: "遅延",
          statusFailing: "失敗"
        },
        alertRuleBuilder: {
          addRule: "ルール追加",
          editRule: "編集",
          save: "保存",
          cancel: "キャンセル",
          labelName: "名前",
          labelLayer: "レイヤー",
          labelMinConf: "最低信頼度",
          labelPriority: "優先度",
          labelDestination: "送信先",
          labelEnabled: "有効",
          deleteRule: "削除"
        },
        webhook: {
          title: "Slack Webhook",
          configured: "Webhook設定済み",
          notConfigured: "Webhook未設定（SLACK_WEBHOOK_URL を設定してください）",
          testButton: "テスト送信",
          testSuccess: "テスト送信完了",
          testFailed: "テスト失敗",
          minPriority: "最低優先度"
        },
        watchtower: {
          title: "Agentic Watchtower",
          playbooks: "プレイブック",
          runs: "実行",
          approvals: "承認",
          start: "開始",
          approve: "承認",
          reject: "却下",
          rerun: "再実行",
          citations: "引用",
          trace: "トレース",
          cost: "トークン",
          risks: "リスク"
        },
        huginnTemplates: {
          title: "Huginn クイックテンプレート",
          addNew: "テンプレート追加",
          label: "ラベル",
          template: "テンプレート",
          variables: "変数",
          variablesHint: "カンマ区切り（例: entity_name, sector）",
          save: "保存",
          cancel: "キャンセル",
          remove: "削除",
          defaults: "組み込みテンプレート",
          custom: "カスタムテンプレート",
          enabled: "有効",
          disabled: "無効",
          empty: "カスタムテンプレートがありません。「テンプレート追加」で作成してください。"
        }
      }
    }
  }
} as const;

export type Messages = (typeof messages)[Locale];

export function resolveLocale(value?: string | null): Locale {
  return value === "ja" ? "ja" : "en";
}

export function getMessages(locale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE): Messages {
  return messages[resolveLocale(locale)];
}
