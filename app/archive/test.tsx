'use client';
import { useState, useRef, useEffect } from 'react';
import audioBufferToWav from 'audiobuffer-to-wav';

interface WavHeader {
  buffer: ArrayBuffer;
  size: number;
}

const AudioRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [segment, setSegment] = useState(0);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder|null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const wavHeaderRef = useRef<WavHeader | null>(null);
    const segmentCounterRef = useRef<number>(0);
    const recordingStartTimeRef = useRef<number>(0);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const allChunksRef = useRef<Blob[]>([]);
    const lastClipTimeRef = useRef<number>(-1);
    
    // Define clip duration (in seconds)
    const clipDuration = 5; // Each clip will be 2 seconds
    
    // Function to update recording duration
    const updateRecordingDuration = () => {
        if (recordingStartTimeRef.current > 0) {
            const duration = (Date.now() - recordingStartTimeRef.current) / 1000;
            setRecordingDuration(Math.floor(duration * 10) / 10);
            
            // Check if we need to create a clip
            const currentInterval = Math.floor(duration / clipDuration);
            
            // Only create a clip if we haven't created one for this interval yet
            if (currentInterval > 0 && currentInterval !== lastClipTimeRef.current) {
                const clipStart = (currentInterval - 1) * clipDuration;
                const clipEnd = currentInterval * clipDuration;
                
                // Create the clip and update the last clip time
                createAndDownloadClip(clipStart, clipEnd);
                lastClipTimeRef.current = currentInterval;
            }
        }
    };

    const startRecording = async () => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                // Reset segment counter when starting recording
                segmentCounterRef.current = 0;
                setSegment(0);
                chunksRef.current = [];
                allChunksRef.current = [];
                recordingStartTimeRef.current = Date.now();
                lastClipTimeRef.current = -1; // Reset last clip time
                setRecordingDuration(0);
                
                // Start a timer to update the recording duration
                timerIntervalRef.current = setInterval(updateRecordingDuration, 100);
                
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream);

                mediaRecorder.ondataavailable = handleDataAvailable;
                mediaRecorder.onstop = handleStop;

                mediaRecorderRef.current = mediaRecorder;
                mediaRecorder.start(500); // 500ms chunks for more precise clip creation

                setIsRecording(true);
            } catch (err) {
                console.error('Error accessing audio devices:', err);
            }
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            
            // Close and release audio tracks
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        
        // Clear the timers
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        
        wavHeaderRef.current = null; 
        setSegment(0);
        setIsRecording(false);
    };

    const handleDataAvailable = async (event: BlobEvent) => {
        if (event.data.size > 0) {
            const chunk = event.data;
            chunksRef.current.push(chunk);
            allChunksRef.current.push(chunk); // Keep all chunks for clip creation
            
            // Increment our ref counter first
            segmentCounterRef.current += 1;
            // Then update state with the ref value
            setSegment(segmentCounterRef.current);
        }
    };

    const handleStop = () => {
        // Clean up
        chunksRef.current = [];
        allChunksRef.current = [];
    };

    // Create and download a clip for the specified time range
    const createAndDownloadClip = async (startTime: number, endTime: number) => {
        if (allChunksRef.current.length === 0) {
            console.log("No recording available to clip");
            return;
        }

        try {
            // Combine all chunks into one audio buffer
            const completeBlob = new Blob(allChunksRef.current, { type: 'audio/webm' });
            const arrayBuffer = await completeBlob.arrayBuffer();
            const audioContext = new AudioContext();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // Calculate sample positions for the clip
            const sampleRate = audioBuffer.sampleRate;
            const startSample = Math.floor(startTime * sampleRate);
            const endSample = Math.min(Math.floor(endTime * sampleRate), audioBuffer.length);
            
            // Create a new buffer for the clip
            const clipBuffer = audioContext.createBuffer(
                audioBuffer.numberOfChannels,
                endSample - startSample,
                sampleRate
            );
            
            // Copy the data from the original buffer to the clip buffer
            for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                const originalData = audioBuffer.getChannelData(channel);
                const clipData = clipBuffer.getChannelData(channel);
                
                for (let i = 0; i < clipBuffer.length; i++) {
                    clipData[i] = originalData[i + startSample];
                }
            }
            
            // Convert the clip to WAV format
            const wavArrayBuffer = audioBufferToWav(clipBuffer);
            const wavBlob = new Blob([wavArrayBuffer], { type: 'audio/wav' });
            
            // Automatically download the clip
            const audioUrl = URL.createObjectURL(wavBlob);
            const downloadLink = document.createElement('a');
            downloadLink.href = audioUrl;
            downloadLink.download = `clip-${startTime}-to-${endTime}.wav`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(audioUrl);
            
            // Clean up audio context
            audioContext.close();
            
            console.log(`Created and downloaded clip from ${startTime}s to ${endTime}s`);
            
        } catch (error) {
            console.error('Error processing audio clip:', error);
        }
    };

    // Display current segment for debugging
    useEffect(() => {
        console.log('Current segment:', segment);
    }, [segment]);

    return (
        <div>
            <button onClick={startRecording} disabled={isRecording}>
                Start Recording
            </button>
            <div> ###################################</div>
            <button onClick={stopRecording} disabled={!isRecording}>
                Stop Recording
            </button>
            <div>Current Segment: {segment}</div>
            <div>Recording Duration: {recordingDuration}s</div>
            <div>Clips will be created every {clipDuration} seconds</div>
        </div>
    );
};

export default AudioRecorder;