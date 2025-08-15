import { supabase } from './supabase';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  unlocked: boolean;
  unlockedAt?: string;
  category: 'workout' | 'streak' | 'goal' | 'special' | 'checkin';
  requirement_type: 'count' | 'streak' | 'goal' | 'special';
  requirement_value: number;
  requirement_description: string;
}

export interface Challenge {
  id: string;
  name: string;
  description: string;
  type: 'weekly' | 'monthly' | 'special';
  target: number;
  current: number;
  reward: number;
  endDate: string;
  active: boolean;
  challenge_category: string;
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  fullName: string;
  points: number;
  level: number;
  rank: number;
  avatar?: string;
}

export interface UserStats {
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  level: number;
  rank: number;
  totalWorkoutDays: number; // Changed from totalWorkouts to totalWorkoutDays
  totalCheckins: number;
  totalGoalsAchieved: number;
  achievementsUnlocked: number;
  challengesCompleted: number;
  streakFrozen: boolean;
  streakFrozenAt: string | null;
  streakFreezeUsedThisWeek: boolean;
  streakFreezeWeekStart: string | null;
  lastCheckinDate: string | null;
}

export class GamificationService {
  // Fetch user's gamification stats
  static async getUserStats(userId: string): Promise<UserStats | null> {
    try {
      const { data, error } = await supabase
        .from('user_gamification_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // If no rows found, don't log as error - this is normal for trainers
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('Error fetching user stats:', error);
        return null;
      }

      if (!data) {
        // Create default stats for new user
        const defaultStats = {
          user_id: userId,
          total_points: 0,
          current_level: 1,
          current_streak: 0,
          longest_streak: 0,
          total_workout_days: 0, // Changed from total_workouts
          total_checkins: 0,
          total_goals_achieved: 0,
          achievements_unlocked: 0,
          challenges_completed: 0,
        };

        const { data: newStats, error: insertError } = await supabase
          .from('user_gamification_stats')
          .insert(defaultStats)
          .select()
          .single();

        if (insertError) {
          console.error('Error creating default stats:', insertError);
          return null;
        }

        return this.mapUserStats(newStats);
      }

      return this.mapUserStats(data);
    } catch (error) {
      console.error('Error in getUserStats:', error);
      return null;
    }
  }

  // Fetch all available achievements
  static async getAvailableAchievements(): Promise<Achievement[]> {
    try {
      const { data, error } = await supabase
        .from('available_achievements')
        .select('*')
        .eq('is_active', true)
        .order('points', { ascending: true });

      if (error) {
        console.error('Error fetching available achievements:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAvailableAchievements:', error);
      return [];
    }
  }

  // Fetch user's unlocked achievements
  static async getUserAchievements(userId: string): Promise<Achievement[]> {
    try {
      const { data, error } = await supabase
        .from('user_achievements')
        .select(`
          *,
          available_achievements (
            id,
            name,
            description,
            icon,
            points,
            category,
            requirement_type,
            requirement_value,
            requirement_description
          )
        `)
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching user achievements:', error);
        return [];
      }

      return (data || []).map(item => ({
        ...item.available_achievements,
        unlocked: true,
        unlockedAt: item.unlocked_at,
      }));
    } catch (error) {
      console.error('Error in getUserAchievements:', error);
      return [];
    }
  }

  // Check and unlock achievements based on user actions
  static async checkAndUnlockAchievements(userId: string, action: string, value: number = 1): Promise<Achievement[]> {
    try {
      const availableAchievements = await this.getAvailableAchievements();
      const userAchievements = await this.getUserAchievements(userId);
      const unlockedAchievements: Achievement[] = [];

      for (const achievement of availableAchievements) {
        // Skip if already unlocked
        if (userAchievements.find(ua => ua.id === achievement.id)) {
          continue;
        }

        let shouldUnlock = false;

        switch (achievement.requirement_type) {
          case 'count':
            if (action === achievement.category && value >= achievement.requirement_value) {
              shouldUnlock = true;
            }
            break;
          case 'streak':
            if (action === 'streak' && value >= achievement.requirement_value) {
              shouldUnlock = true;
            }
            break;
          case 'goal':
            if (action === 'goal' && value >= achievement.requirement_value) {
              shouldUnlock = true;
            }
            break;
          case 'special':
            if (action === achievement.category && value >= achievement.requirement_value) {
              shouldUnlock = true;
            }
            break;
        }

        if (shouldUnlock) {
          // Unlock achievement
          const { error } = await supabase
            .from('user_achievements')
            .insert({
              user_id: userId,
              achievement_id: achievement.id,
              points_earned: achievement.points,
            });

          if (!error) {
            unlockedAchievements.push({
              ...achievement,
              unlocked: true,
              unlockedAt: new Date().toISOString(),
            });
          }
        }
      }

      return unlockedAchievements;
    } catch (error) {
      console.error('Error in checkAndUnlockAchievements:', error);
      return [];
    }
  }

  // Fetch available challenges
  static async getAvailableChallenges(): Promise<Challenge[]> {
    try {
      const { data, error } = await supabase
        .from('available_challenges')
        .select('*')
        .eq('is_active', true)
        .gte('end_date', new Date().toISOString().split('T')[0])
        .order('end_date', { ascending: true });

      if (error) {
        console.error('Error fetching available challenges:', error);
        return [];
      }

      return (data || []).map(challenge => ({
        id: challenge.id,
        name: challenge.name,
        description: challenge.description,
        type: challenge.type,
        target: challenge.target_value,
        current: 0, // Will be updated with user progress
        reward: challenge.reward_points,
        endDate: challenge.end_date,
        active: true,
        challenge_category: challenge.challenge_category,
      }));
    } catch (error) {
      console.error('Error in getAvailableChallenges:', error);
      return [];
    }
  }

  // Fetch user's challenges with progress
  static async getUserChallenges(userId: string): Promise<Challenge[]> {
    try {
      const availableChallenges = await this.getAvailableChallenges();
      const { data: userChallenges, error } = await supabase
        .from('user_challenges')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching user challenges:', error);
        return availableChallenges;
      }

      // Merge available challenges with user progress
      return availableChallenges.map(challenge => {
        const userChallenge = userChallenges?.find(uc => uc.challenge_id === challenge.id);
        return {
          ...challenge,
          current: userChallenge?.current_progress || 0,
          active: !userChallenge?.completed,
        };
      });
    } catch (error) {
      console.error('Error in getUserChallenges:', error);
      return [];
    }
  }

  // Update challenge progress
  static async updateChallengeProgress(userId: string, challengeId: string, progress: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_challenges')
        .upsert({
          user_id: userId,
          challenge_id: challengeId,
          current_progress: progress,
          completed: progress >= 1, // Mark as completed if progress reaches target
          completed_at: progress >= 1 ? new Date().toISOString() : null,
          points_earned: progress >= 1 ? 100 : 0, // Default points, should come from challenge
        });

      if (error) {
        console.error('Error updating challenge progress:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateChallengeProgress:', error);
      return false;
    }
  }

  // Fetch leaderboard
  static async getLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      const { data, error } = await supabase
        .from('user_gamification_stats')
        .select(`
          *,
          profiles (
            username,
            full_name
          )
        `)
        .order('total_points', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching leaderboard:', error);
        return [];
      }

      return (data || []).map((entry, index) => ({
        id: entry.user_id,
        username: entry.profiles?.username || 'user_' + entry.user_id.slice(0, 8),
        fullName: entry.profiles?.full_name || 'Unknown User',
        points: entry.total_points,
        level: entry.current_level,
        rank: index + 1,
      }));
    } catch (error) {
      console.error('Error in getLeaderboard:', error);
      return [];
    }
  }

  // Record workout session
  static async recordWorkout(userId: string, workoutType: string, durationMinutes: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_workout_sessions')
        .insert({
          user_id: userId,
          workout_date: new Date().toISOString().split('T')[0],
          workout_type: workoutType,
          duration_minutes: durationMinutes,
        });

      if (error) {
        console.error('Error recording workout:', error);
        return false;
      }

      // Update user stats
      await this.updateUserStats(userId, 'workout', 1);
      
      // Check for achievements
      await this.checkAndUnlockAchievements(userId, 'workout', 1);

      return true;
    } catch (error) {
      console.error('Error in recordWorkout:', error);
      return false;
    }
  }

  // Record check-in
    static async recordCheckin(userId: string): Promise<boolean> {
    try {
      // Update user stats
      await this.updateUserStats(userId, 'checkin', 1);
      
      // Check for achievements
      await this.checkAndUnlockAchievements(userId, 'checkin', 1);
      
      // Update workout frequency and streak
      await this.updateWorkoutStats(userId);
      
      return true;
    } catch (error) {
      console.error('Error in recordCheckin:', error);
      return false;
    }
  }

  static async recordWorkout(userId: string): Promise<boolean> {
    try {
      // Update user stats
      await this.updateUserStats(userId, 'workout', 1);
      
      // Check for achievements
      await this.checkAndUnlockAchievements(userId, 'workout', 1);
      
      // Update workout frequency and streak
      await this.updateWorkoutStats(userId);
      
      return true;
    } catch (error) {
      console.error('Error in recordWorkout:', error);
      return false;
    }
  }

  static async updateWorkoutStats(userId: string): Promise<void> {
    try {
      const { data: currentStats } = await supabase
        .from('user_gamification_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!currentStats) return;

      const today = new Date().toISOString().split('T')[0];
      const lastCheckinDate = currentStats.last_checkin_date;
      
      // Only update if this is a new day (not multiple check-ins on same day)
      if (lastCheckinDate === today) {
        // Same day, don't update streak or workout days
        return;
      }
      
      // Calculate streak
      let newStreak = currentStats.current_streak || 0;
      
      if (lastCheckinDate) {
        const lastDate = new Date(lastCheckinDate);
        const todayDate = new Date(today);
        const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          // Consecutive day
          newStreak += 1;
        } else if (diffDays > 1) {
          // Streak broken
          newStreak = 1;
        } else {
          // Same day, don't change streak
          newStreak = currentStats.current_streak || 1;
        }
      } else {
        // First check-in
        newStreak = 1;
      }

      // Update longest streak if current is longer
      const longestStreak = Math.max(currentStats.longest_streak || 0, newStreak);

      // Update stats - only increment workout days for new days
      await supabase
        .from('user_gamification_stats')
        .update({
          current_streak: newStreak,
          longest_streak: longestStreak,
          last_checkin_date: today,
          total_workout_days: (currentStats.total_workout_days || 0) + 1, // Track unique workout days
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

    } catch (error) {
      console.error('Error updating workout stats:', error);
    }
  }

  static async checkStreakExpiration(): Promise<void> {
    try {
      const { data: allUsers } = await supabase
        .from('user_gamification_stats')
        .select('user_id, last_checkin_date, current_streak, streak_frozen, streak_frozen_at');

      if (!allUsers) return;

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      for (const user of allUsers) {
        if (user.last_checkin_date && user.current_streak > 0) {
          const lastCheckin = new Date(user.last_checkin_date);
          const timeDiff = today.getTime() - lastCheckin.getTime();
          const hoursDiff = timeDiff / (1000 * 60 * 60);

          // Check if streak is frozen
          if (user.streak_frozen && user.streak_frozen_at) {
            const frozenAt = new Date(user.streak_frozen_at);
            const frozenTimeDiff = today.getTime() - frozenAt.getTime();
            const frozenHoursDiff = frozenTimeDiff / (1000 * 60 * 60);

            // If frozen for more than 24 hours, unfreeze and check expiration
            if (frozenHoursDiff >= 24) {
              await supabase
                .from('user_gamification_stats')
                .update({
                  streak_frozen: false,
                  streak_frozen_at: null,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', user.user_id);

              // Now check if streak should expire
              if (hoursDiff >= 24) {
                await supabase
                  .from('user_gamification_stats')
                  .update({
                    current_streak: 0,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('user_id', user.user_id);
              }
            }
          } else {
            // Streak not frozen, check normal expiration
            if (hoursDiff >= 24) {
              await supabase
                .from('user_gamification_stats')
                .update({
                  current_streak: 0,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', user.user_id);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking streak expiration:', error);
    }
  }

  // Freeze streak for 24 hours (once per week)
  static async freezeStreak(userId: string): Promise<{ success: boolean; message: string; canFreeze: boolean }> {
    try {
      const { data: currentStats } = await supabase
        .from('user_gamification_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!currentStats) {
        return { success: false, message: 'User stats not found', canFreeze: false };
      }

      // Check if user can freeze this week
      const today = new Date();
      const weekStart = this.getWeekStart(today);
      
      // Reset weekly freeze if it's a new week
      if (currentStats.streak_freeze_week_start !== weekStart.toISOString().split('T')[0]) {
        await supabase
          .from('user_gamification_stats')
          .update({
            streak_freeze_used_this_week: false,
            streak_freeze_week_start: weekStart.toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
        
        currentStats.streak_freeze_used_this_week = false;
      }

      if (currentStats.streak_freeze_used_this_week) {
        return { 
          success: false, 
          message: 'You can only freeze your streak once per week. Save it for when you really need it!', 
          canFreeze: false 
        };
      }

      if (currentStats.current_streak === 0) {
        return { 
          success: false, 
          message: 'No active streak to freeze', 
          canFreeze: false 
        };
      }

      // Freeze the streak
      const { error } = await supabase
        .from('user_gamification_stats')
        .update({
          streak_frozen: true,
          streak_frozen_at: new Date().toISOString(),
          streak_freeze_used_this_week: true,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error freezing streak:', error);
        return { success: false, message: 'Failed to freeze streak', canFreeze: false };
      }

      return { 
        success: true, 
        message: 'Streak frozen for 24 hours! Your progress is safe.', 
        canFreeze: true 
      };
    } catch (error) {
      console.error('Error in freezeStreak:', error);
      return { success: false, message: 'Failed to freeze streak', canFreeze: false };
    }
  }

  // Helper function to get the start of the week (Monday)
  private static getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
  }

  // Update user stats
  static async updateUserStats(userId: string, action: string, value: number = 1): Promise<boolean> {
    try {
      const { data: currentStats } = await supabase
        .from('user_gamification_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!currentStats) {
        return false;
      }

      let updates: any = { updated_at: new Date().toISOString() };

      switch (action) {
        case 'workout':
          // Don't increment workout days here - that's handled in updateWorkoutStats
          updates.last_workout_date = new Date().toISOString().split('T')[0];
          break;
        case 'checkin':
          updates.total_checkins = currentStats.total_checkins + value;
          // Don't update last_checkin_date here - that's handled in updateWorkoutStats
          break;
        case 'goal':
          updates.total_goals_achieved = currentStats.total_goals_achieved + value;
          break;
        case 'streak':
          updates.current_streak = value;
          if (value > currentStats.longest_streak) {
            updates.longest_streak = value;
          }
          break;
      }

      const { error } = await supabase
        .from('user_gamification_stats')
        .update(updates)
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating user stats:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateUserStats:', error);
      return false;
    }
  }

  // Helper function to map database stats to UserStats interface
  private static mapUserStats(data: any): UserStats {
    return {
      totalPoints: data.total_points || 0,
      currentStreak: data.current_streak || 0,
      longestStreak: data.longest_streak || 0,
      level: data.current_level || 1,
      rank: 0, // Will be calculated separately
      totalWorkoutDays: data.total_workout_days || 0, // Changed from total_workouts
      totalCheckins: data.total_checkins || 0,
      totalGoalsAchieved: data.total_goals_achieved || 0,
      achievementsUnlocked: data.achievements_unlocked || 0,
      challengesCompleted: data.challenges_completed || 0,
      streakFrozen: data.streak_frozen || false,
      streakFrozenAt: data.streak_frozen_at || null,
      streakFreezeUsedThisWeek: data.streak_freeze_used_this_week || false,
      streakFreezeWeekStart: data.streak_freeze_week_start || null,
      lastCheckinDate: data.last_checkin_date || null,
    };
  }
}
