import AudioEmotionAnalyzer from "./emotion-recognition/AudioEmotionAnalyzer";
// import for testing
// import AudioRecorder from "./tester/test";

export default function Home() {
  return (
    <div className="page-container">
      <AudioEmotionAnalyzer />
    </div>
  );
}