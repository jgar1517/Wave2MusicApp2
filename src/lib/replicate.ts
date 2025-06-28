import { useAuthStore } from '../stores/authStore';

const REPLICATE_API_URL = 'https://api.replicate.com/v1';

export interface ReplicateModel {
  id: string;
  name: string;
  description: string;
  version: string;
  input_schema: Record<string, any>;
}

export interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  input: Record<string, any>;
  output?: string | string[];
  error?: string;
  logs?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  urls: {
    get: string;
    cancel: string;
  };
}

export interface MusicGenInput {
  prompt: string;
  model_version?: 'stereo-melody-large' | 'melody-large' | 'large';
  duration?: number;
  temperature?: number;
  top_k?: number;
  top_p?: number;
  classifier_free_guidance?: number;
  seed?: number;
  audio_input?: string; // Base64 encoded audio or URL
  continuation?: boolean;
}

class ReplicateAPI {
  private apiKey: string | null = null;

  constructor() {
    // In a real app, this would come from environment variables
    // For now, we'll use a placeholder that needs to be set by the user
    this.apiKey = import.meta.env.VITE_REPLICATE_API_TOKEN || null;
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    if (!this.apiKey) {
      throw new Error('Replicate API key not configured');
    }

    const response = await fetch(`${REPLICATE_API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Token ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async createPrediction(input: MusicGenInput): Promise<ReplicatePrediction> {
    const modelVersion = "afiaka87/tortoise-tts:e9658de4b325863c4fcdc12d94bb7c9b54cbfe351b7ca1b36860008172b91c71";
    
    // For MusicGen, we'll use the Facebook MusicGen model
    const musicGenVersion = "meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb";
    
    return this.makeRequest('/predictions', {
      method: 'POST',
      body: JSON.stringify({
        version: musicGenVersion,
        input: {
          prompt: input.prompt,
          model_version: input.model_version || 'stereo-melody-large',
          duration: input.duration || 8,
          temperature: input.temperature || 1.0,
          top_k: input.top_k || 250,
          top_p: input.top_p || 0.0,
          classifier_free_guidance: input.classifier_free_guidance || 3.0,
          seed: input.seed,
          ...(input.audio_input && { 
            melody: input.audio_input,
            continuation: input.continuation || false
          })
        },
      }),
    });
  }

  async getPrediction(id: string): Promise<ReplicatePrediction> {
    return this.makeRequest(`/predictions/${id}`);
  }

  async cancelPrediction(id: string): Promise<ReplicatePrediction> {
    return this.makeRequest(`/predictions/${id}/cancel`, {
      method: 'POST',
    });
  }

  async uploadFile(file: Blob): Promise<string> {
    // Convert blob to base64 for Replicate
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

export const replicateAPI = new ReplicateAPI();

// Predefined transformation styles
export const TRANSFORMATION_STYLES = {
  orchestral: {
    name: 'Orchestral',
    description: 'Transform into a full orchestral arrangement',
    prompts: [
      'orchestral arrangement with strings, brass, and woodwinds',
      'classical symphony orchestra with rich harmonies',
      'cinematic orchestral score with dramatic dynamics',
      'romantic period orchestra with lush strings'
    ],
    icon: '🎼',
    color: 'neon-blue'
  },
  electronic: {
    name: 'Electronic',
    description: 'Convert to electronic/EDM style',
    prompts: [
      'electronic dance music with synthesizers and beats',
      'ambient electronic with atmospheric pads',
      'techno with driving bassline and percussion',
      'synthwave with retro electronic sounds'
    ],
    icon: '🎛️',
    color: 'neon-purple'
  },
  jazz: {
    name: 'Jazz',
    description: 'Transform into jazz arrangement',
    prompts: [
      'jazz ensemble with piano, bass, and drums',
      'smooth jazz with saxophone and guitar',
      'bebop jazz with complex harmonies',
      'latin jazz with percussion and brass'
    ],
    icon: '🎷',
    color: 'neon-yellow'
  },
  rock: {
    name: 'Rock',
    description: 'Convert to rock/metal style',
    prompts: [
      'rock band with electric guitars and drums',
      'heavy metal with distorted guitars',
      'classic rock with guitar solos',
      'progressive rock with complex arrangements'
    ],
    icon: '🎸',
    color: 'neon-pink'
  },
  acoustic: {
    name: 'Acoustic',
    description: 'Transform to acoustic instruments',
    prompts: [
      'acoustic guitar and vocals',
      'folk music with acoustic instruments',
      'unplugged acoustic arrangement',
      'singer-songwriter style with guitar'
    ],
    icon: '🎸',
    color: 'neon-green'
  },
  ambient: {
    name: 'Ambient',
    description: 'Create atmospheric ambient music',
    prompts: [
      'ambient soundscape with ethereal textures',
      'atmospheric music with reverb and delay',
      'meditative ambient with soft tones',
      'space ambient with cosmic sounds'
    ],
    icon: '🌌',
    color: 'neon-blue'
  }
};

export type TransformationStyle = keyof typeof TRANSFORMATION_STYLES;