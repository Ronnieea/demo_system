/**
 * Helper functions for working with emotion data
 */

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