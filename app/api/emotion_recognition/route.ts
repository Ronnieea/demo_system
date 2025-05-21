// import { formatVADForChart, aggregateEmotionScores, getTopEmotions } from '../../utils/emotionUtils';
import { NextRequest, NextResponse } from "next/server";
/**
 * Process audio data with emotion recognition API
 * @param wavBlob - Audio data as WAV blob
 * @returns Promise containing emotion analysis result
 */
export async function POST(req: NextRequest) {
  try {
    // const formData = await req.form
    if (!process.env.NEXT_PUBLIC_HF_ENDPOINT) {
      throw new Error("NEXT_PUBLIC_HF_ENDPOINT is not defined");
    }
    
    // const response = await fetch(process.env.NEXT_PUBLIC_HF_ENDPOINT, {
    //   method: "POST",
    //   headers: {
    //     Authorization: `Bearer ${process.env.NEXT_PUBLIC_HF_API_KEY}`,
    //   },
    //   body: wavBlob,
    // });

    // const result = await response.json();
    // return result;
  } catch (err) {
    console.error("API Error:", err);
    throw err;
  }
}

/**
 * Process emotion results to get top emotions and VAD data
 * @param results - Emotion results from API
 * @param history - Previous emotion history
 * @param timestamp - Current timestamp
 * @returns Object containing processed emotion data
 */
// export function processEmotionResults(
//   results: any,
//   history: { label: string; score: number; timestamp: number }[],
//   timestamp: number
// ) {
//   // Create a copy of history to avoid mutating the original
//   const updatedHistory = [...history];
  
//   // Process VAD values
//   const vadData = formatVADForChart(results);
  
//   // Process emotion results
//   if (Array.isArray(results) && results.length > 0) {
//     // Add new emotion data point
//     const entry = {
//       label: results[0].label.toLowerCase(),
//       score: results[0].score * 100,
//       timestamp,
//     };
//     updatedHistory.push(entry);
    
//     // Keep only data from last 5 seconds
//     const recentData = updatedHistory.filter(
//       (d) => timestamp - d.timestamp <= 5000
//     );
    
//     // Calculate top 3 emotions using utility functions
//     const aggregated = aggregateEmotionScores(recentData);
//     const top3 = getTopEmotions(aggregated, 3);
    
//     return { 
//       top3, 
//       updatedHistory: recentData,
//       vadData
//     };
//   }
  
//   return { 
//     top3: [], 
//     updatedHistory,
//     vadData
//   };
// }