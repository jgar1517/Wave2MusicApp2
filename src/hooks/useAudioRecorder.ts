import { useState, useRef, useCallback } from 'react';

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  audioLevel: number;
  error: string | null;
}

export interface AudioRecorderControls {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;
}

export const useAudioRecorder = () => {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    recordingTime: 0,
    audioLevel: 0,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<number | null>(null);

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const normalizedLevel = Math.min(average / 128, 1);
    
    setState(prev => ({ ...prev, audioLevel: normalizedLevel }));
    
    if (state.isRecording && !state.isPaused) {
      animationRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [state.isRecording, state.isPaused]);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setState(prev => ({ ...prev, recordingTime: prev.recordingTime + 1 }));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        },
      });

      streamRef.current = stream;

      // Set up audio context for level monitoring
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      startTimer();
      updateAudioLevel();

      setState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        recordingTime: 0,
      }));
    } catch (error) {
      console.error('Error starting recording:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to access microphone. Please check permissions.',
      }));
    }
  }, [startTimer, updateAudioLevel]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        resolve(blob);
      };

      mediaRecorderRef.current.stop();
      stopTimer();

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      setState(prev => ({
        ...prev,
        isRecording: false,
        isPaused: false,
        audioLevel: 0,
      }));
    });
  }, [stopTimer]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.pause();
      stopTimer();
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      setState(prev => ({ ...prev, isPaused: true }));
    }
  }, [state.isRecording, stopTimer]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isPaused) {
      mediaRecorderRef.current.resume();
      startTimer();
      updateAudioLevel();
      setState(prev => ({ ...prev, isPaused: false }));
    }
  }, [state.isPaused, startTimer, updateAudioLevel]);

  const resetRecording = useCallback(() => {
    if (state.isRecording) {
      stopRecording();
    }
    
    setState({
      isRecording: false,
      isPaused: false,
      recordingTime: 0,
      audioLevel: 0,
      error: null,
    });
    
    chunksRef.current = [];
  }, [state.isRecording, stopRecording]);

  return {
    ...state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  };
};