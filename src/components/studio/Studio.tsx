import React, { useState, useRef } from 'react';
import { Music, Headphones, Settings, Layers, Wand2, Download, Crown } from 'lucide-react';
import AudioRecorder from './AudioRecorder';
import EnhancedAudioPlayer from './EnhancedAudioPlayer';
import EffectsPanel from './EffectsPanel';
import ProjectManager from './ProjectManager';
import AITransformationPanel from './AITransformationPanel';
import ExportPanel from './ExportPanel';
import SubscriptionManager from '../subscription/SubscriptionManager';
import { useProjectStore } from '../../stores/projectStore';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

const Studio: React.FC = () => {
  const { currentProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState<'record' | 'effects' | 'ai' | 'export' | 'subscription'>('record');
  const streamRef = useRef<MediaStream | null>(null);
  
  // Get recording state for effects panel
  const { isRecording } = useAudioRecorder();

  const tabs = [
    { id: 'record', label: 'Record', icon: Music },
    { id: 'effects', label: 'Effects', icon: Headphones },
    { id: 'ai', label: 'AI Transform', icon: Wand2 },
    { id: 'export', label: 'Export', icon: Download },
    { id: 'subscription', label: 'Subscription', icon: Crown },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-neon-blue to-neon-purple rounded-xl flex items-center justify-center">
              <Music className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-righteous text-3xl text-white">Studio</h1>
              <p className="text-gray-400">
                {currentProject ? `Working on: ${currentProject.title}` : 'Select or create a project to get started'}
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center space-x-1 bg-dark-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-1 overflow-x-auto">
            {tabs.map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30'
                      : 'text-gray-400 hover:text-white hover:bg-dark-700/50'
                  }`}
                >
                  <IconComponent className="h-4 w-4" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Studio Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Project Management & Info */}
          <div className="lg:col-span-1 space-y-6">
            <ProjectManager />
            
            {/* Project Info */}
            {currentProject && (
              <div className="bg-dark-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
                <h3 className="font-righteous text-lg text-neon-yellow mb-4">Project Info</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className="text-white capitalize">{currentProject.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">BPM:</span>
                    <span className="text-white">{currentProject.metronome_bpm}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Sample Rate:</span>
                    <span className="text-white">{currentProject.sample_rate} Hz</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Created:</span>
                    <span className="text-white text-sm">
                      {new Date(currentProject.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Stats */}
            {currentProject && (
              <div className="bg-dark-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
                <h3 className="font-righteous text-lg text-neon-green mb-4">Session Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Recordings:</span>
                    <span className="text-white">1</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">AI Transforms:</span>
                    <span className="text-white">0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Duration:</span>
                    <span className="text-white">--:--</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Audio Tools */}
          <div className="lg:col-span-2 space-y-6">
            {/* Record Tab */}
            {activeTab === 'record' && (
              <>
                <AudioRecorder />
                <EnhancedAudioPlayer />
              </>
            )}

            {/* Effects Tab */}
            {activeTab === 'effects' && (
              <>
                <EffectsPanel 
                  isRecording={isRecording}
                  audioStream={streamRef.current}
                />
                <EnhancedAudioPlayer />
              </>
            )}

            {/* AI Transform Tab */}
            {activeTab === 'ai' && (
              <>
                <AITransformationPanel />
                <EnhancedAudioPlayer />
              </>
            )}

            {/* Export Tab */}
            {activeTab === 'export' && (
              <>
                <ExportPanel />
                <EnhancedAudioPlayer />
              </>
            )}

            {/* Subscription Tab */}
            {activeTab === 'subscription' && (
              <SubscriptionManager />
            )}

            {/* Show message when no project is selected */}
            {!currentProject && activeTab !== 'subscription' && (
              <div className="bg-dark-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-12 text-center">
                <Music className="h-16 w-16 text-gray-400 mx-auto mb-4 opacity-50" />
                <h3 className="font-righteous text-xl text-gray-400 mb-2">No Project Selected</h3>
                <p className="text-gray-500">
                  Create a new project or select an existing one to start recording and creating music.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Studio;