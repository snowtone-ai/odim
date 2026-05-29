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
    labelJa: "デイリーブリーフ",
    icon: "sunrise",
    template:
      "Summarize the top Capital Fixation signals from the past 24 hours, ordered by priority. Include confidence levels and source references.",
    templateJa:
      "過去24時間のCapital Fixationシグナルを優先度順にまとめてください。信頼度とソース参照を含めてください。"
  },
  {
    id: "sector-scan",
    label: "Sector Scan",
    labelJa: "セクタースキャン",
    icon: "scan-search",
    template:
      "Give me a sector-by-sector overview of Capital Fixation activity this week. Which substrates are showing the most movement?",
    templateJa:
      "今週のCapital Fixation活動をセクター別に概要してください。どのSubstrateが最も動きがありますか？"
  },
  {
    id: "divergence-top5",
    label: "Divergence Top 5",
    labelJa: "乖離 TOP5",
    icon: "git-compare-arrows",
    template:
      "Which 5 entities currently have the largest Narrative-Reality Gap? For each, explain what reality signals contradict the prevailing narrative.",
    templateJa:
      "現在Narrative-Reality Gapが最も大きい5つのエンティティは？それぞれ、どのリアリティシグナルがナラティブと矛盾するか説明してください。"
  },
  {
    id: "entity-deep-dive",
    label: "Entity Deep Dive",
    labelJa: "エンティティ深掘り",
    icon: "microscope",
    template:
      "Analyze {entity_name}'s Capital Fixation activity over the past 30 days. What substrates are they committing to, and what does this suggest about their strategic direction?",
    templateJa:
      "{entity_name}の過去30日間のCapital Fixation活動を分析してください。どのSubstrateにコミットしており、戦略的方向性として何を示唆しますか？",
    variables: ["entity_name"]
  },
  {
    id: "cross-entity",
    label: "Cross-Entity Compare",
    labelJa: "クロスエンティティ比較",
    icon: "columns-2",
    template:
      "Compare {entity_a} and {entity_b} across all substrate layers. Where do their Capital Fixation patterns converge or diverge?",
    templateJa:
      "{entity_a}と{entity_b}を全Substrateレイヤーで比較してください。Capital Fixationパターンはどこで収束・発散していますか？",
    variables: ["entity_a", "entity_b"]
  }
];
