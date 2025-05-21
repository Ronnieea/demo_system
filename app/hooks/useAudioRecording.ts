import { useState, useRef, useEffect, useCallback } from 'react';

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

    // Start recording process
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
            
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setStream(audioStream);

            // Initialize audio context
            audioContextRef.current = new AudioContext();

            // Setup MediaRecorder
            const mediaRecorder = new MediaRecorder(audioStream);
            mediaRecorderRef.current = mediaRecorder;

            // Set up event handlers for the MediaRecorder
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            // Start recording
            mediaRecorder.start();

            // Set up timer for duration and segmentation
            timerRef.current = setInterval(() => {
                currentDurationRef.current += 1;
                setRecordingDuration(currentDurationRef.current);
                
                console.log(`Timer value updated: ${currentDurationRef.current}`);
                
                // Create segments at exact 3s intervals
                if (currentDurationRef.current % 3 === 0 && !isProcessingSegmentRef.current) {
                    const exactSegmentStart = lastSegmentTimeRef.current;
                    const exactSegmentEnd = currentDurationRef.current;
                    
                    // Only process if it's a valid segment and we haven't processed it before
                    const segmentKey = `${exactSegmentStart}-${exactSegmentEnd}`;
                    if (exactSegmentStart < exactSegmentEnd && !processedSegmentsRef.current.has(segmentKey)) {
                        console.log(`Scheduling segment: ${exactSegmentStart}s to ${exactSegmentEnd}s`);
                        
                        createAudioSegment(exactSegmentStart, exactSegmentEnd);
                        processedSegmentsRef.current.add(segmentKey);
                        
                        // Update the last segment time
                        lastSegmentTimeRef.current = exactSegmentEnd;
                    }
                }
            }, 1000);

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
    
    // This function needs to be modified to create more reliable audio segments
    const finalizeSegment = (segmentStartSecs: number, segmentEndSecs: number) => {
        // Create a copy of the current chunks
        const currentChunks = [...chunksRef.current];
        
        // Only reset chunks if we successfully create a segment
        if (currentChunks.length > 0) {
            console.log(`Processing audio segment: ${segmentStartSecs}s to ${segmentEndSecs}s`);
            
            // Use the MediaRecorder's mimeType for the blob type instead of hardcoding 'audio/wav'
            const mimeType = mediaRecorderRef.current?.mimeType || 'audio/wav';
            
            // Create a blob with proper MIME type
            const segmentBlob = new Blob(currentChunks, { type: mimeType });
            
            // For testing, let's log the blob size and type
            console.log(`Created segment blob: ${segmentBlob.size} bytes, type: ${segmentBlob.type}`);
            
            // Only add non-empty segments
            if (segmentBlob.size > 0) {
                // Reset chunks for next segment only after successful creation
                chunksRef.current = [];
                
                // Add segment to the list
                setAudioSegments(prev => [
                    ...prev,
                    {
                        blob: segmentBlob,
                        startTime: segmentStartSecs,
                        endTime: segmentEndSecs
                    }
                ]);
            } else {
                console.warn('Created empty segment blob, skipping');
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