import { create } from 'zustand';
import { replicateAPI, ReplicatePrediction, MusicGenInput, TransformationStyle, TRANSFORMATION_STYLES } from '../lib/replicate';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';

export interface AITransformation {
  id: string;
  project_id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  transformation_type: TransformationStyle;
  input_audio_path: string;
  output_audio_path?: string;
  parameters: Record<string, any>;
  replicate_prediction_id?: string;
  error_message?: string;
  quality_score?: number;
  user_rating?: number;
  processing_time_seconds?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface AIState {
  transformations: AITransformation[];
  currentTransformation: AITransformation | null;
  isProcessing: boolean;
  error: string | null;
  
  // AI Operations
  createTransformation: (
    projectId: string,
    audioBlob: Blob,
    style: TransformationStyle,
    options?: Partial<MusicGenInput>
  ) => Promise<AITransformation | null>;
  
  checkTransformationStatus: (transformationId: string) => Promise<void>;
  cancelTransformation: (transformationId: string) => Promise<boolean>;
  loadTransformations: (projectId?: string) => Promise<void>;
  rateTransformation: (transformationId: string, rating: number, feedback?: string) => Promise<boolean>;
  
  // Real-time status updates
  pollTransformation: (transformationId: string) => void;
  stopPolling: () => void;
}

export const useAIStore = create<AIState>((set, get) => {
  let pollingInterval: NodeJS.Timeout | null = null;

  return {
    transformations: [],
    currentTransformation: null,
    isProcessing: false,
    error: null,

    createTransformation: async (
      projectId: string,
      audioBlob: Blob,
      style: TransformationStyle,
      options = {}
    ) => {
      const { user } = useAuthStore.getState();
      if (!user) return null;

      set({ isProcessing: true, error: null });

      try {
        // Ensure Replicate API key is set from environment variables
        replicateAPI.setApiKey(import.meta.env.VITE_REPLICATE_API_TOKEN || '');
        
        // Upload audio to Replicate
        const audioBase64 = await replicateAPI.uploadFile(audioBlob);
        
        // Get style configuration
        const styleConfig = TRANSFORMATION_STYLES[style];
        const prompt = styleConfig.prompts[0]; // Use first prompt as default
        
        // Prepare MusicGen input
        const musicGenInput: MusicGenInput = {
          prompt,
          model_version: 'stereo-melody-large',
          duration: Math.min(30, Math.max(8, options.duration || 15)), // Limit duration
          temperature: options.temperature || 1.0,
          audio_input: audioBase64,
          continuation: true, // Use input audio as melody guide
          ...options
        };

        // Create Replicate prediction
        const prediction = await replicateAPI.createPrediction(musicGenInput);

        // Store transformation in database
        const transformationData = {
          project_id: projectId,
          user_id: user.id,
          status: 'pending' as const,
          transformation_type: style,
          input_audio_path: '', // We'll store the blob reference
          parameters: {
            style,
            prompt,
            ...musicGenInput
          },
          replicate_prediction_id: prediction.id,
        };

        const { data, error } = await supabase
          .from('ai_transformations')
          .insert([transformationData])
          .select()
          .single();

        if (error) throw error;

        const transformation = data as AITransformation;
        
        set(state => ({
          transformations: [transformation, ...state.transformations],
          currentTransformation: transformation,
          isProcessing: false,
        }));

        // Start polling for status updates
        get().pollTransformation(transformation.id);

        return transformation;
      } catch (error) {
        console.error('Error creating AI transformation:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to create transformation',
          isProcessing: false 
        });
        return null;
      }
    },

    checkTransformationStatus: async (transformationId: string) => {
      try {
        const { data: transformation } = await supabase
          .from('ai_transformations')
          .select('*')
          .eq('id', transformationId)
          .single();

        if (!transformation || !transformation.replicate_prediction_id) return;

        // Ensure Replicate API key is set from environment variables
        replicateAPI.setApiKey(import.meta.env.VITE_REPLICATE_API_TOKEN || '');

        // Check Replicate status
        const prediction = await replicateAPI.getPrediction(transformation.replicate_prediction_id);
        
        let updates: Partial<AITransformation> = {
          status: prediction.status as AITransformation['status']
        };

        if (prediction.status === 'processing' && !transformation.started_at) {
          updates.started_at = new Date().toISOString();
        }

        if (prediction.status === 'succeeded') {
          updates.completed_at = new Date().toISOString();
          updates.output_audio_path = Array.isArray(prediction.output) 
            ? prediction.output[0] 
            : prediction.output;
          
          if (transformation.started_at) {
            const processingTime = (new Date().getTime() - new Date(transformation.started_at).getTime()) / 1000;
            updates.processing_time_seconds = Math.round(processingTime);
          }
        }

        if (prediction.status === 'failed') {
          updates.error_message = prediction.error || 'Processing failed';
          updates.completed_at = new Date().toISOString();
        }

        // Update database
        const { data: updatedTransformation } = await supabase
          .from('ai_transformations')
          .update(updates)
          .eq('id', transformationId)
          .select()
          .single();

        if (updatedTransformation) {
          set(state => ({
            transformations: state.transformations.map(t => 
              t.id === transformationId ? updatedTransformation as AITransformation : t
            ),
            currentTransformation: state.currentTransformation?.id === transformationId 
              ? updatedTransformation as AITransformation 
              : state.currentTransformation
          }));

          // Stop polling if completed
          if (['completed', 'failed', 'cancelled'].includes(prediction.status)) {
            get().stopPolling();
          }
        }
      } catch (error) {
        console.error('Error checking transformation status:', error);
      }
    },

    cancelTransformation: async (transformationId: string) => {
      try {
        const { data: transformation } = await supabase
          .from('ai_transformations')
          .select('replicate_prediction_id')
          .eq('id', transformationId)
          .single();

        if (transformation?.replicate_prediction_id) {
          // Ensure Replicate API key is set from environment variables
          replicateAPI.setApiKey(import.meta.env.VITE_REPLICATE_API_TOKEN || '');
          await replicateAPI.cancelPrediction(transformation.replicate_prediction_id);
        }

        const { error } = await supabase
          .from('ai_transformations')
          .update({ 
            status: 'cancelled',
            completed_at: new Date().toISOString()
          })
          .eq('id', transformationId);

        if (error) throw error;

        set(state => ({
          transformations: state.transformations.map(t => 
            t.id === transformationId 
              ? { ...t, status: 'cancelled' as const, completed_at: new Date().toISOString() }
              : t
          )
        }));

        get().stopPolling();
        return true;
      } catch (error) {
        console.error('Error cancelling transformation:', error);
        return false;
      }
    },

    loadTransformations: async (projectId?: string) => {
      const { user } = useAuthStore.getState();
      if (!user) return;

      try {
        let query = supabase
          .from('ai_transformations')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (projectId) {
          query = query.eq('project_id', projectId);
        }

        const { data, error } = await query;

        if (error) throw error;

        set({ transformations: data as AITransformation[] });
      } catch (error) {
        console.error('Error loading transformations:', error);
        set({ error: 'Failed to load transformations' });
      }
    },

    rateTransformation: async (transformationId: string, rating: number, feedback?: string) => {
      try {
        const updates: any = { user_rating: rating };
        if (feedback) {
          updates.user_feedback = feedback;
        }

        const { error } = await supabase
          .from('ai_transformations')
          .update(updates)
          .eq('id', transformationId);

        if (error) throw error;

        set(state => ({
          transformations: state.transformations.map(t => 
            t.id === transformationId 
              ? { ...t, user_rating: rating }
              : t
          )
        }));

        return true;
      } catch (error) {
        console.error('Error rating transformation:', error);
        return false;
      }
    },

    pollTransformation: (transformationId: string) => {
      // Clear existing polling
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }

      // Poll every 3 seconds
      pollingInterval = setInterval(() => {
        get().checkTransformationStatus(transformationId);
      }, 3000);

      // Initial check
      get().checkTransformationStatus(transformationId);
    },

    stopPolling: () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    }
  };
});