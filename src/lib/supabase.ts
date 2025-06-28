import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Database types
export interface Profile {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  website_url?: string;
  subscription_tier: 'free' | 'pro' | 'enterprise';
  subscription_expires_at?: string;
  total_projects: number;
  total_transformations: number;
  storage_used_mb: number;
  preferences: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  genre?: string;
  tags: string[];
  original_audio_path?: string;
  processed_audio_path?: string;
  waveform_data?: Record<string, any>;
  duration_seconds?: number;
  sample_rate: number;
  effects_settings: Record<string, any>;
  metronome_bpm: number;
  project_settings: Record<string, any>;
  status: 'draft' | 'processing' | 'completed' | 'archived';
  is_public: boolean;
  is_featured: boolean;
  play_count: number;
  like_count: number;
  download_count: number;
  created_at: string;
  updated_at: string;
  last_played_at?: string;
}