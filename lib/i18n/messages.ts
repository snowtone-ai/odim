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
          munin: "Munin"
        },
        prompt: "Which entities are committing capital before narrative confirmation?",
        traceNote: "Reasoning trace from org scope, Munin retrieval, ontology context, and source attachment.",
        memoryRecords: "Org memory records"
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
          ontology: "Ontology Explorer"
        },
        copy: {
          alertRules: "Watchlist, layer, and confidence thresholds are backed by deterministic alert evidence.",
          apiKeys: "External AI Agent access uses org-scoped API routes and can be extended to MCP without rewriting the core API.",
          permissions: "Org roles: analyst / admin.",
          ontology: "Advanced object, link, and action type inspection."
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
          munin: "Munin"
        },
        prompt: "質問: Narrative 確認前に資本を固定しているエンティティは？",
        traceNote: "org scope、Munin retrieval、ontology context、source attachment に基づく Reasoning Trace。",
        memoryRecords: "組織メモリ件数"
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
          ontology: "Ontology Explorer"
        },
        copy: {
          alertRules: "Watchlist、Layer、信頼度閾値に基づくルールビルダー。",
          apiKeys: "外部 AI Agent のアクセスは API-first 設計。MCP は将来拡張。",
          permissions: "組織ロール: analyst / admin。",
          ontology: "Object、Link、Action type の上級者向け検査。"
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
