import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Play, Loader, ArrowRight, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import "./AudioEmotionAnalyzer.css";

export default function AudioEmotionAnalyzer() {
  const [audioFile, setAudioFile] = useState(null);
  const [audioURL, setAudioURL] = useState(null);
  const [emotion, setEmotion] = useState("neutral"); // 預設情緒
  const [loading, setLoading] = useState(false);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setAudioFile(file);
    setAudioURL(URL.createObjectURL(file));
  };

  const handleUpload = () => {
    if (!audioFile) return;
    setLoading(true);

    setTimeout(() => {
      setEmotion("neutral"); // 暫時使用預設情緒
      setLoading(false);
    }, 2000); // 模擬處理時間
  };

  const handleDelete = () => {
    setAudioFile(null);
    setAudioURL(null);
    setEmotion(null);
  };

  const emojiMap = {
    happy: "😊",
    sad: "😢",
    angry: "😠",
    neutral: "😐",
    surprised: "😲",
    fearful: "😨",
    disgusted: "🤢",
  };

  return (
    <div className="container">
      <h1 className="title">Speech Emotion Recognition Model</h1>
      <div className="main-content">
        <div className="upload-box">
          <label htmlFor="audio-upload" className="upload-label">
            <Upload className="upload-icon" />
            <span className="upload-text">
              Click to upload audio file (mp3, wav)
            </span>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="hidden"
              id="audio-upload"
            />
          </label>
          {audioURL && (
            <audio controls className="audio-player">
              <source src={audioURL} type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
          )}
        </div>
        <ArrowRight className="arrow-icon" />
        <Card className="result-box">
          <CardContent className="result-content">
            {emotion ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <p className="emoji">{emojiMap[emotion] || "❓"}</p>
              </motion.div>
            ) : (
              <p className="no-emotion">No emotion detected</p>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="button-group">
        <Button onClick={handleUpload} className="process-button">
          {loading ? "Processing..." : "Process"}
        </Button>
        <Button onClick={handleDelete} className="delete-button">
          <Trash2 className="delete-icon" />
        </Button>
      </div>
    </div>
  );
}
