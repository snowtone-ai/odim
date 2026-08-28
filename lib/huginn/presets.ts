export type HuginnPreset = {
  id: string;
  label: string;
  labelJa: string;
  icon: string;
  template: string;
  templateJa: string;
  variables?: string[];
};

export const HUGINN_PRESETS: HuginnPreset[] = [
  {
    id: "daily-brief",
    label: "Daily Brief",
    labelJa: "本日の要点",
    icon: "sunrise",
    template:
      "Summarize the top Capital Fixation signals from the past 24 hours, ordered by priority. Include confidence levels and source references.",
    templateJa:
      "過去24時間に確認された主な資本投下の兆候を、優先度順にまとめてください。信頼度と出典を含めてください。"
  },
  {
    id: "sector-scan",
    label: "Sector Scan",
    labelJa: "分野別の動き",
    icon: "scan-search",
    template:
      "Give me a sector-by-sector overview of Capital Fixation activity this week. Which substrates are showing the most movement?",
    templateJa:
      "今週の資本投下の動きを分野別にまとめてください。最も変化が大きい基盤分野はどれですか？"
  },
  {
    id: "divergence-top5",
    label: "Divergence Top 5",
    labelJa: "乖離が大きい5件",
    icon: "git-compare-arrows",
    template:
      "Which 5 entities currently have the largest Narrative-Reality Gap? For each, explain what reality signals contradict the prevailing narrative.",
    templateJa:
      "報道・言説と実態の乖離が現在最も大きい対象を5件挙げ、どの現実の兆候が一般的な見方と食い違うのか説明してください。"
  },
  {
    id: "entity-deep-dive",
    label: "Entity Deep Dive",
    labelJa: "対象を詳しく調査",
    icon: "microscope",
    template:
      "Analyze {entity_name}'s Capital Fixation activity over the past 30 days. What substrates are they committing to, and what does this suggest about their strategic direction?",
    templateJa:
      "{entity_name}について、過去30日間の資本投下を分析してください。どの基盤分野に資金を振り向け、それが今後の方針について何を示しているか説明してください。",
    variables: ["entity_name"]
  },
  {
    id: "cross-entity",
    label: "Cross-Entity Compare",
    labelJa: "対象を比較",
    icon: "columns-2",
    template:
      "Compare {entity_a} and {entity_b} across all substrate layers. Where do their Capital Fixation patterns converge or diverge?",
    templateJa:
      "{entity_a}と{entity_b}をすべての基盤分野で比較してください。資本投下の傾向が一致する点と異なる点を説明してください。",
    variables: ["entity_a", "entity_b"]
  }
];
