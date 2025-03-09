import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, ArrowRight, Play, Pause } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
} from "recharts";
import "./AudioEmotionAnalyzer.css";

// 定義情緒類型
type Emotion =
  | "happy"
  | "sad"
  | "angry"
  | "neutral"
  | "surprised"
  | "fearful"
  | "disgusted";

const emojiMap: Record<Emotion, string> = {
  happy: "😊",
  sad: "😢",
  angry: "😠",
  neutral: "😐",
  surprised: "😲",
  fearful: "😨",
  disgusted: "🤢",
};

export default function AudioEmotionAnalyzer() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [emotion, setEmotion] = useState<Emotion | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [emotionScores, setEmotionScores] = useState<Record<Emotion, number>>({
    happy: 0,
    sad: 0,
    angry: 0,
    neutral: 0,
    surprised: 0,
    fearful: 0,
    disgusted: 0,
  });

  const [vadValues, setVadValues] = useState<{
    valence: number;
    arousal: number;
    dominance: number;
  }>({
    valence: 0.5,
    arousal: 0.5,
    dominance: 0.5,
  });

  const [linePos, setLinePos] = useState<
    { x1: number; y1: number; x2: number; y2: number }[]
  >([]);
  const componentRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    const updateLinePositions = () => {
      const elements = [
        "emotion-result",
        "emotion-percentage",
        "vad-graph",
        "llm-response",
      ];
      const positions = [];

      for (let i = 0; i < elements.length - 1; i++) {
        const el1 = componentRefs.current[elements[i]];
        const el2 = componentRefs.current[elements[i + 1]];
        if (el1 && el2) {
          const rect1 = el1.getBoundingClientRect();
          const rect2 = el2.getBoundingClientRect();
          positions.push({
            x1: rect1.x + rect1.width / 2,
            y1: rect1.y + rect1.height / 2,
            x2: rect2.x + rect2.width / 2,
            y2: rect2.y + rect2.height / 2,
          });
        }
      }
      setLinePos(positions);
    };

    window.addEventListener("resize", updateLinePositions);
    updateLinePositions();
    return () => window.removeEventListener("resize", updateLinePositions);
  }, []);

  const vadScale = 100; // 調整三角形的縮放比例，限制最大範圍
  const vadData = [
    { x: 0, y: vadValues.valence * vadScale, label: "V" }, // Valence 在上方
    {
      x: (-Math.sqrt(3) / 2) * vadValues.arousal * vadScale,
      y: -0.5 * vadValues.arousal * vadScale,
      label: "A",
    }, // Arousal 在左下
    {
      x: (Math.sqrt(3) / 2) * vadValues.dominance * vadScale,
      y: -0.5 * vadValues.dominance * vadScale,
      label: "D",
    }, // Dominance 在右下
  ];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      setAudioFile(file);
      setAudioURL(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!audioFile) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("file", audioFile);

    try {
      const response = await fetch(
        `https://router.huggingface.co/hf-inference/models/${process.env.NEXT_PUBLIC_HF_MODEL}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_HF_API_KEY}`,
          },
          body: formData,
        }
      );

      console.log(response);
      const result = await response.json();
      console.log("API Response:", result);

      if (result && Array.isArray(result)) {
        const scores: Record<Emotion, number> = {
          happy: 0,
          sad: 0,
          angry: 0,
          neutral: 0,
          surprised: 0,
          fearful: 0,
          disgusted: 0,
        };

        result.forEach((entry) => {
          const label = entry.label.toLowerCase() as Emotion;
          if (scores.hasOwnProperty(label)) {
            scores[label] = entry.score * 100;
          }
        });

        // // 解析 VAD 值
        // if (result.vad) {
        //   setVadValues({
        //     valence: result.vad.valence || 0,
        //     arousal: result.vad.arousal || 0,
        //     dominance: result.vad.dominance || 0,
        //   });
        // }

        const sortedEmotions = Object.entries(scores)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);

        setEmotion(sortedEmotions[0][0] as Emotion);
        setEmotionScores(scores);
      }
    } catch (error) {
      console.error("Error fetching Hugging Face model:", error);
    }

    setLoading(false);
  };

  const handleDelete = () => {
    setAudioFile(null);
    setAudioURL(null);
    setEmotion(null);
    setIsPlaying(false);
    setEmotionScores({
      happy: 0,
      sad: 0,
      angry: 0,
      neutral: 0,
      surprised: 0,
      fearful: 0,
      disgusted: 0,
    });
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="container">
      <h1 className="title">Speech Emotion Recognition Model</h1>
      {/* emotion percentage */}
      <Card className="emotion-percentage">
        <CardContent>
          <h2>Top 3 Emotions</h2>
          {Object.entries(emotionScores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([key, value]) => (
              <p key={key}>
                {key.charAt(0).toUpperCase() + key.slice(1)}: {value.toFixed(1)}
                %
              </p>
            ))}
        </CardContent>
      </Card>
      <div className="layout-grid">
        {/* 左側：音檔上傳區域 */}
        <div className="left-section">
          <Card className="upload-section">
            <CardContent>
              <label htmlFor="audio-upload" className="upload-label">
                <Upload className="upload-icon" />
                <span className="upload-text">File Input</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="audio-upload"
                />
              </label>
              {audioURL && (
                <>
                  <audio ref={audioRef} className="audio-player">
                    <source src={audioURL} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                </>
              )}
            </CardContent>
          </Card>

          <div className="button-group">
            <Button onClick={handlePlayPause} className="play-button">
              {isPlaying ? <Pause /> : <Play />}
            </Button>
            <Button onClick={handleUpload} className="process-button">
              {loading ? "Processing..." : "Process"}
            </Button>
            <Button onClick={handleDelete} className="delete-button">
              <Trash2 className="delete-icon" />
            </Button>
          </div>
        </div>

        {/* 中間：箭頭和情緒分析結果 */}
        <ArrowRight className="arrow-icon" />
        <Card className="emotion-result">
          <CardContent>
            {emotion ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <p className="emoji-large">{emojiMap[emotion]}</p>
              </motion.div>
            ) : (
              <p className="no-emotion">❓</p>
            )}
          </CardContent>
        </Card>

        {/* 右側：LLM 回應 */}
        <div className="llm-response">
          <p>LLM Response</p>
        </div>
      </div>

      {/* 表情符號對應解釋 */}
      <div className="emotion-legend">
        {[...Array(Math.ceil(Object.keys(emojiMap).length / 3))].map(
          (_, rowIndex) => (
            <div key={rowIndex} className="emotion-row">
              {Object.entries(emojiMap)
                .slice(rowIndex * 3, rowIndex * 3 + 3)
                .map(([key, emoji]) => (
                  <p key={key} className="emotion-item">
                    <span className="emoji">{emoji}</span> -{" "}
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </p>
                ))}
            </div>
          )
        )}
      </div>
      {/* VAD graph */}
      <Card className="vad-graph">
        <CardContent>
          <h2>VAD Graph</h2>
          <ResponsiveContainer width="100%" height={150}>
            <ScatterChart>
              <XAxis type="number" dataKey="x" domain={[-120, 120]} hide />
              <YAxis type="number" dataKey="y" domain={[-120, 120]} hide />
              <Scatter data={vadData} fill="#ff7300">
                {vadData.map((point, index) => (
                  <text
                    key={index}
                    x={point.x + 150} // 調整標籤位置
                    y={-point.y + 150} // 調整標籤位置
                    textAnchor="middle"
                    fill="black"
                  >
                    {point.label}
                  </text>
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
