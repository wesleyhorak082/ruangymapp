import { supabase } from './supabase';

export interface TrainerRating {
  id: string;
  user_id: string;
  trainer_id: string;
  rating: number;
  review_text?: string;
  created_at: string;
  updated_at: string;
}

export interface TrainerRatingStats {
  average_rating: number;
  total_ratings: number;
}

/**
 * Rate a trainer (create or update rating)
 */
export const rateTrainer = async (
  trainerId: string, 
  rating: number, 
  reviewText?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (rating < 1 || rating > 5) {
      return { success: false, error: 'Rating must be between 1 and 5' };
    }

    // Get the current user ID
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      return { success: false, error: 'Authentication error' };
    }
    
    if (!user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    // Check if user is connected to this trainer
    const { data: connection, error: connectionError } = await supabase
      .from('trainer_user_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('trainer_id', trainerId)
      .eq('status', 'active')
      .single();

    if (connectionError) {
      return { success: false, error: 'Failed to check trainer connection' };
    }
    
    if (!connection) {
      return { success: false, error: 'You can only rate trainers you are connected to' };
    }

    // Try to insert new rating, if it fails due to unique constraint, update existing
    const { error: insertError } = await supabase
      .from('trainer_ratings')
      .upsert({
        user_id: user.id,
        trainer_id: trainerId,
        rating,
        review_text: reviewText,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,trainer_id'
      });

    if (insertError) {
      console.error('Error rating trainer:', insertError);
      return { success: false, error: 'Failed to save rating' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in rateTrainer:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
};

/**
 * Get average rating and total ratings for a trainer
 */
export const getTrainerRatingStats = async (trainerId: string): Promise<TrainerRatingStats | null> => {
  try {
    const { data, error } = await supabase
      .rpc('get_trainer_average_rating', { trainer_uuid: trainerId });

    if (error) {
      console.error('Error getting trainer rating stats:', error);
      return null;
    }

    if (data && data.length > 0) {
      return {
        average_rating: parseFloat(data[0].average_rating) || 0,
        total_ratings: Number(data[0].total_ratings) || 0
      };
    }

    return { average_rating: 0, total_ratings: 0 };
  } catch (error) {
    console.error('Error in getTrainerRatingStats:', error);
    return null;
  }
};

/**
 * Get user's rating for a specific trainer
 */
export const getUserTrainerRating = async (trainerId: string): Promise<number> => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error('Error getting user auth:', authError);
      return 0;
    }
    
    if (!user?.id) {
      return 0;
    }
    
    const { data, error } = await supabase
      .rpc('get_user_trainer_rating', { 
        user_uuid: user.id,
        trainer_uuid: trainerId 
      });

    if (error) {
      console.error('Error getting user trainer rating:', error);
      return 0;
    }

    return data || 0;
  } catch (error) {
    console.error('Error in getUserTrainerRating:', error);
    return 0;
  }
};

/**
 * Get all ratings for a trainer (for admin purposes)
 */
export const getTrainerRatings = async (trainerId: string): Promise<TrainerRating[]> => {
  try {
    const { data, error } = await supabase
      .from('trainer_ratings')
      .select('*')
      .eq('trainer_id', trainerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting trainer ratings:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getTrainerRatings:', error);
    return [];
  }
};
