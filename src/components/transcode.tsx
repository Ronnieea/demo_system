// lib/convertToWav.ts
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";

const ffmpeg = createFFmpeg({ log: false, corePath: "/ffmpeg/ffmpeg-core.js" });

export const convertToWav = async (webmBlob: Blob): Promise<Blob> => {
  if (!ffmpeg.isLoaded()) await ffmpeg.load();

  ffmpeg.FS("writeFile", "input.webm", await fetchFile(webmBlob));

  await ffmpeg.run(
    "-i",
    "input.webm",
    "-ar",
    "16000", // 16kHz
    "-ac",
    "1", // mono
    "-f",
    "wav",
    "output.wav"
  );

  const wavData = ffmpeg.FS("readFile", "output.wav");
  ffmpeg.FS("unlink", "input.webm");
  ffmpeg.FS("unlink", "output.wav");

  return new Blob([new Uint8Array(wavData.buffer as ArrayBuffer)], {
    type: "audio/wav",
  });
};
