import { useState, useRef, useEffect } from "react";
import { Mic } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

import "./styles/main.css";

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
  const historyRef = useRef<
    { label: string; score: number; timestamp: number }[]
  >([]);
  const [vadHistory, setVadHistory] = useState<
    { axis: "Valence" | "Arousal"; value: number }[]
  >([
    { axis: "Valence", value: 0 },
    { axis: "Arousal", value: 0 },
  ]);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

  //web animation
  const [barHeights, setBarHeights] = useState<number[]>(
    new Array(32).fill(10)
  );
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (!isRecording) return;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        // 設定 streamRef，供 cleanup 釋放
        streamRef.current = stream;

        // 不強制 mimeType，由瀏覽器決定
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        // Web Audio 動畫
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        source.connect(analyser);
        audioContextRef.current = audioCtx;
        sourceRef.current = source;

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

        recorder.ondataavailable = async (e) => {
          if (e.data.size === 0) return;
          const timestamp = Date.now();

          const wavBlob = await getWaveBlob(e.data, false);

          //上傳至模型並取得分析結果
          const formData = new FormData();
          formData.append("file", e.data, "audio.webm");
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

            //解析 VAD 值（如果模型回傳 vad）
            if (result.vad) {
              setVadHistory([
                { axis: "Valence", value: result.vad.valence ?? 0 },
                { axis: "Arousal", value: result.vad.arousal ?? 0 },
              ]);
            }

            if (Array.isArray(result) && result.length > 0) {
              //計算 Top 3（只看最近 5 秒）
              const entry = {
                label: result[0].label.toLowerCase(),
                score: result[0].score * 100,
                timestamp,
              };
              historyRef.current.push(entry);
              // 保留最近 5 秒
              const window5 = historyRef.current.filter(
                (d) => timestamp - d.timestamp <= 5000
              );
              // 計算 Top3
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

        recorder.onstop = () => {
          console.log("錄音器已停止");
        };

        recorder.start(5000); // 每 5 秒自動送出資料

        // 錄音秒數計時
        durationTimerRef.current = setInterval(() => {
          setRecordingDuration((d) => d + 1);
        }, 1000);
      })
      .catch((err) => {
        console.error("Cannot access microphone.", err);
        setIsRecording(false);
      });

    return () => {
      // stop recording
      mediaRecorderRef.current?.stop();
      // stop all of the mic track
      streamRef.current?.getTracks().forEach((t) => t.stop());
      // stop animation
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      //stop audioContext
      audioContextRef.current?.close();
      sourceRef.current?.disconnect();

      // clean historyRef
      historyRef.current = [];

      // reset
      setRecordingDuration(0);
      setBarHeights(new Array(32).fill(10));
    };
  }, [isRecording]);

  const latestEmotion = top3Display[0]?.label ?? null;

  return (
    <div className="container">
      <h1 className="title">Real-Time DEmo</h1>
      <div className="layout-grid">
        <Card className="upload-section">
          <CardContent>
            <div className="recording-area">
              <p className="duration">Duration: {recordingDuration}s</p>

              <Card className="recording-visual-box">
                <CardContent>
                  {!isRecording ? (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.4 }}
                      className="mic-icon-wrapper"
                    >
                      <Mic className="mic-icon" />
                      <span className="mic-pulse" />
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className="recording-wave"
                    >
                      {barHeights.map((h, i) => (
                        <motion.div
                          key={i}
                          className="bar"
                          animate={{ height: h }}
                          transition={{ duration: 0.1 }}
                        />
                      ))}
                    </motion.div>
                  )}
                </CardContent>
              </Card>

              <div className="btn-area">
                <button
                  className="btn btn-start"
                  onClick={() => {
                    setRecordingDuration(0);
                    setIsRecording(true);
                  }}
                  disabled={isRecording}
                >
                  Start Recording
                </button>
                <button
                  onClick={() => setIsRecording(false)}
                  disabled={!isRecording}
                  className="btn btn-stop"
                >
                  Stop Recording
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="emotion-circle shadow-inner bg-gradient-to-br from-white to-slate-200">
          <h2 className="text-xl font-semibold mb-2">Current Emotion</h2>
          <motion.div
            key={top3Display[0]?.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-6xl">
              {top3Display[0]?.label ? emojiMap[top3Display[0].label] : "❓"}
            </div>
          </motion.div>
        </div>

        <div className="right-section space-y-4">
          <Card className="expression-box">
            <CardContent>
              <h2 className="text-lg font-semibold mb-2">Top 3 Emotions</h2>
              <motion.div layout transition={{ duration: 0.3 }}>
                {top3Display.length > 0 ? (
                  top3Display.map((e, idx) => (
                    <motion.p
                      key={e.label}
                      className="emotion-item"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <span className="emoji mr-1">{emojiMap[e.label]}</span>
                      <span className="emotion-label">{e.label}</span>:{" "}
                      {e.score.toFixed(1)}%
                    </motion.p>
                  ))
                ) : (
                  <p className="text-gray-500">No data yet.</p>
                )}
              </motion.div>
            </CardContent>
          </Card>

          <Card className="vad-box">
            <CardContent>
              <h2 className="text-lg font-semibold mb-2">Emotion V-A Radar</h2>
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
