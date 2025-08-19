import { createClient } from '@supabase/supabase-js';

// Get environment variables with fallbacks
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 
  'https://example-project.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
  'your-anon-key-here';

// Validate environment variables
if (!supabaseUrl || supabaseUrl === 'https://example-project.supabase.co') {
  console.warn('⚠️ EXPO_PUBLIC_SUPABASE_URL not set or using default value');
}

if (!supabaseAnonKey || supabaseAnonKey === 'your-anon-key-here') {
  console.warn('⚠️ EXPO_PUBLIC_SUPABASE_ANON_KEY not set or using default value');
}

// Create Supabase client with enhanced configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'X-Client-Info': 'ruangymapp/1.0.0',
      'User-Agent': 'RuanGymApp-Mobile/1.0.0',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'X-Platform': 'mobile',
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Test connection function
export const testSupabaseConnection = async () => {
  try {
    console.log('🔍 Testing Supabase connection...');
    console.log('URL:', supabaseUrl);
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('❌ Connection test failed:', error.message);
      return false;
    }
    
    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.error('❌ Connection test error:', error);
    return false;
  }
};

export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          username: string | null;
          full_name: string | null;
          avatar_url: string | null;
          user_type: string;
          age: number | null;
          sex: string | null;
          phone: string | null;
          bio: string | null;
          subscription_end: string | null;
          is_blocked: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          user_type?: string;
          age?: number | null;
          sex?: string | null;
          phone?: string | null;
          bio?: string | null;
          subscription_end?: string | null;
          is_blocked?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          user_type?: string;
          age?: number | null;
          sex?: string | null;
          phone?: string | null;
          bio?: string | null;
          subscription_end?: string | null;
          is_blocked?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      admin_profiles: {
        Row: {
          id: string;
          email: string;
          username: string;
          full_name: string;
          role: string;
          permissions: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          username: string;
          full_name: string;
          role?: string;
          permissions?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          username?: string;
          full_name?: string;
          role?: string;
          permissions?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      trainer_profiles: {
        Row: {
          id: string;
          specialty: string;
          bio: string | null;
          hourly_rate: number;
          rating: number;
          availability: any;
          experience_years: number;
          certifications: string[];
          is_available: boolean;
          location: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          zip_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          specialty: string;
          bio?: string | null;
          hourly_rate?: number;
          rating?: number;
          availability?: any;
          experience_years?: number;
          certifications?: string[];
          is_available?: boolean;
          location?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          specialty?: string;
          bio?: string | null;
          hourly_rate?: number;
          rating?: number;
          availability?: any;
          experience_years?: number;
          certifications?: string[];
          is_available?: boolean;
          location?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      shop_products: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          price: number;
          category: string;
          image_url: string | null;
          stock_quantity: number;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          price: number;
          category: string;
          image_url?: string | null;
          stock_quantity?: number;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          price?: number;
          category?: string;
          image_url?: string | null;
          stock_quantity?: number;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan_name: string;
          start_date: string;
          end_date: string;
          status: string;
          monthly_fee: number;
          payment_method: string | null;
          auto_renew: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_name: string;
          start_date: string;
          end_date: string;
          status?: string;
          monthly_fee: number;
          payment_method?: string | null;
          auto_renew?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan_name?: string;
          start_date?: string;
          end_date?: string;
          status?: string;
          monthly_fee?: number;
          payment_method?: string | null;
          auto_renew?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      trainer_bookings: {
        Row: {
          id: string;
          trainer_id: string;
          user_id: string;
          scheduled_at: string;
          status: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          user_id: string;
          scheduled_at: string;
          status?: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          user_id?: string;
          scheduled_at?: string;
          status?: string;
          notes?: string | null;
          created_at?: string;
        };
      };
      user_measurements: {
        Row: {
          id: string;
          user_id: string;
          measurement_name: string;
          current_value: string;
          previous_value: string;
          change_value: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          measurement_name: string;
          current_value: string;
          previous_value?: string;
          change_value?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          measurement_name?: string;
          current_value?: string;
          previous_value?: string;
          change_value?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_workouts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          exercises: any;
          duration: number;
          completed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          exercises?: any;
          duration?: number;
          completed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          exercises?: any;
          duration?: number;
          completed?: boolean;
          created_at?: string;
        };
      };
      exercise_sets: {
        Row: {
          id: string;
          user_id: string;
          exercise_name: string;
          workout_date: string;
          set_number: number;
          weight_kg: number;
          reps: number;
          rest_seconds: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          exercise_name: string;
          workout_date: string;
          set_number: number;
          weight_kg: number;
          reps: number;
          rest_seconds?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          exercise_name?: string;
          workout_date?: string;
          set_number?: number;
          weight_kg?: number;
          reps?: number;
          rest_seconds?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      exercise_workouts: {
        Row: {
          id: string;
          user_id: string;
          workout_name: string;
          workout_date: string;
          duration_minutes: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workout_name: string;
          workout_date: string;
          duration_minutes?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          workout_name?: string;
          workout_date?: string;
          duration_minutes?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      exercise_progress: {
        Row: {
          id: string;
          user_id: string;
          exercise_name: string;
          date: string;
          max_weight: number | null;
          max_reps: number | null;
          total_volume: number | null;
          sets_completed: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          exercise_name: string;
          date: string;
          max_weight?: number | null;
          max_reps?: number | null;
          total_volume?: number | null;
          sets_completed?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          exercise_name?: string;
          date?: string;
          max_weight?: number | null;
          max_reps?: number | null;
          total_volume?: number | null;
          sets_completed?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      gym_checkins: {
        Row: {
          id: string;
          user_id: string;
          user_type: string;
          check_in_time: string;
          check_out_time: string | null;
          is_checked_in: boolean;
          check_in_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          user_type?: string;
          check_in_time?: string;
          check_out_time?: string | null;
          is_checked_in?: boolean;
          check_in_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          user_type?: string;
          check_in_time?: string;
          check_out_time?: string | null;
          is_checked_in?: boolean;
          check_in_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};