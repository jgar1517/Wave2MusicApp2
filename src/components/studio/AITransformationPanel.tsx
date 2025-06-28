import React, { useState, useEffect } from 'react';
import { Wand2, Play, Pause, Download, Star, X, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAIStore } from '../../stores/aiStore';
import { useProjectStore } from '../../stores/projectStore';
import { TRANSFORMATION_STYLES, TransformationStyle } from '../../lib/replicate';

const AITransformationPanel: React.FC = () => {
  const [selectedStyle, setSelectedStyle] = useState<TransformationStyle>('orchestral');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [duration, setDuration] = useState(15);
  const [temperature, setTemperature] = useState(1.0);
  const [customPrompt, setCustomPrompt] = useState('');
  const [playingTransformation, setPlayingTransformation] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const {
    transformations,
    currentTransformation,
    isProcessing,
    error,
    createTransformation,
    cancelTransformation,
    loadTransformations,
    rateTransformation,
    stopPolling
  } = useAIStore();

  const { currentProject, currentSession } = useProjectStore();

  useEffect(() => {
    if (currentProject) {
      loadTransformations(currentProject.id);
    }
    
    return () => {
      stopPolling();
    };
  }, [currentProject, loadTransformations, stopPolling]);

  // Analyze audio duration when session changes
  useEffect(() => {
    if (currentSession?.audioBlob) {
      setIsAnalyzing(true);
      setAnalysisError(null);
      
      getAudioDuration(currentSession.audioBlob)
        .then(duration => {
          console.log('Audio analysis successful, duration:', duration);
          setAudioDuration(duration);
          setIsAnalyzing(false);
          setAnalysisError(null);
        })
        .catch(error => {
          console.error('Error analyzing audio:', error);
          setAudioDuration(null);
          setIsAnalyzing(false);
          setAnalysisError(error.message || 'Failed to analyze audio');
        });
    } else {
      setAudioDuration(null);
      setIsAnalyzing(false);
      setAnalysisError(null);
    }
  }, [currentSession?.audioBlob]);

  // Improved audio duration detection with multiple fallback methods
  const getAudioDuration = (audioBlob: Blob): Promise<number> => {
    return new Promise((resolve, reject) => {
      console.log('Starting audio analysis for blob:', audioBlob.size, 'bytes');
      
      // Method 1: Try using Audio element
      const tryAudioElement = () => {
        const audio = new Audio();
        const url = URL.createObjectURL(audioBlob);
        let resolved = false;
        
        const cleanup = () => {
          if (!resolved) {
            URL.revokeObjectURL(url);
            audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            audio.removeEventListener('durationchange', onDurationChange);
            audio.removeEventListener('canplaythrough', onCanPlayThrough);
            audio.removeEventListener('error', onError);
          }
        };
        
        const resolveWithDuration = (duration: number) => {
          if (resolved) return;
          resolved = true;
          cleanup();
          
          console.log('Audio element method succeeded, duration:', duration);
          
          // Accept any finite positive duration, including very short ones
          if (isFinite(duration) && duration > 0) {
            resolve(duration);
          } else {
            console.warn('Invalid duration from audio element:', duration);
            tryWebAudioAPI();
          }
        };
        
        const onLoadedMetadata = () => {
          console.log('Audio metadata loaded, duration:', audio.duration);
          if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
            resolveWithDuration(audio.duration);
          }
        };
        
        const onDurationChange = () => {
          console.log('Audio duration changed:', audio.duration);
          if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
            resolveWithDuration(audio.duration);
          }
        };
        
        const onCanPlayThrough = () => {
          console.log('Audio can play through, duration:', audio.duration);
          if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
            resolveWithDuration(audio.duration);
          }
        };
        
        const onError = (e: Event) => {
          console.error('Audio element error:', e);
          if (!resolved) {
            cleanup();
            tryWebAudioAPI();
          }
        };
        
        // Set timeout for this method
        const timeout = setTimeout(() => {
          if (!resolved) {
            console.log('Audio element method timed out, trying Web Audio API');
            cleanup();
            tryWebAudioAPI();
          }
        }, 5000);
        
        audio.addEventListener('loadedmetadata', onLoadedMetadata);
        audio.addEventListener('durationchange', onDurationChange);
        audio.addEventListener('canplaythrough', onCanPlayThrough);
        audio.addEventListener('error', onError);
        
        audio.preload = 'metadata';
        audio.src = url;
        audio.load();
      };

      // Method 2: Try using Web Audio API
      const tryWebAudioAPI = () => {
        console.log('Trying Web Audio API method');
        
        audioBlob.arrayBuffer()
          .then(buffer => {
            const audioContext = new AudioContext();
            return audioContext.decodeAudioData(buffer)
              .then(audioBuffer => {
                const duration = audioBuffer.duration;
                console.log('Web Audio API method succeeded, duration:', duration);
                
                audioContext.close();
                
                if (isFinite(duration) && duration > 0) {
                  resolve(duration);
                } else {
                  console.warn('Invalid duration from Web Audio API:', duration);
                  tryEstimateFromSize();
                }
              });
          })
          .catch(error => {
            console.error('Web Audio API failed:', error);
            tryEstimateFromSize();
          });
      };

      // Method 3: Estimate from file size (very rough fallback)
      const tryEstimateFromSize = () => {
        console.log('Trying size estimation method');
        
        // Very rough estimation: assume ~128kbps encoding
        // This is just a fallback and won't be very accurate
        const estimatedDuration = (audioBlob.size * 8) / (128 * 1000); // Convert to seconds
        
        console.log('Estimated duration from size:', estimatedDuration);
        
        if (estimatedDuration > 0 && estimatedDuration < 3600) { // Sanity check: less than 1 hour
          resolve(estimatedDuration);
        } else {
          reject(new Error('Could not determine audio duration'));
        }
      };

      // Start with the most reliable method
      tryAudioElement();
    });
  };

  const handleTransform = async () => {
    if (!currentProject || !currentSession?.audioBlob) {
      alert('Please record some audio first');
      return;
    }

    // Check if we have a valid duration
    if (audioDuration === null) {
      alert('Audio duration could not be determined. Please try recording again.');
      return;
    }

    // Check duration limits (more lenient for very short audio)
    if (audioDuration > 10.1) {
      alert(`The input audio must be 10 seconds or shorter for AI transformation. Current duration: ${formatDuration(audioDuration)}. Please record a shorter segment.`);
      return;
    }

    if (audioDuration < 0.5) { // Allow very short audio (0.5 seconds minimum)
      alert('Audio duration is too short. Please record at least 0.5 seconds of audio.');
      return;
    }

    const options = {
      duration,
      temperature,
      ...(customPrompt && { prompt: customPrompt })
    };

    await createTransformation(
      currentProject.id,
      currentSession.audioBlob,
      selectedStyle,
      options
    );
  };

  const handleCancel = async (transformationId: string) => {
    await cancelTransformation(transformationId);
  };

  const handleRate = async (transformationId: string, rating: number) => {
    await rateTransformation(transformationId, rating);
  };

  const handlePlayTransformation = (transformationId: string, audioUrl: string) => {
    if (playingTransformation === transformationId) {
      setPlayingTransformation(null);
      // Stop audio
    } else {
      setPlayingTransformation(transformationId);
      // Play audio
      const audio = new Audio(audioUrl);
      audio.play();
      audio.onended = () => setPlayingTransformation(null);
    }
  };

  const handleDownload = (audioUrl: string, transformationType: string) => {
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `${transformationType}-transformation-${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-400" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-400" />;
      case 'cancelled':
        return <X className="h-4 w-4 text-gray-400" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-400';
      case 'processing': return 'text-blue-400';
      case 'completed': return 'text-green-400';
      case 'failed': return 'text-red-400';
      case 'cancelled': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine audio status with more lenient validation
  const isAudioTooLong = audioDuration !== null && audioDuration > 10.1;
  const isAudioTooShort = audioDuration !== null && audioDuration < 0.5; // More lenient minimum
  const hasValidAudio = currentSession?.audioBlob && audioDuration !== null && audioDuration >= 0.5 && audioDuration <= 10.1;

  // Get audio status message
  const getAudioStatusMessage = () => {
    if (!currentSession?.audioBlob) {
      return 'Record audio first';
    }
    
    if (isAnalyzing) {
      return 'Analyzing audio...';
    }
    
    if (analysisError) {
      return `Analysis failed: ${analysisError}`;
    }
    
    if (audioDuration !== null) {
      return `Audio ready: ${formatDuration(audioDuration)}`;
    }
    
    return 'Audio analysis pending';
  };

  return (
    <div className="bg-dark-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Wand2 className="h-6 w-6 text-neon-purple" />
          <h2 className="font-righteous text-xl text-neon-purple">AI Transformation</h2>
        </div>
        <div className="text-sm text-gray-400">
          {getAudioStatusMessage()}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <span className="text-red-300 text-sm">{error}</span>
        </div>
      )}

      {/* Audio Duration Warnings */}
      {isAudioTooLong && (
        <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-yellow-400" />
          <div className="text-yellow-300 text-sm">
            <p className="font-medium">Audio too long for AI transformation</p>
            <p>Current duration: {formatDuration(audioDuration!)} • Maximum: 10 seconds</p>
            <p>Please record a shorter segment.</p>
          </div>
        </div>
      )}

      {isAudioTooShort && (
        <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-yellow-400" />
          <div className="text-yellow-300 text-sm">
            <p className="font-medium">Audio too short for AI transformation</p>
            <p>Current duration: {formatDuration(audioDuration!)} • Minimum: 0.5 seconds</p>
            <p>Please record a longer segment.</p>
          </div>
        </div>
      )}

      {analysisError && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div className="text-red-300 text-sm">
            <p className="font-medium">Audio analysis failed</p>
            <p>{analysisError}</p>
            <p>Try recording the audio again or check your microphone.</p>
          </div>
        </div>
      )}

      {isAnalyzing && (
        <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg flex items-center space-x-2">
          <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
          <div className="text-blue-300 text-sm">
            <p>Analyzing audio duration and quality...</p>
            <p className="text-xs mt-1">This may take a few seconds</p>
          </div>
        </div>
      )}

      {/* Style Selection */}
      <div className="mb-6">
        <h3 className="font-semibold text-white mb-4">Choose Transformation Style</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(TRANSFORMATION_STYLES).map(([key, style]) => (
            <button
              key={key}
              onClick={() => setSelectedStyle(key as TransformationStyle)}
              className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                selectedStyle === key
                  ? `border-${style.color} bg-${style.color}/10`
                  : 'border-gray-600 bg-dark-700/50 hover:border-gray-500'
              }`}
            >
              <div className="flex items-center space-x-3 mb-2">
                <span className="text-2xl">{style.icon}</span>
                <span className={`font-semibold ${
                  selectedStyle === key ? 'text-white' : 'text-gray-300'
                }`}>
                  {style.name}
                </span>
              </div>
              <p className="text-sm text-gray-400">{style.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Options */}
      <div className="mb-6">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-neon-blue hover:text-neon-purple transition-colors duration-200 text-sm font-medium"
        >
          {showAdvanced ? 'Hide' : 'Show'} Advanced Options
        </button>
        
        {showAdvanced && (
          <div className="mt-4 bg-dark-700/50 rounded-xl p-4 space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Duration: {formatDuration(duration)}
              </label>
              <input
                type="range"
                min="8"
                max="30"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full accent-neon-purple"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>8s</span>
                <span>30s</span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Creativity: {temperature.toFixed(1)}
              </label>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-neon-purple"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Conservative</span>
                <span>Creative</span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Custom Prompt (Optional)
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Describe the musical style you want..."
                className="w-full bg-dark-600 border border-gray-500 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-neon-purple resize-none"
                rows={2}
              />
            </div>
          </div>
        )}
      </div>

      {/* Transform Button */}
      <div className="mb-6">
        <button
          onClick={handleTransform}
          disabled={!hasValidAudio || isProcessing || isAnalyzing}
          className="w-full bg-gradient-to-r from-neon-purple to-neon-pink text-white py-3 rounded-xl font-semibold hover:shadow-neon transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Transforming...</span>
            </>
          ) : (
            <>
              <Wand2 className="h-5 w-5" />
              <span>Transform Audio</span>
            </>
          )}
        </button>
        
        {/* Button Status Messages */}
        {!currentSession?.audioBlob && (
          <p className="text-gray-400 text-xs mt-2 text-center">
            Record audio first to enable transformation
          </p>
        )}
        {isAnalyzing && (
          <p className="text-blue-400 text-xs mt-2 text-center">
            Analyzing audio duration...
          </p>
        )}
        {analysisError && (
          <p className="text-red-400 text-xs mt-2 text-center">
            Audio analysis failed - try recording again
          </p>
        )}
        {(isAudioTooLong || isAudioTooShort) && (
          <p className="text-yellow-400 text-xs mt-2 text-center">
            Audio must be between 0.5-10 seconds for transformation
          </p>
        )}
        {hasValidAudio && !isProcessing && !isAnalyzing && (
          <p className="text-green-400 text-xs mt-2 text-center">
            Ready for transformation • Duration: {formatDuration(audioDuration!)}
          </p>
        )}
      </div>

      {/* Current Transformation Status */}
      {currentTransformation && (
        <div className="mb-6 bg-dark-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-white">Current Transformation</h4>
            {currentTransformation.status === 'processing' && (
              <button
                onClick={() => handleCancel(currentTransformation.id)}
                className="text-red-400 hover:text-red-300 transition-colors duration-200 text-sm"
              >
                Cancel
              </button>
            )}
          </div>
          
          <div className="flex items-center space-x-3 mb-2">
            {getStatusIcon(currentTransformation.status)}
            <span className={`font-medium ${getStatusColor(currentTransformation.status)}`}>
              {currentTransformation.status.charAt(0).toUpperCase() + currentTransformation.status.slice(1)}
            </span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-400 capitalize">
              {currentTransformation.transformation_type}
            </span>
          </div>
          
          {currentTransformation.status === 'processing' && (
            <div className="w-full bg-dark-600 rounded-full h-2 mb-2">
              <div className="bg-gradient-to-r from-neon-blue to-neon-purple h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          )}
          
          {currentTransformation.error_message && (
            <p className="text-red-400 text-sm">{currentTransformation.error_message}</p>
          )}
        </div>
      )}

      {/* Transformations History */}
      <div>
        <h3 className="font-semibold text-white mb-4">Recent Transformations</h3>
        
        {transformations.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <Wand2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No transformations yet</p>
            <p className="text-sm">Transform your audio to see results here</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {transformations.map((transformation) => (
              <div
                key={transformation.id}
                className="bg-dark-700/50 rounded-lg p-4 border border-gray-600"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(transformation.status)}
                    <span className="font-medium text-white capitalize">
                      {transformation.transformation_type}
                    </span>
                    <span className={`text-sm ${getStatusColor(transformation.status)}`}>
                      {transformation.status}
                    </span>
                  </div>
                  
                  {transformation.status === 'completed' && transformation.output_audio_path && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handlePlayTransformation(transformation.id, transformation.output_audio_path!)}
                        className="text-neon-blue hover:text-neon-purple transition-colors duration-200"
                      >
                        {playingTransformation === transformation.id ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDownload(transformation.output_audio_path!, transformation.transformation_type)}
                        className="text-neon-green hover:text-neon-yellow transition-colors duration-200"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="text-xs text-gray-400 mb-2">
                  {new Date(transformation.created_at).toLocaleString()}
                  {transformation.processing_time_seconds && (
                    <span> • Processed in {transformation.processing_time_seconds}s</span>
                  )}
                </div>
                
                {transformation.status === 'completed' && (
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-gray-400">Rate:</span>
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => handleRate(transformation.id, rating)}
                        className={`transition-colors duration-200 ${
                          transformation.user_rating && rating <= transformation.user_rating
                            ? 'text-yellow-400'
                            : 'text-gray-600 hover:text-yellow-400'
                        }`}
                      >
                        <Star className="h-3 w-3 fill-current" />
                      </button>
                    ))}
                  </div>
                )}
                
                {transformation.error_message && (
                  <p className="text-red-400 text-xs mt-2">{transformation.error_message}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AITransformationPanel;