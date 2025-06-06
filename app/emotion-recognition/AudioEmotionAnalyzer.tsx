"use client";

import { useState, useRef, useEffect } from "react";
import { Mic } from "lucide-react";
import { Card, CardContent } from "../components/card";

import { motion } from "framer-motion";

// Import custom hooks and services
import { useAudioRecording } from "../hooks/useAudioRecording";
import { useAudioVisualization } from "../hooks/useAudioVisualization";
import { VADRadar } from "../hooks/VARadar";
// import { analyzeAudioEmotion, processEmotionResults } from "../api/emotion_recognition/route";

import {
  formatVADForChart,
  aggregateEmotionScores,
  getTopEmotions,
  computeProportions,
  getTopNByPercent,
  parseEmotionResult,
} from "../utils/emotionUtils";

import styles from "./AudioEmotionAnalyzer.module.css";

// Emoji mapping for emotion display
const emojiMap: Record<string, string> = {
  happy: "😊",
  sad: "😢",
  angry: "😠",
  neutral: "😐",
  surprise: "😲",
  fear: "😨",
  contempt: "😒",
};

export default function AudioEmotionAnalyzer() {
  // State for recording control and emotion display
  const [isRecording, setIsRecording] = useState(false);
  const [top3Display, setTop3Display] = useState<
    { label: string; score: number }[]
  >([]);
  // const [vadHistory, setVadHistory] = useState<
  //   { axis: "Valence" | "Arousal"; value: number }[]
  // >([
  //   { axis: "Arousal", value: 0 },
  //   { axis: "Valence", value: 0 },
  // ]);

  const [vadPoints, setVadPoints] = useState<
    { valence: number; arousal: number; isNew: boolean; timestamp: number }[]
  >([]);

  // Reference to emotion history for processing
  const historyRef = useRef<
    { label: string; score: number; timestamp: number }[]
  >([]);

  // Use custom hook for audio recording
  const { recordingDuration, stream, audioSegments } =
    useAudioRecording(isRecording);

  useEffect(() => {
    const processLatestSegment = async () => {
      const latestSegment = audioSegments[audioSegments.length - 1];
      if (latestSegment) {
        try {
          // ![DEBUGGING] Save audio blob to file
          // const audioUrl = URL.createObjectURL(latestSegment.blob);
          // const downloadLink = document.createElement('a');
          // downloadLink.href = audioUrl;
          // downloadLink.download = `audio_segment_${latestSegment.startTime.toFixed(1)}_${latestSegment.endTime.toFixed(1)}.wav`;
          // document.body.appendChild(downloadLink);
          // downloadLink.click();
          // document.body.removeChild(downloadLink);
          // URL.revokeObjectURL(audioUrl);

          // ![DEBUGGING] Make sure process right segment
          // console.log(`Processing audio segment: ${latestSegment.startTime}s to ${latestSegment.endTime}s`);

          const apiKey = process.env.NEXT_PUBLIC_HF_API_KEY;
          const response = await fetch(
            "https://rngepbqp0dpb1srv.us-east-1.aws.endpoints.huggingface.cloud",
            {
              method: "POST",
              headers: {
                Accept: "application/json",
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "audio/wav",
              },
              body: latestSegment.blob,
            }
          );

          if (!response.ok) {
            throw new Error(
              `API responded with status ${response.status}: ${response.statusText}`
            );
          }

          const result = await response.json();
          console.log("Received emotion analysis result:", result);

          const { top3, vad } = parseEmotionResult(result);

          // setTop3Display(top3);
          setTop3Display(
            top3.map((e) => ({
              label: e.label,
              score: parseFloat((e.score * 100).toFixed(1)),
            }))
          );

          const timestamp = Date.now();

          // clamp 保證在 [0,1] 之間
          const clamp = (v: number) => Math.max(0, Math.min(1, v));
          const vValence = clamp(vad.valence);
          const vArousal = clamp(vad.arousal);

          setVadPoints((prev) => [
            ...prev.map((p) => ({ ...p, isNew: false })), // 先把舊點都設成灰
            {
              valence: vValence,
              arousal: vArousal,
              isNew: true,
              timestamp: Date.now(),
            },
          ]);

          top3.forEach((e) => {
            historyRef.current.push({
              label: e.label,
              score: e.score, // 0–1
              timestamp: timestamp,
            });
          });

          const window5 = historyRef.current.filter(
            (d) => timestamp - d.timestamp <= 5000
          );

          const rawSumMap = aggregateEmotionScores(window5);

          const percentList = computeProportions(rawSumMap);

          const top3Aggregated = getTopNByPercent(percentList, 3);

          setTop3Display(top3Aggregated);

          historyRef.current = historyRef.current.filter(
            (d) => timestamp - d.timestamp <= 5000
          );

          // historyRef.current.push({ ...top3[0], timestamp });
        } catch (error) {
          console.error("Error analyzing audio segment:", error);
        }
      }
    };

    if (audioSegments.length > 0) {
      processLatestSegment();
    }
  }, [audioSegments]);

  // Use custom hook for audio visualization
  const barHeights = useAudioVisualization(stream, isRecording);

  // Start recording function
  const startRecording = () => {
    setIsRecording(true);
  };

  // Stop recording function
  const stopRecording = () => {
    setIsRecording(false);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Real-Time Demo</h1>
      <div className={styles["layout-grid"]}>
        <Card className={styles.uploadSection}>
          <CardContent>
            <div className={styles.recordingArea}>
              <p className={styles.duration}>Duration: {recordingDuration}s</p>

              <Card className={styles.recordingVisualBox}>
                <CardContent>
                  {!isRecording ? (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.4 }}
                      className={styles.micIconWrapper}
                    >
                      <Mic className={styles.micIcon} />
                      <span className={styles.micPulse} />
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className={styles.recordingWave}
                    >
                      {barHeights.map((h, i) => (
                        <motion.div
                          key={i}
                          className={styles.bar}
                          animate={{ height: h }}
                          transition={{ duration: 0.1 }}
                        />
                      ))}
                    </motion.div>
                  )}
                </CardContent>
              </Card>

              <div className={styles.btnArea}>
                <button
                  className={`${styles.btn} ${styles.btnStart}`}
                  onClick={startRecording}
                  disabled={isRecording}
                >
                  Start Recording
                </button>
                <button
                  onClick={stopRecording}
                  disabled={!isRecording}
                  className={`${styles.btn} ${styles.btnStop}`}
                >
                  Stop Recording
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className={styles.emotionCircle}>
          <h2 className={styles.subtitle}>Current Emotion</h2>
          <motion.div
            key={top3Display[0]?.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className={styles.text6xl}>
              {top3Display[0]?.label ? emojiMap[top3Display[0].label] : "❓"}
            </div>
          </motion.div>
        </div>

        <div className={styles.rightSection}>
          <Card className={styles.expressionBox}>
            <CardContent>
              <h2 className={styles.subtitle}>Top 3 Emotions</h2>
              <motion.div layout transition={{ duration: 0.3 }}>
                {top3Display.length > 0 ? (
                  top3Display.map((e, idx) => (
                    <motion.p
                      key={e.label}
                      className={styles.emotionItem}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <span className={styles.emoji}>{emojiMap[e.label]}</span>
                      <span className={styles.emotionLabel}>
                        {e.label}
                      </span>: {e.score.toFixed(1)}%
                    </motion.p>
                  ))
                ) : (
                  <p className={styles.textGray}>No data yet.</p>
                )}
              </motion.div>
            </CardContent>
          </Card>

          <Card className={styles.vadBox}>
            <CardContent>
              <h2 className={styles.subtitle}>Emotion V-A Radar</h2>
              <VADRadar vadPoints={vadPoints} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
