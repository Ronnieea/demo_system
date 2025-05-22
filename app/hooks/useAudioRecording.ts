import { useState, useRef, useEffect, useCallback } from 'react';
import audioBufferToWav from 'audiobuffer-to-wav';

// Add this interface to store WAV header
interface WavHeader {
  buffer: ArrayBuffer;
  size: number;
}

interface AudioSegment {
    blob: Blob;
    startTime: number;
    endTime: number;
}

export function useAudioRecording(isRecording: boolean) {
    const [recordingDuration, setRecordingDuration] = useState<number>(0);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [audioSegments, setAudioSegments] = useState<AudioSegment[]>([]);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const startTimeRef = useRef<number>(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const isProcessingSegmentRef = useRef<boolean>(false);
    const lastSegmentTimeRef = useRef<number>(0);
    const processedSegmentsRef = useRef<Set<string>>(new Set());
    const currentDurationRef = useRef<number>(0);
    const wavHeaderRef = useRef<WavHeader | null>(null);


    // Initialize audio recording
    useEffect(() => {
        if (isRecording) {
            startRecordingProcess();
        } else if (stream) {
            stopRecordingProcess();
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }

            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, [isRecording]);


    const startRecordingProcess = async () => {
        try {
            // Reset state
            setRecordingDuration(0);
            currentDurationRef.current = 0;
            setAudioSegments([]);
            chunksRef.current = [];
            lastSegmentTimeRef.current = 0;
            processedSegmentsRef.current = new Set();
            startTimeRef.current = Date.now();
            wavHeaderRef.current = null; // Reset the WAV header
            
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setStream(audioStream);

            // Set up timer for duration tracking
            timerRef.current = setInterval(() => {
                currentDurationRef.current += 1;
                setRecordingDuration(currentDurationRef.current);
            }, 1000);

            // Initialize audio context only if it doesn't exist or is closed
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new AudioContext();
            }

            // Setup MediaRecorder with a timeslice of 3 seconds (3000ms)
            const mediaRecorder = new MediaRecorder(audioStream);
            mediaRecorderRef.current = mediaRecorder;

            // Set up event handlers for the MediaRecorder
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                    
                    // Process each 3-second chunk as it becomes available
                    const currentTime = currentDurationRef.current;
                    const segmentStart = Math.floor(currentTime / 3) * 3;
                    const segmentEnd = segmentStart + 3;
                    
                    const segmentKey = `${segmentStart}-${segmentEnd}`;
                    if (!processedSegmentsRef.current.has(segmentKey)) {
                        createAudioSegment(segmentStart, segmentEnd);
                        console.log(segmentStart,segmentEnd);
                        processedSegmentsRef.current.add(segmentKey);
                        lastSegmentTimeRef.current = segmentEnd;
                    }
                }
            };

            // Start recording with a 3-second timeslice
            mediaRecorder.start(3000);


        } catch (error) {
            console.error('Error starting recording:', error);
        }
    };

    // Create an audio segment from the recorded chunks
    const createAudioSegment = (segmentStartSecs: number, segmentEndSecs: number) => {
        if (isProcessingSegmentRef.current) return;
        
        isProcessingSegmentRef.current = true;
        
        // Request data from MediaRecorder to ensure we have the latest
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.requestData();
            
            // Give a small delay to allow data to be collected
            setTimeout(() => {
                finalizeSegment(segmentStartSecs, segmentEndSecs);
            }, 50);
        } else {
            finalizeSegment(segmentStartSecs, segmentEndSecs);
        }
    };
    

    // In your finalizeSegment function, extract and apply headers
    const finalizeSegment = async (segmentStartSecs: number, segmentEndSecs: number) => {
        // Create a copy of the current chunks for this segment
        const currentChunks = [...chunksRef.current];
        
        if (currentChunks.length > 0) {
            try {
                const originalMimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
                const tempBlob = new Blob(currentChunks, { type: originalMimeType });
                
                console.log('Current chunks length:', currentChunks.length);
                // Convert to AudioBuffer 
                const arrayBuffer = await tempBlob.arrayBuffer();
                const audioContext = new AudioContext();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                
                // Convert AudioBuffer to WAV
                const wavArrayBuffer = audioBufferToWav(audioBuffer);
                
                // If this is the first segment, extract and store the WAV header
                if (!wavHeaderRef.current && audioSegments.length === 0) {
                    // WAV header is typically 44 bytes, but to be safe, let's use a larger size
                    // The exact size can vary based on format details
                    const HEADER_SIZE = 44;
                    const headerBuffer = wavArrayBuffer.slice(0, HEADER_SIZE);
                    wavHeaderRef.current = {
                        buffer: headerBuffer,
                        size: HEADER_SIZE
                    };
                    console.log('Extracted WAV header from first segment');
                    
                    // Use the complete WAV for the first segment
                    const wavBlob = new Blob([wavArrayBuffer], { type: 'audio/wav' });
                    
                    setAudioSegments(prev => [
                        ...prev,
                        {
                            blob: wavBlob,
                            startTime: segmentStartSecs,
                            endTime: segmentEndSecs
                        }
                    ]);
                } 
                // For subsequent segments, append the stored header to the audio data
                else if (wavHeaderRef.current) {
                    const audioData = wavArrayBuffer.slice(wavHeaderRef.current.size);
                    console.log(audioData)
                    // Create a new blob with the stored header and current audio data
                    const completeWavBlob = new Blob([
                        wavHeaderRef.current.buffer,
                        audioData
                    ], { type: 'audio/wav' });
                    
                    setAudioSegments(prev => [
                        ...prev,
                        {
                            blob: completeWavBlob,
                            startTime: segmentStartSecs,
                            endTime: segmentEndSecs
                        }
                    ]);
                }
                
            } catch (error) {
                console.error('Error creating audio segment:', error);
            }
        } else {
            console.warn('No audio chunks available for segment creation');
        }
        
        isProcessingSegmentRef.current = false;
    };

    // Stop recording process
    const stopRecordingProcess = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            // Create final segment
            const currentDuration = currentDurationRef.current;
            const lastSegmentTime = lastSegmentTimeRef.current;
            
            if (currentDuration > lastSegmentTime) {
                const segmentKey = `${lastSegmentTime}-${currentDuration}`;
                
                if (!processedSegmentsRef.current.has(segmentKey)) {
                    console.log(`Creating final segment: ${lastSegmentTime}s to ${currentDuration}s`);
                    
                    // Request final data
                    if (mediaRecorderRef.current.state === 'recording') {
                        mediaRecorderRef.current.requestData();
                        
                        // Short delay to capture the final audio
                        setTimeout(() => {
                            finalizeSegment(lastSegmentTime, currentDuration);
                            processedSegmentsRef.current.add(segmentKey);
                            
                            // Now stop the recorder
                            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                                mediaRecorderRef.current.stop();
                            }
                        }, 100);
                    } else {
                        finalizeSegment(lastSegmentTime, currentDuration);
                        processedSegmentsRef.current.add(segmentKey);
                    }
                } else {
                    // If we've already processed this segment, just stop
                    mediaRecorderRef.current.stop();
                }
            } else {
                mediaRecorderRef.current.stop();
            }
        }

        // Clear interval timer
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        // Stop and clear audio stream
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        // Reset states
        setRecordingDuration(0);
        currentDurationRef.current = 0;
    };

    return {
        recordingDuration,
        stream,
        audioSegments,
    };
}