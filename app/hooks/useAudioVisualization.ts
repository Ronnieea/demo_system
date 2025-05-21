import { useState, useRef, useEffect } from 'react';

/**
 * Custom hook to handle audio visualization
 * @param stream - MediaStream to visualize
 * @param isActive - Boolean indicating if visualization should be active
 * @returns Array of bar heights for visualization
 */
export function useAudioVisualization(
    stream: MediaStream | null,
    isActive: boolean
) {
    const [barHeights, setBarHeights] = useState<number[]>(new Array(32).fill(10));

    // Refs for visualization
    const animationRef = useRef<number | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);

    useEffect(() => {
        // Only setup visualization if stream exists and visualization is active
        if (!stream || !isActive) {
            // Cleanup if either condition is false
            cleanupVisualization();
            return;
        }

        // Set up audio context for visualization
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        source.connect(analyser);
        audioContextRef.current = audioCtx;
        sourceRef.current = source;
        analyserRef.current = analyser;

        // Set up visualization animation
        const animate = () => {
            analyser.getByteFrequencyData(dataArray);
            const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            const scaled = Math.min(avg / 3, 50);
            const newHeights = Array.from(
                { length: 17 },
                () => Math.random() * scaled + 5
            );
            setBarHeights(newHeights);
            animationRef.current = requestAnimationFrame(animate);
        };
        animationRef.current = requestAnimationFrame(animate);

        // Cleanup function
        return cleanupVisualization;
    }, [stream, isActive]);

    function cleanupVisualization() {
        // Stop animation
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }

        // Close audio context
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        // Disconnect audio source
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }

        // Reset visualization
        setBarHeights(new Array(32).fill(10));
    }

    return barHeights;
}