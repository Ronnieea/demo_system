/**
 * Helper functions for working with emotion data
 */
// emotionUtils.ts
export interface EmotionEntry {
  label: string;
  score: number;
}

export interface VAD {
  valence: number;
  arousal: number;
}

export function parseEmotionResult(result: EmotionEntry[]): {
  top3: EmotionEntry[];
  vad: VAD;
} {
  const emotionLabels = [
    "angry",
    "happy",
    "sad",
    "neutral",
    "surprise",
    "fear",
    "contempt",
  ];

  const emotions = result
    .filter((r) => emotionLabels.includes(r.label.toLowerCase()))
    .map((r) => ({
      label: r.label.toLowerCase(),
      score: r.score * 100,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const vad = {
    valence:
      result.find((r) => r.label.toLowerCase() === "valence")?.score ?? 0,
    arousal:
      result.find((r) => r.label.toLowerCase() === "arousal")?.score ?? 0,
  };

  return { top3: emotions, vad };
}

/**
 * Formats a VAD (Valence-Arousal-Dominance) result for chart display
 * @param result - The API result containing VAD data
 * @returns Array of formatted VAD values for radar chart
 */
export function formatVADForChart(result: any) {
  // Handling various API response formats
  let arousal = 0;
  let valence = 0;

  if (result.vad) {
    // Direct VAD object format
    arousal = result.vad.arousal || 0;
    valence = result.vad.valence || 0;
  } else if (Array.isArray(result) && result.length > 8) {
    // Array format with specific indices
    arousal = result[8]?.score || 0;
    valence = result[9]?.score || 0;
  }

  return [
    { axis: "Arousal", value: arousal },
    { axis: "Valence", value: valence },
  ];
}

/**
 * Calculate a combined emotion score from multiple data points
 * @param emotionData - Array of emotion data points
 * @returns Record mapping emotion labels to their aggregated scores
 */
export function aggregateEmotionScores(
  emotionData: { label: string; score: number }[]
): Record<string, number> {
  const aggregated: Record<string, number> = {};

  emotionData.forEach((data) => {
    aggregated[data.label] = (aggregated[data.label] || 0) + data.score;
  });

  return aggregated;
}

/**
 * Normalize the original rawSumMap (e.g. { happy:1.4, sad:0.3, neutral:0.2, …}) to get the percentage.
 * Percentage calculation method: proportion[label] = rawSumMap[label] / sum(all rawSumMap values) * 100
 * @param rawSumMap
 * @returns array format: [{ label, score }…]
 */

export function computeProportions(
  rawSumMap: Record<string, number>
): { label: string; score: number }[] {
  const entries = Object.entries(rawSumMap);
  const sumAll = entries.reduce((acc, [_label, v]) => acc + v, 0) || 1;

  return entries.map(([label, v]) => ({
    label,
    score: (v / sumAll) * 100,
  }));
}

/**
 * Get top N emotions from aggregated scores
 * @param aggregatedScores - Record mapping emotion labels to scores
 * @param topCount - Number of top emotions to return
 * @returns Array of top emotions with their scores
 */
export function getTopEmotions(
  aggregatedScores: Record<string, number>,
  topCount: number = 3
): { label: string; score: number }[] {
  return Object.entries(aggregatedScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topCount)
    .map(([label, score]) => ({ label, score }));
}

/**
 * Select TopN from the normalized (percent) data
 * Here we assume that the incoming entries have a percent field
 * @param percentList
 * @param topCount
 * @returns Array of top emotions with their scores
 */
export function getTopNByPercent(
  percentList: { label: string; score: number }[],
  topCount: number = 3
): { label: string; score: number }[] {
  return percentList.sort((a, b) => b.score - a.score).slice(0, topCount);
}
