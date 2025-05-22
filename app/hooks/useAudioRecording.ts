import { useState, useRef, useEffect, useCallback } from 'react';
import audioBufferToWav from 'audiobuffer-to-wav';

interface AudioSegment {
    blob: Blob;
    startTime: number;
    endTime: number;
}

export function useAudioRecording(isRecording: boolean) {
    const [recordingDuration, setRecordingDuration] = useState<number>(0);
    const [audioSegments, setAudioSegments] = useState<AudioSegment[]>([]);
    const [stream, setStream] = useState<MediaStream | null>(null);
    
    // Refs for recording state
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const allChunksRef = useRef<Blob[]>([]);
    const recordingStartTimeRef = useRef<number>(0);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastSegmentTimeRef = useRef<number>(-1);
    const isProcessingSegmentRef = useRef<boolean>(false);
    
    // Define segment duration (in seconds)
    const segmentDuration = 5;

    // Initialize audio recording
    useEffect(() => {
        if (isRecording) {
            startRecordingProcess();
        } else {
            stopRecordingProcess();
        }

        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }

            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                setStream(null);
            }
        };
    }, [isRecording]);

    // Update recording duration and check if segment needs to be created
    const updateRecordingState = useCallback(() => {
        if (recordingStartTimeRef.current > 0) {
            const duration = (Date.now() - recordingStartTimeRef.current) / 1000;
            setRecordingDuration(Math.floor(duration * 10) / 10);
            
            // Check if we need to create a segment
            const currentInterval = Math.floor(duration / segmentDuration);
            
            if (currentInterval > 0 && currentInterval !== lastSegmentTimeRef.current) {
                const segmentStart = (currentInterval - 1) * segmentDuration;
                const segmentEnd = currentInterval * segmentDuration;
                
                createAudioSegment(segmentStart, segmentEnd);
                lastSegmentTimeRef.current = currentInterval;
            }
        }
    }, []);

    const startRecordingProcess = async () => {
        try {
            // Reset state
            setRecordingDuration(0);
            setAudioSegments([]);
            allChunksRef.current = [];
            recordingStartTimeRef.current = Date.now();
            lastSegmentTimeRef.current = -1;
            
            timerIntervalRef.current = setInterval(updateRecordingState, 100);
            
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setStream(audioStream);
            
            const mediaRecorder = new MediaRecorder(audioStream);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    allChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.start(500);
        } catch (error) {
            console.error('Error starting recording:', error);
        }
    };

    const createAudioSegment = async (segmentStartSecs: number, segmentEndSecs: number) => {
        if (isProcessingSegmentRef.current || allChunksRef.current.length === 0) return;
        
        isProcessingSegmentRef.current = true;
        
        try {
            const completeBlob = new Blob(allChunksRef.current, { type: 'audio/webm' });
            const arrayBuffer = await completeBlob.arrayBuffer();
            const audioContext = new AudioContext();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            const sampleRate = audioBuffer.sampleRate;
            const startSample = Math.floor(segmentStartSecs * sampleRate);
            const endSample = Math.min(Math.floor(segmentEndSecs * sampleRate), audioBuffer.length);
            
            const segmentBuffer = audioContext.createBuffer(
                audioBuffer.numberOfChannels,
                endSample - startSample,
                sampleRate
            );
            
            for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                const originalData = audioBuffer.getChannelData(channel);
                const segmentData = segmentBuffer.getChannelData(channel);
                
                for (let i = 0; i < segmentBuffer.length; i++) {
                    segmentData[i] = originalData[i + startSample];
                }
            }
            
            const wavArrayBuffer = audioBufferToWav(segmentBuffer);
            const wavBlob = new Blob([wavArrayBuffer], { type: 'audio/wav' });
            
            setAudioSegments(prev => [
                ...prev,
                {
                    blob: wavBlob,
                    startTime: segmentStartSecs,
                    endTime: segmentEndSecs
                }
            ]);
            
            audioContext.close();
        } catch (error) {
            console.error('Error processing audio segment:', error);
        } finally {
            isProcessingSegmentRef.current = false;
        }
    };

    const stopRecordingProcess = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            const currentDuration = recordingDuration;
            const lastSegmentTime = lastSegmentTimeRef.current * segmentDuration;
            
            if (currentDuration > lastSegmentTime && currentDuration - lastSegmentTime >= 0.5) {
                createAudioSegment(lastSegmentTime, currentDuration);
            }
            
            mediaRecorderRef.current.stop();
        }

        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }

        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }

        setRecordingDuration(0);
    };

    return {
        recordingDuration,
        stream,
        audioSegments,
    };
}