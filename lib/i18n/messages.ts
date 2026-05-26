export const locales = ["en", "ja"] as const;
export type Locale = (typeof locales)[number];

export const messages = {
  en: {
    common: {
      live: "Live · Source-backed",
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
        huginn: "Huginn",
        watchlist: "Watchlist",
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
        globeNote: "Zoom to explore substrate signals from macro to parcel level"
      },
      capitalFlow: {
        title: "Capital Flow",
        panels: {
          sectorHeat: "Sector Heat",
          sankey: "Entity Flow",
          gap: "Narrative–Reality Gap"
        },
        sankeyNote: "Microsoft → Grid → Utility → Data Center"
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
        timeline: "Capital Commitment Timeline"
      },
      alerts: {
        title: "Signal Alerts",
        panels: {
          queue: "Alert Queue",
          chain: "Signal Chain"
        },
        chainSteps: [
          "Raw filing observed",
          "Entity resolution matched",
          "SPV confidence increased",
          "Alert emitted"
        ]
      },
      huginn: {
        title: "Huginn",
        panels: {
          dialogue: "Dialogue",
          trace: "Reasoning Trace",
          munin: "Munin",
          sources: "Sources",
          eval: "Answer Eval"
        },
        prompt: "Which entities are committing capital before narrative confirmation?",
        traceNote: "Trace covers org scope, Munin retrieval, ontology context, and source attachment.",
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
          munin_core: "Layer 1 · Core Munin",
          munin_archival: "Layer 1 · Archival Munin",
          odim_cache: "Layer 2 · Odim Cache",
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
        biasTest: {
          reversal: "Reversal Test",
          balanced: "Balanced Presentation",
          confirmation: "Confirmation Bias"
        }
      },
      watchlist: {
        title: "Watchlist",
        panels: {
          watchlist: "Watchlist",
          brief: "Daily Brief"
        },
        briefNote: "Reality-layer changes summarized with source links, confidence scores, and narrative gap.",
        favorites: {
          entity: "Entities",
          sector: "Sectors",
          region: "Regions",
          empty: "No items tracked.",
          add: "Add",
          addHint: "Search entities, sectors, regions…",
          tracked: "tracked"
        }
      },
      audit: {
        title: "Audit Trail",
        panels: {
          log: "Event Log"
        }
      },
      settings: {
        title: "Settings",
        panels: {
          alertRules: "Alert Rules",
          apiKeys: "API Keys",
          permissions: "Team Permissions",
          ontology: "Ontology Explorer",
          seedMemory: "Seed Memory",
          auditLog: "Audit Trail"
        },
        copy: {
          alertRules: "Watchlist, layer, and confidence thresholds backed by deterministic alert evidence.",
          apiKeys: "External AI agent access uses org-scoped API routes, extendable to MCP.",
          permissions: "Org roles: analyst / admin.",
          ontology: "Advanced object, link, and action type inspection.",
          seedMemory: "Seed memories are MVCC records. Fact seeds enter Munin core; opinion seeds stay physically separate."
        },
        seed: {
          fact: "Fact seed",
          opinion: "Opinion seed",
          create: "Create",
          edit: "Edit",
          delete: "Retire",
          save: "Save",
          cancel: "Cancel",
          content: "Add a source-backed fact seed or a separated opinion seed",
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
        map: "リアリティマップ",
        capitalFlow: "資本フロー",
        entity: "エンティティ分析",
        alerts: "アラート",
        huginn: "Huginn",
        watchlist: "ウォッチリスト",
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
        globeNote: "ズームで基盤層シグナルをマクロから用地レベルまで探索"
      },
      capitalFlow: {
        title: "資本フロー",
        panels: {
          sectorHeat: "セクターヒート",
          sankey: "フロー図",
          gap: "ナラティブ乖離"
        },
        sankeyNote: "Microsoft → 送電網 → 電力会社 → データセンター"
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
        timeline: "資本コミットメント履歴"
      },
      alerts: {
        title: "アラート",
        panels: {
          queue: "アラートキュー",
          chain: "シグナルチェーン"
        },
        chainSteps: [
          "申請書類を検出",
          "エンティティ照合が一致",
          "SPV信頼度が上昇",
          "アラートを発報"
        ]
      },
      huginn: {
        title: "Huginn",
        panels: {
          dialogue: "対話",
          trace: "推論トレース",
          munin: "Munin",
          sources: "出典",
          eval: "回答評価"
        },
        prompt: "ナラティブが確認される前に資本を固定しているエンティティはどれか？",
        traceNote: "組織スコープ、Munin検索、オントロジーコンテキスト、出典添付に基づく推論トレースです。",
        memoryRecords: "組織メモリ件数",
        muninCounts: {
          fact: "ファクト",
          procedure: "手順",
          seed: "シード",
          opinion: "意見"
        },
        badges: {
          reality: "根拠あり",
          narrative: "対比のみ",
          sycophancy: "同調バイアス警告"
        },
        cascadeLayers: {
          munin_core: "Layer 1 · コアMunin",
          munin_archival: "Layer 1 · アーカイブMunin",
          odim_cache: "Layer 2 · Odimキャッシュ",
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
        biasTest: {
          reversal: "反転テスト",
          balanced: "バランス提示",
          confirmation: "確証バイアス"
        }
      },
      watchlist: {
        title: "ウォッチリスト",
        panels: {
          watchlist: "ウォッチリスト",
          brief: "デイリーブリーフ"
        },
        briefNote: "Reality Layerの変化を出典リンク・信頼度・ナラティブ乖離とともに要約します。",
        favorites: {
          entity: "エンティティ",
          sector: "セクター",
          region: "地域",
          empty: "監視項目がありません。",
          add: "追加",
          addHint: "エンティティ・セクター・地域を検索…",
          tracked: "監視中"
        }
      },
      audit: {
        title: "監査ログ",
        panels: {
          log: "イベントログ"
        }
      },
      settings: {
        title: "設定",
        panels: {
          alertRules: "アラートルール",
          apiKeys: "APIキー",
          permissions: "チーム権限",
          ontology: "オントロジー",
          seedMemory: "シードメモリ",
          auditLog: "監査ログ"
        },
        copy: {
          alertRules: "ウォッチリスト・レイヤー・信頼度のしきい値に基づくルール設定です。",
          apiKeys: "外部AIエージェントのアクセスはAPIファーストで設計されており、MCPへの拡張にも対応しています。",
          permissions: "組織ロール：アナリスト / 管理者",
          ontology: "オブジェクト・リンク・アクションタイプの高度な検査機能です。",
          seedMemory: "シードメモリはMVCCで管理されます。ファクトシードはMuninコアに、意見シードは別テーブルに分離されます。"
        },
        seed: {
          fact: "ファクトシード",
          opinion: "意見シード",
          create: "作成",
          edit: "編集",
          delete: "削除",
          save: "保存",
          cancel: "キャンセル",
          content: "出典付きのファクトシード、または意見シードを追加してください",
          empty: "シードメモリがありません。",
          error: "シードメモリの操作に失敗しました"
        },
        language: {
          panel: "言語設定",
          description: "全画面の表示言語を切り替えます。"
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
