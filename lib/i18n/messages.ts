export const locales = ["en", "ja"] as const;
export type Locale = (typeof locales)[number];

export const messages = {
  en: {
    common: {
      live: "Live / source-backed",
      screen: "Screen",
      tracked: "tracked",
      on: "on"
    },
    shell: {
      productCategory: "Reality Intelligence OS",
      nav: {
        map: "Reality Map",
        capitalFlow: "Capital Flow",
        entity: "Entity Intelligence",
        alerts: "Signal Alerts",
        huginn: "Huginn Console",
        watchlist: "Watchlist & Briefs",
        audit: "Audit Trail",
        settings: "Settings"
      }
    },
    layers: ["Energy", "Cash", "Land", "Compute", "Water", "Raw Materials", "Logistics"],
    screens: {
      map: {
        title: "Reality Map",
        panels: {
          globe: "Capital Fixation Globe / Map",
          layers: "Reality Layers",
          liveFeed: "Live Signal Feed"
        },
        globeNote: "Macro globe transitions to parcel map at zoom threshold"
      },
      capitalFlow: {
        title: "Capital Flow",
        panels: {
          sectorHeat: "Sector Heat",
          sankey: "Entity Sankey",
          gap: "Narrative to Reality Gap"
        },
        sankeyNote: "Microsoft -> Grid -> Utility -> Data Center"
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
        timeline: "Source-backed Capital Commitment Timeline"
      },
      alerts: {
        title: "Signal Alerts",
        panels: {
          queue: "Alert Queue",
          chain: "Signal Chain"
        },
        chainSteps: ["Raw filing observed", "Entity resolution matched", "SPV confidence increased", "Alert emitted"]
      },
      huginn: {
        title: "Huginn Console",
        panels: {
          dialogue: "Dialogue",
          trace: "Reasoning Trace",
          munin: "Munin",
          sources: "Sources",
          eval: "Answer Eval"
        },
        prompt: "Which entities are committing capital before narrative confirmation?",
        traceNote: "Reasoning trace from org scope, Munin retrieval, ontology context, and source attachment.",
        memoryRecords: "Org memory records",
        muninCounts: {
          fact: "fact",
          procedure: "procedure",
          seed: "seed",
          opinion: "opinion"
        },
        badges: {
          reality: "Reality evidence",
          narrative: "Contrast only",
          sycophancy: "Sycophancy warning"
        },
        cascadeLayers: {
          munin_core: "Layer 1 Core Munin",
          munin_archival: "Layer 1 Archival Munin",
          odim_cache: "Layer 2 Odim Cache",
          reality_gapfill: "Layer 3A Reality Gapfill",
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
        biasTest: {
          reversal: "Reversal Test",
          balanced: "Balanced Presentation",
          confirmation: "Confirmation Bias"
        }
      },
      watchlist: {
        title: "Watchlist & Briefs",
        panels: {
          watchlist: "Watchlist",
          brief: "Daily Brief Preview"
        },
        briefNote: "Reality-layer changes are summarized with source links, confidence, and narrative gap."
      },
      audit: {
        title: "Audit Trail",
        panels: {
          log: "Transparent Event Log"
        }
      },
      settings: {
        title: "Settings",
        panels: {
          alertRules: "Alert Rules",
          apiKeys: "API Keys",
          permissions: "Team Permissions",
          ontology: "Ontology Explorer",
          seedMemory: "Seed Memory"
        },
        copy: {
          alertRules: "Watchlist, layer, and confidence thresholds are backed by deterministic alert evidence.",
          apiKeys: "External AI Agent access uses org-scoped API routes and can be extended to MCP without rewriting the core API.",
          permissions: "Org roles: analyst / admin.",
          ontology: "Advanced object, link, and action type inspection.",
          seedMemory: "Seed memories are MVCC records. Fact seeds enter Munin core; opinion seeds stay physically separate."
        },
        seed: {
          fact: "fact seed",
          opinion: "opinion seed",
          create: "Create",
          edit: "Edit",
          delete: "Retire",
          save: "Save",
          cancel: "Cancel",
          content: "Add source-backed seed memory or a separated opinion seed",
          empty: "No active seed memories.",
          error: "Seed memory request failed"
        },
        language: {
          panel: "Language",
          description: "Interface language for all screens."
        }
      }
    }
  },
  ja: {
    common: {
      live: "ライブ / 出典付き",
      screen: "画面",
      tracked: "監視中",
      on: "表示"
    },
    shell: {
      productCategory: "Reality Intelligence OS",
      nav: {
        map: "Reality Map",
        capitalFlow: "Capital Flow",
        entity: "Entity Intelligence",
        alerts: "Signal Alerts",
        huginn: "Huginn Console",
        watchlist: "Watchlist & Briefs",
        audit: "Audit Trail",
        settings: "Settings"
      }
    },
    layers: ["電力", "資本", "土地", "計算資源", "水", "原材料", "物流"],
    screens: {
      map: {
        title: "Reality Map",
        panels: {
          globe: "資本固定化 Globe / Map",
          layers: "Reality Layer",
          liveFeed: "ライブシグナル"
        },
        globeNote: "マクロの地球儀から用地レベルの地図へズーム閾値で遷移"
      },
      capitalFlow: {
        title: "Capital Flow",
        panels: {
          sectorHeat: "セクター・ヒート",
          sankey: "エンティティ・サンキー",
          gap: "Narrative と Reality の差分"
        },
        sankeyNote: "Microsoft -> Grid -> Utility -> Data Center"
      },
      entity: {
        title: "Entity Intelligence",
        panels: {
          entities: "エンティティ",
          links: "Ontology Links"
        },
        metrics: {
          score: "Reality Score",
          committed: "コミット額",
          leadTime: "先行日数"
        },
        timeline: "出典付き Capital Commitment Timeline"
      },
      alerts: {
        title: "Signal Alerts",
        panels: {
          queue: "アラートキュー",
          chain: "シグナルチェーン"
        },
        chainSteps: ["生 filing を観測", "Entity Resolution が一致", "SPV 信頼度が上昇", "アラート生成"]
      },
      huginn: {
        title: "Huginn Console",
        panels: {
          dialogue: "対話",
          trace: "Reasoning Trace",
          munin: "Munin",
          sources: "出典",
          eval: "回答評価"
        },
        prompt: "質問: Narrative 確認前に資本を固定しているエンティティは？",
        traceNote: "org scope、Munin retrieval、ontology context、source attachment に基づく Reasoning Trace。",
        memoryRecords: "組織メモリ件数",
        muninCounts: {
          fact: "fact",
          procedure: "procedure",
          seed: "seed",
          opinion: "opinion"
        },
        badges: {
          reality: "判断根拠",
          narrative: "対比用・判断根拠外",
          sycophancy: "同調警告"
        },
        cascadeLayers: {
          munin_core: "Layer 1 Core Munin",
          munin_archival: "Layer 1 Archival Munin",
          odim_cache: "Layer 2 Odim Cache",
          reality_gapfill: "Layer 3A Reality Gapfill",
          narrative_capture: "Narrative Capture",
          opinion_search: "Opinion Search",
          precomputed: "Sleep-time Cache"
        },
        eval: {
          rating: "評価",
          note: "評価メモ",
          submit: "評価を送信",
          sent: "保存済み",
          error: "評価送信に失敗しました"
        },
        biasTest: {
          reversal: "反転テスト",
          balanced: "バランス提示",
          confirmation: "確証バイアス"
        }
      },
      watchlist: {
        title: "Watchlist & Briefs",
        panels: {
          watchlist: "Watchlist",
          brief: "Daily Brief プレビュー"
        },
        briefNote: "Reality Layer の変化を、出典リンク・信頼度・Narrative gap とともに要約。"
      },
      audit: {
        title: "Audit Trail",
        panels: {
          log: "透明性イベントログ"
        }
      },
      settings: {
        title: "Settings",
        panels: {
          alertRules: "Alert Rules",
          apiKeys: "API Keys",
          permissions: "Team Permissions",
          ontology: "Ontology Explorer",
          seedMemory: "Seed Memory"
        },
        copy: {
          alertRules: "Watchlist、Layer、信頼度閾値に基づくルールビルダー。",
          apiKeys: "外部 AI Agent のアクセスは API-first 設計。MCP は将来拡張。",
          permissions: "組織ロール: analyst / admin。",
          ontology: "Object、Link、Action type の上級者向け検査。",
          seedMemory: "Seed memory は MVCC で管理。fact seed は Munin core、opinion seed は別テーブルに分離。"
        },
        seed: {
          fact: "fact seed",
          opinion: "opinion seed",
          create: "作成",
          edit: "編集",
          delete: "退役",
          save: "保存",
          cancel: "キャンセル",
          content: "出典付きの seed memory または分離する opinion seed を追加",
          empty: "有効な Seed Memory はありません。",
          error: "Seed Memory 操作に失敗しました"
        },
        language: {
          panel: "言語",
          description: "全画面のインターフェース言語を切り替えます。"
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
