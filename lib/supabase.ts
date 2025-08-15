import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

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