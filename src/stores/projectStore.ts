import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  genre?: string;
  tags: string[];
  original_audio_path?: string;
  processed_audio_path?: string;
  waveform_data?: {
    peaks: number[];
    duration: number;
  };
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

export interface AudioSession {
  id: string;
  projectId: string;
  audioBlob?: Blob;
  audioUrl?: string;
  waveformData?: {
    peaks: number[];
    duration: number;
  };
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  currentSession: AudioSession | null;
  loading: boolean;
  error: string | null;
  
  // Project management
  createProject: (title: string, description?: string) => Promise<Project | null>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<boolean>;
  deleteProject: (id: string) => Promise<boolean>;
  loadProjects: () => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
  
  // Audio session management
  createSession: (projectId: string, audioBlob: Blob) => Promise<void>;
  updateSession: (updates: Partial<AudioSession>) => void;
  clearSession: () => void;
  
  // Audio playback
  playAudio: () => void;
  pauseAudio: () => void;
  seekAudio: (time: number) => void;
}

// Helper function to get audio duration from blob
const getAudioDurationFromBlob = (audioBlob: Blob): Promise<number> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(audioBlob);
    
    const cleanup = () => {
      URL.revokeObjectURL(url);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('error', onError);
    };
    
    const onLoadedMetadata = () => {
      const duration = audio.duration;
      cleanup();
      
      // Only reject for truly invalid numerical durations (NaN or Infinity)
      if (isNaN(duration) || !isFinite(duration)) {
        reject(new Error('Invalid audio duration'));
      } else {
        // Resolve with the actual duration, even if it's 0 or negative
        resolve(duration);
      }
    };
    
    const onError = () => {
      cleanup();
      reject(new Error('Failed to load audio metadata'));
    };
    
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('error', onError);
    
    // Set a timeout to prevent hanging
    setTimeout(() => {
      cleanup();
      reject(new Error('Audio loading timeout'));
    }, 10000);
    
    audio.src = url;
    audio.load();
  });
};

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  currentSession: null,
  loading: false,
  error: null,

  createProject: async (title: string, description?: string) => {
    const { user } = useAuthStore.getState();
    if (!user) return null;

    set({ loading: true, error: null });

    try {
      const newProject = {
        user_id: user.id,
        title,
        description: description || '',
        genre: '',
        tags: [],
        sample_rate: 44100,
        effects_settings: {},
        metronome_bpm: 120,
        project_settings: {},
        status: 'draft' as const,
        is_public: false,
        is_featured: false,
        play_count: 0,
        like_count: 0,
        download_count: 0,
      };

      const { data, error } = await supabase
        .from('projects')
        .insert([newProject])
        .select()
        .single();

      if (error) throw error;

      const project = data as Project;
      set(state => ({
        projects: [project, ...state.projects],
        currentProject: project,
        loading: false,
      }));

      return project;
    } catch (error) {
      console.error('Error creating project:', error);
      set({ error: 'Failed to create project', loading: false });
      return null;
    }
  },

  updateProject: async (id: string, updates: Partial<Project>) => {
    set({ loading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const updatedProject = data as Project;
      set(state => ({
        projects: state.projects.map(p => p.id === id ? updatedProject : p),
        currentProject: state.currentProject?.id === id ? updatedProject : state.currentProject,
        loading: false,
      }));

      return true;
    } catch (error) {
      console.error('Error updating project:', error);
      set({ error: 'Failed to update project', loading: false });
      return false;
    }
  },

  deleteProject: async (id: string) => {
    set({ loading: true, error: null });

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set(state => ({
        projects: state.projects.filter(p => p.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject,
        loading: false,
      }));

      return true;
    } catch (error) {
      console.error('Error deleting project:', error);
      set({ error: 'Failed to delete project', loading: false });
      return false;
    }
  },

  loadProjects: async () => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    set({ loading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      set({ projects: data as Project[], loading: false });
    } catch (error) {
      console.error('Error loading projects:', error);
      set({ error: 'Failed to load projects', loading: false });
    }
  },

  setCurrentProject: (project: Project | null) => {
    set({ currentProject: project });
  },

  createSession: async (projectId: string, audioBlob: Blob) => {
    try {
      // First, get the actual duration from the audio blob
      const duration = await getAudioDurationFromBlob(audioBlob);
      
      // Create the audio URL
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const session: AudioSession = {
        id: `session-${Date.now()}`,
        projectId,
        audioBlob,
        audioUrl,
        isPlaying: false,
        currentTime: 0,
        duration, // Use the actual detected duration
      };

      set({ currentSession: session });
      
      console.log('Session created with duration:', duration);
    } catch (error) {
      console.error('Error creating session:', error);
      
      // Fallback: create session without duration, will be detected later
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const session: AudioSession = {
        id: `session-${Date.now()}`,
        projectId,
        audioBlob,
        audioUrl,
        isPlaying: false,
        currentTime: 0,
        duration: 0, // Will be updated when audio loads
      };

      set({ currentSession: session });
    }
  },

  updateSession: (updates: Partial<AudioSession>) => {
    set(state => ({
      currentSession: state.currentSession ? {
        ...state.currentSession,
        ...updates,
      } : null,
    }));
  },

  clearSession: () => {
    const { currentSession } = get();
    if (currentSession?.audioUrl) {
      URL.revokeObjectURL(currentSession.audioUrl);
    }
    set({ currentSession: null });
  },

  playAudio: () => {
    set(state => ({
      currentSession: state.currentSession ? {
        ...state.currentSession,
        isPlaying: true,
      } : null,
    }));
  },

  pauseAudio: () => {
    set(state => ({
      currentSession: state.currentSession ? {
        ...state.currentSession,
        isPlaying: false,
      } : null,
    }));
  },

  seekAudio: (time: number) => {
    set(state => ({
      currentSession: state.currentSession ? {
        ...state.currentSession,
        currentTime: time,
      } : null,
    }));
  },
}));