import React, { useState, useEffect } from 'react';
import { Sliders, Volume2, Zap, Waves, Music, RotateCcw, Power } from 'lucide-react';
import { useAudioEffects, EffectParameters } from '../../hooks/useAudioEffects';

interface EffectsPanelProps {
  isRecording?: boolean;
  audioStream?: MediaStream | null;
}

const EffectsPanel: React.FC<EffectsPanelProps> = ({ isRecording = false, audioStream = null }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [activeEffects, setActiveEffects] = useState<string[]>([]);
  const [parameters, setParameters] = useState<EffectParameters>({
    reverb: {
      roomSize: 0.3,
      damping: 0.5,
      wetLevel: 0.3,
      dryLevel: 0.7,
    },
    delay: {
      delayTime: 0.3,
      feedback: 0.25,
      wetLevel: 0.3,
      dryLevel: 0.7,
    },
    chorus: {
      rate: 1.5,
      depth: 0.3,
      wetLevel: 0.4,
      dryLevel: 0.6,
    },
    equalizer: {
      lowGain: 0,
      midGain: 0,
      highGain: 0,
    },
    compressor: {
      threshold: -24,
      ratio: 3,
      attack: 0.003,
      release: 0.25,
    },
  });

  const { initializeAudioContext, applyEffects, updateEffectParameter, cleanup, defaultParameters } = useAudioEffects();

  // Initialize audio context when recording starts
  useEffect(() => {
    if (isRecording && audioStream && isEnabled) {
      initializeAudioContext(audioStream);
    } else if (!isRecording) {
      cleanup();
    }
  }, [isRecording, audioStream, isEnabled, initializeAudioContext, cleanup]);

  // Apply effects when parameters change
  useEffect(() => {
    if (isRecording && isEnabled) {
      applyEffects(activeEffects, parameters);
    }
  }, [activeEffects, parameters, isRecording, isEnabled, applyEffects]);

  const toggleEffect = (effectName: string) => {
    setActiveEffects(prev => 
      prev.includes(effectName)
        ? prev.filter(name => name !== effectName)
        : [...prev, effectName]
    );
  };

  const updateParameter = (effectType: keyof EffectParameters, parameterName: string, value: number) => {
    setParameters(prev => ({
      ...prev,
      [effectType]: {
        ...prev[effectType],
        [parameterName]: value,
      },
    }));
    
    updateEffectParameter(effectType, parameterName, value);
  };

  const resetParameters = () => {
    setParameters(defaultParameters);
    setActiveEffects([]);
  };

  const effectsConfig = [
    {
      name: 'equalizer',
      label: 'Equalizer',
      icon: Sliders,
      color: 'neon-blue',
      description: 'Adjust frequency response',
    },
    {
      name: 'compressor',
      label: 'Compressor',
      icon: Volume2,
      color: 'neon-purple',
      description: 'Dynamic range control',
    },
    {
      name: 'reverb',
      label: 'Reverb',
      icon: Waves,
      color: 'neon-green',
      description: 'Add spatial depth',
    },
    {
      name: 'delay',
      label: 'Delay',
      icon: Zap,
      color: 'neon-yellow',
      description: 'Echo and repeat effects',
    },
    {
      name: 'chorus',
      label: 'Chorus',
      icon: Music,
      color: 'neon-pink',
      description: 'Thicken and widen sound',
    },
  ];

  return (
    <div className="bg-dark-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Sliders className="h-6 w-6 text-neon-blue" />
          <h2 className="font-righteous text-xl text-neon-blue">Effects Panel</h2>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={resetParameters}
            className="text-gray-400 hover:text-white transition-colors duration-200"
            title="Reset all parameters"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
          <button
            onClick={() => setIsEnabled(!isEnabled)}
            className={`p-2 rounded-lg transition-all duration-200 ${
              isEnabled
                ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30'
                : 'bg-gray-700 text-gray-400 border border-gray-600'
            }`}
            title={isEnabled ? 'Disable effects' : 'Enable effects'}
          >
            <Power className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Effects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {effectsConfig.map((effect) => {
          const IconComponent = effect.icon;
          const isActive = activeEffects.includes(effect.name);
          
          return (
            <button
              key={effect.name}
              onClick={() => toggleEffect(effect.name)}
              disabled={!isEnabled}
              className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                isActive
                  ? `border-${effect.color} bg-${effect.color}/10`
                  : 'border-gray-600 bg-dark-700/50 hover:border-gray-500'
              } ${!isEnabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center space-x-3 mb-2">
                <IconComponent className={`h-5 w-5 ${isActive ? `text-${effect.color}` : 'text-gray-400'}`} />
                <span className={`font-semibold ${isActive ? 'text-white' : 'text-gray-300'}`}>
                  {effect.label}
                </span>
              </div>
              <p className="text-sm text-gray-400">{effect.description}</p>
            </button>
          );
        })}
      </div>

      {/* Parameter Controls */}
      {activeEffects.length > 0 && isEnabled && (
        <div className="space-y-6">
          <h3 className="font-semibold text-white">Effect Parameters</h3>
          
          {/* Equalizer Controls */}
          {activeEffects.includes('equalizer') && (
            <div className="bg-dark-700/50 rounded-xl p-4">
              <h4 className="font-semibold text-neon-blue mb-4">Equalizer</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Low ({parameters.equalizer.lowGain.toFixed(1)} dB)</label>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="0.5"
                    value={parameters.equalizer.lowGain}
                    onChange={(e) => updateParameter('equalizer', 'lowGain', parseFloat(e.target.value))}
                    className="w-full accent-neon-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Mid ({parameters.equalizer.midGain.toFixed(1)} dB)</label>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="0.5"
                    value={parameters.equalizer.midGain}
                    onChange={(e) => updateParameter('equalizer', 'midGain', parseFloat(e.target.value))}
                    className="w-full accent-neon-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">High ({parameters.equalizer.highGain.toFixed(1)} dB)</label>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="0.5"
                    value={parameters.equalizer.highGain}
                    onChange={(e) => updateParameter('equalizer', 'highGain', parseFloat(e.target.value))}
                    className="w-full accent-neon-blue"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Reverb Controls */}
          {activeEffects.includes('reverb') && (
            <div className="bg-dark-700/50 rounded-xl p-4">
              <h4 className="font-semibold text-neon-green mb-4">Reverb</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Room Size ({(parameters.reverb.roomSize * 100).toFixed(0)}%)</label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={parameters.reverb.roomSize}
                    onChange={(e) => updateParameter('reverb', 'roomSize', parseFloat(e.target.value))}
                    className="w-full accent-neon-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Damping ({(parameters.reverb.damping * 100).toFixed(0)}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={parameters.reverb.damping}
                    onChange={(e) => updateParameter('reverb', 'damping', parseFloat(e.target.value))}
                    className="w-full accent-neon-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Wet Level ({(parameters.reverb.wetLevel * 100).toFixed(0)}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={parameters.reverb.wetLevel}
                    onChange={(e) => updateParameter('reverb', 'wetLevel', parseFloat(e.target.value))}
                    className="w-full accent-neon-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Dry Level ({(parameters.reverb.dryLevel * 100).toFixed(0)}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={parameters.reverb.dryLevel}
                    onChange={(e) => updateParameter('reverb', 'dryLevel', parseFloat(e.target.value))}
                    className="w-full accent-neon-green"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Delay Controls */}
          {activeEffects.includes('delay') && (
            <div className="bg-dark-700/50 rounded-xl p-4">
              <h4 className="font-semibold text-neon-yellow mb-4">Delay</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Delay Time ({(parameters.delay.delayTime * 1000).toFixed(0)}ms)</label>
                  <input
                    type="range"
                    min="0.05"
                    max="1"
                    step="0.05"
                    value={parameters.delay.delayTime}
                    onChange={(e) => updateParameter('delay', 'delayTime', parseFloat(e.target.value))}
                    className="w-full accent-neon-yellow"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Feedback ({(parameters.delay.feedback * 100).toFixed(0)}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="0.8"
                    step="0.05"
                    value={parameters.delay.feedback}
                    onChange={(e) => updateParameter('delay', 'feedback', parseFloat(e.target.value))}
                    className="w-full accent-neon-yellow"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Wet Level ({(parameters.delay.wetLevel * 100).toFixed(0)}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={parameters.delay.wetLevel}
                    onChange={(e) => updateParameter('delay', 'wetLevel', parseFloat(e.target.value))}
                    className="w-full accent-neon-yellow"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Dry Level ({(parameters.delay.dryLevel * 100).toFixed(0)}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={parameters.delay.dryLevel}
                    onChange={(e) => updateParameter('delay', 'dryLevel', parseFloat(e.target.value))}
                    className="w-full accent-neon-yellow"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Chorus Controls */}
          {activeEffects.includes('chorus') && (
            <div className="bg-dark-700/50 rounded-xl p-4">
              <h4 className="font-semibold text-neon-pink mb-4">Chorus</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Rate ({parameters.chorus.rate.toFixed(1)} Hz)</label>
                  <input
                    type="range"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={parameters.chorus.rate}
                    onChange={(e) => updateParameter('chorus', 'rate', parseFloat(e.target.value))}
                    className="w-full accent-neon-pink"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Depth ({(parameters.chorus.depth * 100).toFixed(0)}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={parameters.chorus.depth}
                    onChange={(e) => updateParameter('chorus', 'depth', parseFloat(e.target.value))}
                    className="w-full accent-neon-pink"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Wet Level ({(parameters.chorus.wetLevel * 100).toFixed(0)}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={parameters.chorus.wetLevel}
                    onChange={(e) => updateParameter('chorus', 'wetLevel', parseFloat(e.target.value))}
                    className="w-full accent-neon-pink"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Dry Level ({(parameters.chorus.dryLevel * 100).toFixed(0)}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={parameters.chorus.dryLevel}
                    onChange={(e) => updateParameter('chorus', 'dryLevel', parseFloat(e.target.value))}
                    className="w-full accent-neon-pink"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Compressor Controls */}
          {activeEffects.includes('compressor') && (
            <div className="bg-dark-700/50 rounded-xl p-4">
              <h4 className="font-semibold text-neon-purple mb-4">Compressor</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Threshold ({parameters.compressor.threshold.toFixed(1)} dB)</label>
                  <input
                    type="range"
                    min="-60"
                    max="0"
                    step="1"
                    value={parameters.compressor.threshold}
                    onChange={(e) => updateParameter('compressor', 'threshold', parseFloat(e.target.value))}
                    className="w-full accent-neon-purple"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Ratio ({parameters.compressor.ratio.toFixed(1)}:1)</label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="0.5"
                    value={parameters.compressor.ratio}
                    onChange={(e) => updateParameter('compressor', 'ratio', parseFloat(e.target.value))}
                    className="w-full accent-neon-purple"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Attack ({(parameters.compressor.attack * 1000).toFixed(1)}ms)</label>
                  <input
                    type="range"
                    min="0.001"
                    max="0.1"
                    step="0.001"
                    value={parameters.compressor.attack}
                    onChange={(e) => updateParameter('compressor', 'attack', parseFloat(e.target.value))}
                    className="w-full accent-neon-purple"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Release ({(parameters.compressor.release * 1000).toFixed(0)}ms)</label>
                  <input
                    type="range"
                    min="0.01"
                    max="1"
                    step="0.01"
                    value={parameters.compressor.release}
                    onChange={(e) => updateParameter('compressor', 'release', parseFloat(e.target.value))}
                    className="w-full accent-neon-purple"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status */}
      <div className="mt-6 text-center">
        {!isEnabled && (
          <p className="text-gray-400 text-sm">Enable effects to start processing audio</p>
        )}
        {isEnabled && !isRecording && (
          <p className="text-yellow-400 text-sm">Effects ready - start recording to hear them</p>
        )}
        {isEnabled && isRecording && activeEffects.length === 0 && (
          <p className="text-blue-400 text-sm">Select effects to apply to your recording</p>
        )}
        {isEnabled && isRecording && activeEffects.length > 0 && (
          <p className="text-green-400 text-sm">
            {activeEffects.length} effect{activeEffects.length > 1 ? 's' : ''} active
          </p>
        )}
      </div>
    </div>
  );
};

export default EffectsPanel;