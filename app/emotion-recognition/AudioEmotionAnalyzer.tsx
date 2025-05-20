'use client';

import { useState, useRef, useEffect } from "react";
import { Mic } from "lucide-react";
import { Card, CardContent } from "../components/card";
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { motion } from "framer-motion";
import { getWaveBlob } from "webm-to-wav-converter";

import styles from "./AudioEmotionAnalyzer.module.css";

const emojiMap: Record<string, string> = {
  happy: "😊",
  sad: "😢",
  angry: "😠",
  neutral: "😐",
  surprised: "😲",
  fearful: "😨",
  disgusted: "🤢",
};

export default function AudioEmotionAnalyzer() {
  const [isRecording, setIsRecording] = useState(false);
  const [top3Display, setTop3Display] = useState<
    { label: string; score: number }[]
  >([]);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [vadHistory, setVadHistory] = useState<
    { axis: "Valence" | "Arousal"; value: number }[]
  >([
    { axis: "Valence", value: 0 },
    { axis: "Arousal", value: 0 },
  ]);
  const [barHeights, setBarHeights] = useState<number[]>(
    new Array(32).fill(10)
  );

  // Refs for recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const historyRef = useRef<
    { label: string; score: number; timestamp: number }[]
  >([]);
  
  // Refs for visualization
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    // Only run this effect when recording state changes
    if (!isRecording) return;

    const startAudioCapture = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        
        // Initialize media recorder
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];
        
        // Set up audio context for visualization
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        source.connect(analyser);
        audioContextRef.current = audioCtx;
        sourceRef.current = source;
        analyserRef.current = analyser;
        
        // Set up visualization animation
        const animate = () => {
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          const scaled = Math.min(avg / 3, 50);
          const newHeights = Array.from(
            { length: 32 },
            () => Math.random() * scaled + 5
          );
          setBarHeights(newHeights);
          animationRef.current = requestAnimationFrame(animate);
        };
        animationRef.current = requestAnimationFrame(animate);
        
        // Handle data from recorder
        recorder.ondataavailable = async (e) => {
          if (e.data.size === 0) return;
          
          chunksRef.current.push(e.data);
          const timestamp = Date.now();
          
          // Convert to wav for processing
          const wavBlob = await getWaveBlob(e.data, false);
          await processAudio(wavBlob, timestamp);
        };
        
        recorder.onstop = () => {
          console.log("Recording stopped");
        };
        
        // Start recording with chunks at regular intervals
        recorder.start(5000); // Send data every 5 seconds
        
        // Start duration timer
        setRecordingDuration(0);
        durationTimerRef.current = setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);
        
      } catch (err) {
        console.error("Cannot access microphone.", err);
        setIsRecording(false);
      }
    };
    
    startAudioCapture();
    
    // Cleanup function that runs when recording stops or component unmounts
    return () => {
      // Stop media recorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          console.error("Error stopping recorder:", e);
        }
      }
      
      // Stop and release all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Stop timers
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      
      // Stop animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      
      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      // Disconnect audio source
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      
      // Clear history
      historyRef.current = [];
      
      // Reset state
      setRecordingDuration(0);
      setBarHeights(new Array(32).fill(10));
    };
  }, [isRecording]);

  // Process audio data and update emotion state
  const processAudio = async (wavBlob: Blob, timestamp: number) => {
    try {
      if (!process.env.NEXT_PUBLIC_HF_ENDPOINT) {
        throw new Error("NEXT_PUBLIC_HF_ENDPOINT is not defined");
      }
      
      const response = await fetch(process.env.NEXT_PUBLIC_HF_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_HF_API_KEY}`,
        },
        body: wavBlob,
      });

      const result = await response.json();
      console.log(result);

      // Process VAD values if available
      if (result.vad) {
        setVadHistory([
          { axis: "Arousal", value: result[8].score ?? 0 },
          { axis: "Valence", value: result[9].score ?? 0 },
        ]);
      }

      // Process emotion results
      if (Array.isArray(result) && result.length > 0) {
        // Add new emotion data point
        const entry = {
          label: result[0].label.toLowerCase(),
          score: result[0].score * 100,
          timestamp,
        };
        historyRef.current.push(entry);
        
        // Keep only data from last 5 seconds
        const window5 = historyRef.current.filter(
          (d) => timestamp - d.timestamp <= 5000
        );
        
        // Calculate top 3 emotions
        const agg: Record<string, number> = {};
        window5.forEach((d) => {
          agg[d.label] = (agg[d.label] || 0) + d.score;
        });
        
        const top3 = Object.entries(agg)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([label, score]) => ({ label, score }));
        
        setTop3Display(top3);
      } else {
        console.warn("Invalid or empty result from API:", result);
      }
    } catch (err) {
      console.error("API Error:", err);
    }
  };

  // Start recording function
  const startRecording = () => {
    setRecordingDuration(0);
    setIsRecording(true);
  };

  // Stop recording function
  const stopRecording = () => {
    setIsRecording(false);
  };

  const latestEmotion = top3Display[0]?.label ?? null;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Real-Time DEmo</h1>
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
                      <span className={styles.emotionLabel}>{e.label}</span>:{" "}
                      {e.score.toFixed(1)}%
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
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart
                  cx="50%"
                  cy="50%"
                  outerRadius="80%"
                  data={vadHistory}
                >
                  <PolarGrid />
                  <PolarAngleAxis dataKey="axis" />
                  <PolarRadiusAxis domain={[0, 1]} tickCount={5} />
                  <Radar
                    name="VAD"
                    dataKey="value"
                    stroke="#82ca9d"
                    fill="#82ca9d"
                    fillOpacity={0.6}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}