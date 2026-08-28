export const locales = ["en", "ja"] as const;
export type Locale = (typeof locales)[number];

export const messages = {
  en: {
    common: {
      live: "Live · Source-backed",
      loadingWorkspace: "Loading workspace",
      errorBoundary: {
        title: "Dashboard error",
        message: "The current view failed to render.",
        retry: "Retry",
        stateError: "State / Error"
      },
      public: {
        home: "Home",
        apiDocs: "API Docs",
        terms: "Terms",
        privacy: "Privacy",
        security: "Security",
        signIn: "Sign in",
        createWorkspace: "Create workspace",
        headerNavigation: "Public navigation",
        footerNavigation: "Public pages",
        homeAria: "Odim home",
        tagline: "Source-backed intelligence for the physical economy.",
        recordLabel: "ODIM / PUBLIC RECORD",
        authFlow: "Source → entity → action",
        apiReference: "API Reference",
        termsTitle: "Terms of Service",
        privacyTitle: "Privacy Policy"
      },
      landing: {
        headerNavigation: "Landing navigation",
        evidenceAria: "How Odim connects evidence",
        sourceCoverage: "Source coverage",
        configuredPaths: "Configured source paths",
        footer: "Footer",
        eyebrow: "CAPITAL FIXATION / REALITY INTELLIGENCE",
        title: "Find the commitments hiding in plain sight.",
        description: "Odim connects public records across the physical economy so analysts can move from an early change to a source-verifiable investment view before the narrative catches up.",
        openConsole: "Open the console",
        createWorkspace: "Create a workspace",
        noForecasts: "No price forecasts. No opaque score without a path back to its source.",
        evidenceThread: "THE EVIDENCE THREAD",
        sourceAction: "SOURCE → ACTION",
        observedLayers: "OBSERVED LAYERS",
        sourceRegistry: "SOURCE REGISTRY",
        primaryPaths: "12 PRIMARY PATHS",
        layers: ["Energy", "Capital", "Minerals", "Compute", "Water", "Materials", "Logistics"],
        coverageNote: "Coverage is transparent by source and freshness state. A configured feed is not presented as live until the ingestion path verifies it.",
        nextStep: "START WITH A CHANGE",
        nextText: "See the map, follow one thread, and decide whether the signal belongs in your view.",
        footerNote: "Odim is not a price prediction product. Narrative data is never treated as truth.",
        steps: [
          { label: "Source", detail: "A filing, permit, queue entry, or procurement record changes." },
          { label: "Entity", detail: "The record resolves to a company, project, location, or counterparty." },
          { label: "Signal", detail: "Related records become one confidence-scored change to review." },
          { label: "Action", detail: "Inspect the evidence path, save the case, or ask Huginn a grounded question." }
        ]
      }
    },
    shell: {
      productCategory: "現実分析OS",
      nav: {
        map: "Reality Map",
        entity: "Entity Intelligence",
        alerts: "Signal Alerts",
        huginn: "Huginn",
        settings: "Settings"
      },
      mobileNav: {
        map: "Map",
        entity: "Entities",
        alerts: "Alerts",
        huginn: "Huginn",
        settings: "More"
      },
      commandPalette: {
        hint: "Search entities, alerts, settings…",
        entities: "Entities",
        alerts: "Alerts",
        settings: "Settings",
        noResults: "No results for"
      },
      frame: {
        railLabel: "Workspace navigation",
        railNavLabel: "Primary workspace routes",
        languageLabel: "Interface language",
        commandLabel: "Search workspace",
        fixtureStatus: "Fixture data · not live",
        unreadAlerts: "unread alerts",
        workspaceNote: "Source → entity → signal → action",
        threadLabel: "Evidence Thread",
        thread: {
          source: "Source",
          entity: "Entity",
          signal: "Signal",
          action: "Action"
        }
      },
      keyboard: {
        label: "Keyboard shortcuts",
        close: "Close keyboard shortcuts",
        map: "Map",
        entity: "Entity",
        alerts: "Alerts",
        huginn: "Huginn",
        settings: "Settings",
        commandPalette: "Command palette",
        focusSearch: "Focus search",
        navigateList: "Navigate list",
        openSelected: "Open selected",
        export: "Export",
        refresh: "Refresh",
        dismiss: "Close / dismiss"
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
      custom: {
        noDashboard: "No dashboard configured.",
        eyebrow: "Custom workspace",
        description: "Arrange evidence surfaces for a repeatable operating view.",
        fixtureWorkspace: "Fixture workspace · browser local",
        savedDashboards: "Saved dashboards",
        finishLayout: "Finish layout",
        editLayout: "Edit layout",
        duplicate: "Duplicate",
        editingStatus: "Layout editing · drag a surface to reposition",
        readOnlySuffix: "surfaces · read-only arrangement",
        addSurface: "Add workspace surface",
        buildTools: "Build tools",
        canvas: "Dashboard canvas",
        canvasColumns: "Canvas / 12 columns",
        sourceObjectSignal: "source → object → signal",
        widgetSurface: "surface",
        remove: "Remove",
        canvasEmpty: "Canvas is empty.",
        canvasEmptyHint: "Enter layout editing to add an evidence surface.",
        widgets: {
          entityList: { label: "Entities", hint: "ranked objects" },
          alertQueue: { label: "Alerts", hint: "unread signals" },
          mapMini: { label: "Map", hint: "geographic context" },
          sparklineGrid: { label: "Sparklines", hint: "score movement" },
          dailyDiff: { label: "Daily diff", hint: "new evidence" },
          sectorRotation: { label: "Sector rotation", hint: "layer activity" },
          sourceHealth: { label: "Source health", hint: "freshness" },
          huginnMini: { label: "Huginn", hint: "briefing prompt" }
        },
        widgetBody: {
          mapMini: "Geo drill · hotspot overlay",
          huginnMini: "Template query surface for quick morning briefs."
        }
      },
      settings: {
        title: "Settings",
        panels: {
          gettingStarted: "Getting Started",
          alertRules: "Alert Rules",
          watchtower: "Watchtower Workflows",
          billing: "Plan & Billing",
          apiKeys: "API Keys",
          permissions: "Team Permissions",
          ontology: "Ontology Explorer",
          customKnowledge: "Huginn Custom Knowledge",
          auditLog: "Audit Trail"
        },
        copy: {
          gettingStarted: "First-run checklist for a new workspace.",
          alertRules: "Watchlist, layer, and confidence thresholds backed by deterministic alert evidence.",
          watchtower: "Approval-gated agentic workflows with source coverage, trace completeness, and external dispatch controls.",
          billing: "Subscription plan, entitlements, and Stripe-backed upgrades.",
          apiKeys: "External AI agent access uses org-scoped API routes, extendable to MCP.",
          permissions: "Org roles: analyst / admin. Invite teammates by email.",
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
          error: "Knowledge request failed",
          knowledgeType: "Knowledge type",
          attachFile: "Attach file",
          fileTooLarge: "The file must be 100 KB or smaller."
        },
        language: {
          panel: "Language",
          description: "Interface language for all screens."
        },
        gettingStarted: {
          stepApiKey: "Issue an API key for programmatic and agent access",
          stepInvite: "Invite your team",
          stepAlertRule: "Configure an alert rule",
          stepHuginn: "Run your first Huginn query",
          done: "done",
          open: "open"
        },
        apiKeyManager: {
          heading: "hashed keys / one-time token issue",
          name: "Key name",
          namePlaceholder: "e.g. Trading Desk Agent",
          scopes: "Scopes",
          issue: "Issue Key",
          revoke: "Revoke",
          tokenNotice: "Copy this key now — it is shown only once.",
          copy: "Copy",
          copied: "Copied",
          failed: "Key request failed",
          empty: "No active API keys.",
          notice: "Keys are limited to this workspace. A new secret is displayed only once."
        },
        membersPanel: {
          invite: "Invite",
          emailPlaceholder: "teammate@company.com",
          roleAnalyst: "Analyst",
          roleAdmin: "Admin",
          pending: "Pending invites",
          revoke: "Revoke",
          linkNotice: "Share this invite link — it is shown only once.",
          copy: "Copy",
          copied: "Copied",
          failed: "Invite request failed",
          noPending: "No pending invites.",
          expires: "expires",
          noMembers: "No members yet.",
          role: "Role"
        },
        billing: {
          currentPlan: "Current plan",
          status: "Status",
          periodEnd: "Renews",
          upgradePro: "Upgrade to Pro",
          upgradeEnterprise: "Upgrade to Enterprise",
          notEnabled: "Billing not enabled in this environment — all features unlocked",
          checkoutFailed: "Checkout failed",
          planNames: { trial: "Trial", pro: "Pro", enterprise: "Enterprise" },
          statusNames: { trialing: "Trialing", active: "Active", pastDue: "Past due", canceled: "Canceled" }
        },
        sourceHealth: {
          title: "Data Source Health",
          colSource: "Source",
          colLastSuccess: "Last Success",
          colSignals: "Signals",
          colStatus: "Status",
          colState: "State",
          statusHealthy: "Healthy",
          statusStale: "Stale",
          statusFailing: "Failing",
          statusConfigured: "Configured",
          statusLiveVerified: "Live verified",
          statusFixtureOnly: "Fixture only",
          statusSkipped: "Skipped",
          statusFailed: "Failed",
          empty: "No source status has been recorded.",
          contribution: "Top source contribution",
          alertCount: "alerts",
          observed: "Observed",
          sinceUpdate: "since update"
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
          deleteRule: "Delete",
          empty: "No alert rules yet.",
          layerAny: "Any layer",
          layerEnergy: "Energy",
          layerCapital: "Capital",
          layerLand: "Land",
          layerCompute: "Compute",
          layerWater: "Water",
          layerRawMaterials: "Raw materials",
          layerLogistics: "Logistics",
          destinationDashboard: "Odim",
          destinationSlack: "Slack",
          destinationBoth: "Odim and Slack",
          priorityCritical: "Critical",
          priorityHigh: "High",
          priorityMedium: "Medium",
          priorityLow: "Low",
          stateOn: "On",
          stateOff: "Off",
          nameRequired: "Enter a rule name.",
          updated: "Rule updated.",
          added: "Rule added.",
          deleted: "Rule deleted.",
          paused: "Rule paused.",
          enabledFeedback: "Rule enabled.",
          saveFailed: "The rule could not be saved.",
          deleteFailed: "The rule could not be deleted.",
          toggleFailed: "The rule state could not be changed."
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
          risks: "Risks",
          working: "Working…",
          noSelection: "Select a workflow run to review it.",
          noPlaybooks: "No playbooks are configured for this workspace.",
          noRuns: "No Watchtower runs yet.",
          executionTrace: "Execution trace",
          noTrace: "No trace steps were returned.",
          sourceCoverage: "Source coverage",
          noSources: "No source references are attached to this run.",
          view: "View",
          requestFailed: "The Watchtower request could not be completed."
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
          empty: "No custom templates. Click \"Add Template\" to create one.",
          edit: "Edit",
          labelPlaceholder: "e.g. Weekly sector review",
          templatePlaceholder: "e.g. Analyze this week's capital investment signals for {sector}."
        }
      }
    }
  },
  ja: {
    common: {
      live: "実データ / 出典付き",
      loadingWorkspace: "ワークスペースを読み込み中",
      errorBoundary: {
        title: "分析画面のエラー",
        message: "現在のビューを表示できませんでした。",
        retry: "再試行",
        stateError: "状態 / エラー"
      },
      public: {
        home: "ホーム",
        apiDocs: "API仕様",
        terms: "利用規約",
        privacy: "プライバシー",
        security: "セキュリティ",
        signIn: "サインイン",
        createWorkspace: "ワークスペースを作成",
        headerNavigation: "公開ページのナビゲーション",
        footerNavigation: "公開ページ",
        homeAria: "Odimホーム",
        tagline: "公開情報を根拠に、現実の経済を読み解く。",
        recordLabel: "ODIM / 公開記録",
        authFlow: "出典 → 対象 → 対応",
        apiReference: "API仕様",
        termsTitle: "利用規約",
        privacyTitle: "プライバシーポリシー"
      },
      landing: {
        headerNavigation: "トップページのナビゲーション",
        evidenceAria: "Odimが根拠をつなぐ流れ",
        sourceCoverage: "情報源の網羅状況",
        configuredPaths: "設定済みの情報源",
        footer: "フッター",
        eyebrow: "資本の動き / 現実分析",
        title: "見過ごされている投資の動きを見つける。",
        description: "Odimは現実の経済に関する公開記録をつなぎ、初期の変化から、出典で確かめられる投資判断までを、報道が追いつく前に追えるようにします。",
        openConsole: "分析画面を開く",
        createWorkspace: "ワークスペースを作成",
        noForecasts: "価格予測はしません。根拠に戻れない不透明な評価値も提示しません。",
        evidenceThread: "根拠の流れ",
        sourceAction: "出典 → 対応",
        observedLayers: "観測対象の層",
        sourceRegistry: "情報源一覧",
        primaryPaths: "12の主要経路",
        layers: ["エネルギー", "資本", "鉱物", "計算資源", "水", "素材", "物流"],
        coverageNote: "情報源ごとの取得範囲と更新状態を公開します。実際の取得を確認するまで、設定済みの情報源を実データとは表示しません。",
        nextStep: "変化から始める",
        nextText: "現実の動きを開き、ひとつの根拠の流れを追い、その兆候を自分の判断材料に加えるか決めましょう。",
        footerNote: "Odimは価格予測サービスではありません。報道情報を真実として扱うこともありません。",
        steps: [
          { label: "出典", detail: "届出、許認可、接続待ち案件、調達記録などに変化が起きます。" },
          { label: "対象", detail: "記録を企業、プロジェクト、場所、取引相手に結び付けます。" },
          { label: "兆候", detail: "関連する記録を、信頼度を付けたひとつの変化として確認できます。" },
          { label: "対応", detail: "根拠の経路を調べ、案件を保存し、根拠に基づく質問をHuginnに送れます。" }
        ]
      }
    },
    shell: {
      productCategory: "現実分析OS",
      nav: {
        map: "現実の動き",
        entity: "対象分析",
        alerts: "通知",
        huginn: "Huginn",
        settings: "設定"
      },
      mobileNav: {
        map: "マップ",
        entity: "対象",
        alerts: "通知",
        huginn: "Huginn",
        settings: "その他"
      },
      commandPalette: {
        hint: "対象・通知・設定を検索…",
        entities: "対象",
        alerts: "通知",
        settings: "設定",
        noResults: "該当なし"
      },
      frame: {
        railLabel: "ワークスペースナビゲーション",
        railNavLabel: "主要ワークスペースルート",
        languageLabel: "表示言語",
        commandLabel: "ワークスペースを検索",
        fixtureStatus: "サンプルデータ（実データではありません）",
        unreadAlerts: "件の未読通知",
        workspaceNote: "出典 → 対象 → 兆候 → 対応",
        threadLabel: "根拠の流れ",
        thread: {
          source: "出典",
          entity: "対象",
          signal: "兆候",
          action: "対応"
        }
      },
      keyboard: {
        label: "キーボードショートカット",
        close: "キーボードショートカットを閉じる",
        map: "マップ",
        entity: "対象",
        alerts: "通知",
        huginn: "Huginn",
        settings: "設定",
        commandPalette: "コマンドパレット",
        focusSearch: "検索欄に移動",
        navigateList: "一覧を移動",
        openSelected: "選択項目を開く",
        export: "エクスポート",
        refresh: "更新",
        dismiss: "閉じる / 消去"
      }
    },
    layers: ["エネルギー", "資本", "土地", "計算資源", "水", "原材料", "物流"],
    screens: {
      map: {
        title: "現実の動き",
        panels: {
          globe: "基盤の地図",
          layers: "対象の層",
          liveFeed: "最新の兆候"
        },
        globeNote: "ズームして、基盤層の兆候を全体から用地レベルまで探します",
        searchHint: "対象を検索…",
        tooltip: {
          activeSignals: "注目の兆候",
          topEntity: "主な対象",
          gap: "現実との乖離",
          capital: "資本（30日）"
        },
        filters: {
          label: "絞り込み",
          timeRange: "期間",
          confidence: "信頼度",
          "7d": "7日",
          "30d": "30日",
          "90d": "90日",
          "1y": "1年",
          all: "全期間",
          newBadge: "新着"
        },
        alertOverlay: "通知"
      },
      entity: {
        title: "対象分析",
        panels: {
          entities: "対象一覧",
          links: "関連"
        },
        metrics: {
          score: "現実度",
          committed: "確定額",
          leadTime: "先行日数"
        },
        timeline: "資本の確定履歴",
        filterAll: "全て",
        filterWatched: "監視中",
        dailyBrief: "日次概要",
        narrativeGap: "報道と実態の乖離",
        search: "対象を検索…",
        sortBy: "並び順",
        sortScore: "評価値",
        sortGap: "乖離",
        sortConfidence: "信頼度",
        sortName: "名前",
        cascadeMap: "連鎖",
          cascadeMapTitle: "3階層の連鎖図",
        lowCoverage: "網羅率不足",
        cascadeClose: "閉じる",
        evidenceGraph: "根拠のつながり",
        evidencePaths: "根拠までの経路",
        citationCoverage: "出典の網羅率",
        traceCompleteness: "処理記録の完全性"
      },
      alerts: {
        title: "通知",
        panels: {
          queue: "通知一覧",
          chain: "兆候の連鎖",
          watchtower: "Watchtowerの監視手順"
        },
        markAllRead: "全て既読にする",
        unread: "未読",
        viewList: "リスト",
        viewGrouped: "グループ",
        watchtower: {
          title: "自動監視 Watchtower",
          playbooks: "監視手順",
          runs: "実行",
          approvals: "承認",
          start: "開始",
          approve: "承認",
          reject: "却下",
          rerun: "再実行",
          citations: "引用",
          trace: "処理記録",
          cost: "利用量",
          risks: "リスク"
        }
      },
      huginn: {
        title: "Huginn",
        panels: {
          dialogue: "対話",
          trace: "推論の経路",
          evidence: "根拠の経路",
          munin: "Munin",
          sources: "出典",
          eval: "回答評価"
        },
        prompt: "報道で確認される前に資本を固定している対象はどれか？",
        traceNote: "組織の範囲、Munin検索、データ構造の文脈、出典の添付に基づく推論の経路です。",
        memoryRecords: "組織の記録件数",
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
          munin_core: "第1層 · コアMunin",
          munin_archival: "第1層 · アーカイブMunin",
          odim_cache: "第2層 · Odimキャッシュ",
          evidence_graph: "第2層B · 根拠のつながり",
          reality_gapfill: "第3層A · 現実の補完",
          narrative_capture: "報道の取り込み",
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
        emptyState: "Huginnに質問して、分析を始めてください。",
        showOnMap: "地図で表示",
        webSearch: "ウェブ検索",
        presets: "すぐ使える質問例",
        presetHint: "質問例を入力欄に反映",
        recentQueries: "最近の質問",
        clearHistory: "履歴を消去"
      },
      custom: {
        noDashboard: "分析画面が設定されていません。",
        eyebrow: "分析画面の編集",
        description: "根拠を表示する画面を並べ替え、繰り返し使える分析画面を作ります。",
        fixtureWorkspace: "サンプルのワークスペース（ブラウザ内）",
        savedDashboards: "保存した分析画面",
        finishLayout: "配置を完了",
        editLayout: "配置を編集",
        duplicate: "複製",
        editingStatus: "配置を編集中・表示面をドラッグして移動できます",
        readOnlySuffix: "面・読み取り専用の配置",
        addSurface: "表示面を追加",
        buildTools: "作成ツール",
        canvas: "分析画面の編集領域",
        canvasColumns: "編集領域 / 12列",
        sourceObjectSignal: "出典 → 対象 → 兆候",
        widgetSurface: "表示面",
        remove: "削除",
        canvasEmpty: "編集領域は空です。",
        canvasEmptyHint: "配置の編集を開始して、根拠の表示面を追加してください。",
        widgets: {
          entityList: { label: "対象", hint: "評価値順の一覧" },
          alertQueue: { label: "通知", hint: "未読の兆候" },
          mapMini: { label: "地図", hint: "地域の状況" },
          sparklineGrid: { label: "推移", hint: "評価値の変化" },
          dailyDiff: { label: "日次差分", hint: "新しい根拠" },
          sectorRotation: { label: "分野の動き", hint: "層ごとの活動" },
          sourceHealth: { label: "情報源の状態", hint: "更新状況" },
          huginnMini: { label: "Huginn", hint: "質問例" }
        },
        widgetBody: {
          mapMini: "地域の詳細・注目地点",
          huginnMini: "朝の確認に使う質問例。"
        }
      },
      settings: {
        title: "設定",
        panels: {
          gettingStarted: "はじめに",
          alertRules: "通知ルール",
          watchtower: "Watchtowerの監視手順",
          billing: "プランと課金",
          apiKeys: "APIキー",
          permissions: "メンバーと権限",
          ontology: "オントロジー",
          customKnowledge: "Huginnの参照知識",
          auditLog: "操作履歴"
        },
        copy: {
          gettingStarted: "利用を始めるために必要な設定を確認します。",
          alertRules: "通知する対象と、通知に必要な信頼度を設定します。",
          watchtower: "情報源と処理内容を確認し、人の承認を経て動く監視手順を管理します。",
          billing: "現在のプランと利用状況を確認し、必要に応じて変更します。",
          apiKeys: "このワークスペースに外部ツールを接続するためのAPIキーを管理します。",
          permissions: "メンバーを招待し、分析担当者または管理者の権限を割り当てます。",
          ontology: "企業・組織、関係、操作のデータ構造を確認します。",
          customKnowledge: "Huginnが分析に使う、情報源を確認できる事実と明示的な見解を管理します。",
          ingestion: "情報収集の実行状況と、情報源ごとの最終更新を確認します。",
          auditLog: "このワークスペースで行われた安全性に関わる操作を確認します。"
        },
        seed: {
          fact: "事実",
          opinion: "意見",
          create: "作成",
          edit: "編集",
          delete: "削除",
          save: "保存",
          cancel: "キャンセル",
          content: "Huginnが参照する事実または見解を入力してください",
          empty: "登録された知識はありません。",
          error: "知識を更新できませんでした。",
          knowledgeType: "知識の種類",
          attachFile: "ファイルを添付",
          fileTooLarge: "ファイルは100 KB以下にしてください。"
        },
        language: {
          panel: "言語設定",
          description: "全画面の表示言語を切り替えます。"
        },
        gettingStarted: {
          stepApiKey: "外部ツール用のAPIキーを発行",
          stepInvite: "チームを招待",
          stepAlertRule: "通知ルールを設定",
          stepHuginn: "Huginnで最初の質問を送信",
          done: "完了",
          open: "開く"
        },
        apiKeyManager: {
          heading: "発行済みのAPIキー",
          name: "キー名",
          namePlaceholder: "例：調査チームの連携ツール",
          scopes: "許可する操作",
          issue: "キーを発行",
          revoke: "失効",
          tokenNotice: "このキーは一度しか表示されません。今すぐコピーしてください。",
          copy: "コピー",
          copied: "コピー済み",
          failed: "キー操作に失敗しました",
          empty: "有効なAPIキーはありません。",
          notice: "APIキーはこのワークスペースでのみ使えます。秘密鍵は発行時に一度だけ表示されます。"
        },
        membersPanel: {
          invite: "招待",
          emailPlaceholder: "teammate@company.com",
          roleAnalyst: "分析担当者",
          roleAdmin: "管理者",
          pending: "保留中の招待",
          revoke: "取消",
          linkNotice: "この招待リンクは一度しか表示されません。共有してください。",
          copy: "コピー",
          copied: "コピー済み",
          failed: "招待に失敗しました",
          noPending: "保留中の招待はありません。",
          expires: "期限",
          noMembers: "メンバーはまだいません。",
          role: "権限"
        },
        billing: {
          currentPlan: "現在のプラン",
          status: "状態",
          periodEnd: "更新日",
          upgradePro: "Proにアップグレード",
          upgradeEnterprise: "Enterpriseにアップグレード",
          notEnabled: "この環境では課金されません。すべての機能を利用できます。",
          checkoutFailed: "購入手続きを開始できませんでした",
          planNames: { trial: "試用版", pro: "Pro", enterprise: "Enterprise" },
          statusNames: { trialing: "試用中", active: "利用中", pastDue: "支払い遅延", canceled: "解約済み" }
        },
        sourceHealth: {
          title: "情報源の状態",
          colSource: "情報源",
          colLastSuccess: "最終成功",
          colSignals: "取得件数",
          colStatus: "状態",
          colState: "確認状態",
          statusHealthy: "正常",
          statusStale: "遅延",
          statusFailing: "失敗",
          statusConfigured: "設定済み",
          statusLiveVerified: "実データを確認済み",
          statusFixtureOnly: "サンプルデータのみ",
          statusSkipped: "対象外",
          statusFailed: "失敗",
          empty: "情報源の状態はまだ記録されていません。",
          contribution: "アラートへの寄与が大きい情報源",
          alertCount: "件のアラート",
          observed: "最終観測",
          sinceUpdate: "更新から経過"
        },
        alertRuleBuilder: {
          addRule: "ルールを追加",
          editRule: "編集",
          save: "保存",
          cancel: "キャンセル",
          labelName: "名前",
          labelLayer: "対象分野",
          labelMinConf: "最低信頼度",
          labelPriority: "優先度",
          labelDestination: "通知先",
          labelEnabled: "有効",
          deleteRule: "削除",
          empty: "通知ルールはまだありません。",
          layerAny: "すべての分野",
          layerEnergy: "エネルギー",
          layerCapital: "資本",
          layerLand: "土地",
          layerCompute: "計算資源",
          layerWater: "水",
          layerRawMaterials: "原材料",
          layerLogistics: "物流",
          destinationDashboard: "Odim",
          destinationSlack: "Slack",
          destinationBoth: "OdimとSlack",
          priorityCritical: "緊急",
          priorityHigh: "高",
          priorityMedium: "中",
          priorityLow: "低",
          stateOn: "有効",
          stateOff: "停止中",
          nameRequired: "ルール名を入力してください。",
          updated: "ルールを更新しました。",
          added: "ルールを追加しました。",
          deleted: "ルールを削除しました。",
          paused: "ルールを停止しました。",
          enabledFeedback: "ルールを有効にしました。",
          saveFailed: "ルールを保存できませんでした。",
          deleteFailed: "ルールを削除できませんでした。",
          toggleFailed: "ルールの状態を変更できませんでした。"
        },
        webhook: {
          title: "Slack通知",
          configured: "Webhook設定済み",
          notConfigured: "Webhook未設定（SLACK_WEBHOOK_URL を設定してください）",
          testButton: "テスト送信",
          testSuccess: "テスト送信完了",
          testFailed: "テスト失敗",
          minPriority: "最低優先度"
        },
        watchtower: {
          title: "Watchtower",
          playbooks: "監視手順",
          runs: "実行",
          approvals: "承認",
          start: "開始",
          approve: "承認",
          reject: "却下",
          rerun: "再実行",
          citations: "出典",
          trace: "処理記録",
          cost: "AI使用量",
          risks: "注意点",
          working: "処理中…",
          noSelection: "確認する実行結果を選んでください。",
          noPlaybooks: "このワークスペースに監視手順は設定されていません。",
          noRuns: "Watchtowerの実行履歴はまだありません。",
          executionTrace: "処理記録",
          noTrace: "処理内容は記録されていません。",
          sourceCoverage: "参照した情報源",
          noSources: "この実行結果に紐づく情報源はありません。",
          view: "開く",
          requestFailed: "Watchtowerの処理を完了できませんでした。"
        },
        huginnTemplates: {
          title: "Huginnの質問例",
          addNew: "質問例を追加",
          label: "ラベル",
          template: "質問文",
          variables: "差し替える項目",
          variablesHint: "カンマ区切り（例: entity_name, sector）",
          save: "保存",
          cancel: "キャンセル",
          remove: "削除",
          defaults: "標準の質問例",
          custom: "追加した質問例",
          enabled: "有効",
          disabled: "無効",
          empty: "追加した質問例はありません。「質問例を追加」から作成できます。",
          edit: "編集",
          labelPlaceholder: "例：業種の週間点検",
          templatePlaceholder: "例：今週の{sector}に関する設備投資の兆候を分析してください。"
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
