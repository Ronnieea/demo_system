import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";

const ffmpeg = createFFmpeg({
  log: true,
  corePath: "https://unpkg.com/@ffmpeg/core@0.12.4/dist/ffmpeg-core.js",
});

export const transcodeTo16kWav = async (audioBlob: Blob): Promise<Blob> => {
  if (!ffmpeg.isLoaded()) {
    await ffmpeg.load();
  }

  const uint8Array = new Uint8Array(await audioBlob.arrayBuffer());

  ffmpeg.FS("writeFile", "input.webm", uint8Array);

  await ffmpeg.run(
    "-i",
    "input.webm",
    "-ar",
    "16000",
    "-ac",
    "1",
    "-f",
    "wav",
    "output.wav"
  );

  const output = ffmpeg.FS("readFile", "output.wav");
  const wavBlob = new Blob([new Uint8Array(output.buffer)], {
    type: "audio/wav",
  });

  ffmpeg.FS("unlink", "input.webm");
  ffmpeg.FS("unlink", "output.wav");

  return wavBlob;
};
