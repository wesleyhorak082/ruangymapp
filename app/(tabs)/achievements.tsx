import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy, Target, Users } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';

import { GamificationService, Achievement, Challenge, LeaderboardEntry, UserStats } from '@/lib/gamification';

export default function AchievementsScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'achievements' | 'challenges' | 'leaderboard'>('achievements');
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    totalPoints: 0,
    currentStreak: 0,
    longestStreak: 0,
    level: 1,
    rank: 0,
    totalWorkoutDays: 0,
    totalCheckins: 0,
    totalGoalsAchieved: 0,
    achievementsUnlocked: 0,
    challengesCompleted: 0,
    streakFrozen: false,
    streakFrozenAt: null,
    streakFreezeUsedThisWeek: false,
    streakFreezeWeekStart: null,
    lastCheckinDate: null,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [achievementsError, setAchievementsError] = useState<string | null>(null);

  const fetchGamificationData = useCallback(async () => {
    try {
      if (!user) return;
      
      // Clear any previous errors
      setAchievementsError(null);

      // Fetch user stats
      const stats = await GamificationService.getUserStats(user.id);
      if (stats) {
        setUserStats(stats);
      }

      // Fetch achievements with error handling
      try {
        console.log('🔍 Fetching available achievements...');
        const availableAchievements = await GamificationService.getAvailableAchievements();
        console.log(`✅ Found ${availableAchievements.length} available achievements`);
        
        console.log('🔍 Fetching user achievements...');
        const userAchievements = await GamificationService.getUserAchievements(user.id);
        console.log(`✅ Found ${userAchievements.length} user achievements`);
        
        // Merge available achievements with user unlock status
        const mergedAchievements = availableAchievements.map(achievement => {
          const userAchievement = userAchievements.find(ua => ua.id === achievement.id);
          return {
            ...achievement,
            unlocked: !!userAchievement,
            unlockedAt: userAchievement?.unlockedAt,
          };
        });
        
        console.log(`✅ Merged ${mergedAchievements.length} achievements`);
        setAchievements(mergedAchievements);
        setAchievementsError(null); // Clear any previous errors
      } catch (error) {
        console.error('❌ Error fetching achievements:', error);
        setAchievements([]);
        setAchievementsError(error instanceof Error ? error.message : 'Failed to load achievements');
      }

      // Fetch challenges with error handling
      try {
        const userChallenges = await GamificationService.getUserChallenges(user.id);
        setChallenges(userChallenges);
      } catch {
        setChallenges([]);
      }

      // Fetch leaderboard with error handling
      try {
        const leaderboardData = await GamificationService.getLeaderboard();
        setLeaderboard(leaderboardData);

        // Update user rank
        if (stats) {
          const userRank = leaderboardData.findIndex(entry => entry.id === user.id) + 1;
          setUserStats(prev => ({ ...prev, rank: userRank > 0 ? userRank : leaderboardData.length + 1 }));
        }
      } catch {
        setLeaderboard([]);
      }
    } catch (error) {
      console.error('Error fetching gamification data:', error);
    }
  }, [user]);

  // Only fetch data for regular users
  useEffect(() => {
    if (user) {
      fetchGamificationData();
    }
  }, [fetchGamificationData, user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGamificationData();
    setRefreshing(false);
  };







  return (
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <LinearGradient
        colors={['#FF6B35', '#FF8C42']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.headerTitle}>🏆 Achievements</Text>
        <Text style={styles.headerSubtitle}>Track your progress and compete with others</Text>
      </LinearGradient>

      <View style={styles.content}>
        {/* User Stats Overview */}
        <View style={styles.userStatsContainer}>
          <View style={styles.userStatsCard}>
            <View style={styles.userStatsRow}>
              <View style={styles.userStat}>
                <Text style={styles.userStatIcon}>⭐</Text>
                <Text style={styles.userStatNumber}>{userStats.totalPoints}</Text>
                <Text style={styles.userStatLabel}>Total Points</Text>
              </View>
              <View style={styles.userStat}>
                <Text style={styles.userStatIcon}>🚀</Text>
                <Text style={styles.userStatNumber}>{userStats.level}</Text>
                <Text style={styles.userStatLabel}>Level</Text>
              </View>
              <View style={styles.userStat}>
                <Text style={styles.userStatIcon}>🔥</Text>
                <Text style={styles.userStatNumber}>{userStats.currentStreak}</Text>
                <Text style={styles.userStatLabel}>Day Streak</Text>
              </View>
              <View style={styles.userStat}>
                <Text style={styles.userStatIcon}>🏅</Text>
                <Text style={styles.userStatNumber}>#{userStats.rank}</Text>
                <Text style={styles.userStatLabel}>Rank</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'achievements' && styles.activeTab]}
            onPress={() => setActiveTab('achievements')}
          >
            <Trophy size={20} color={activeTab === 'achievements' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.tabText, activeTab === 'achievements' && styles.activeTabText]}>
              Achievements
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'challenges' && styles.activeTab]}
            onPress={() => setActiveTab('challenges')}
          >
            <Target size={20} color={activeTab === 'challenges' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.tabText, activeTab === 'challenges' && styles.activeTabText]}>
              Challenges
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'leaderboard' && styles.activeTab]}
            onPress={() => setActiveTab('leaderboard')}
          >
            <Users size={20} color={activeTab === 'leaderboard' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.activeTabText]}>
              Leaderboard
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'achievements' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>All Achievements</Text>
            
            {achievementsError ? (
              <View style={styles.errorState}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorTitle}>Error Loading Achievements</Text>
                <Text style={styles.errorMessage}>{achievementsError}</Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={() => {
                    setAchievementsError(null);
                    fetchGamificationData();
                  }}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : achievements.length > 0 ? (
              <View style={styles.achievementsGrid}>
                {achievements.map((achievement) => (
                  <View key={achievement.id} style={[styles.achievementCard, achievement.unlocked && styles.achievementCardUnlocked]}>
                    <View style={styles.achievementIcon}>
                      <Text style={[styles.achievementIconText, achievement.unlocked && styles.achievementIconTextUnlocked]}>
                        {achievement.icon}
                      </Text>
                    </View>
                    
                    <Text style={styles.achievementName}>{achievement.name}</Text>
                    <Text style={styles.achievementDescription}>{achievement.description}</Text>
                    
                    <View style={styles.achievementProgress}>
                      <View style={[styles.achievementProgressFill, achievement.unlocked && styles.achievementProgressFillUnlocked]} />
                    </View>
                    <Text style={[styles.achievementProgressText, achievement.unlocked && styles.achievementProgressTextUnlocked]}>
                      {achievement.unlocked ? 'Unlocked' : 'Locked'}
                    </Text>
                    
                    <Text style={styles.achievementPoints}>+{achievement.points} pts</Text>
                    
                    {achievement.unlocked && (
                      <Text style={styles.unlockDate}>Unlocked {achievement.unlockedAt}</Text>
                    )}
                    
                                         {!achievement.unlocked && (
                       <View style={styles.lockedOverlay}>
                         <View style={styles.lockedContent}>
                           <View style={styles.lockedIconContainer}>
                             <Text style={styles.lockedIconText}>🔒</Text>
                           </View>
                           <Text style={styles.lockedLabel}>LOCKED</Text>
                           <View style={styles.lockedProgress}>
                             <View style={styles.lockedProgressBar}>
                               <View style={[styles.lockedProgressFill, { width: '0%' }]} />
                             </View>
                             <Text style={styles.lockedProgressText}>0% Complete</Text>
                           </View>
                         </View>
                       </View>
                     )}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Trophy size={48} color="#D1D5DB" />
                <Text style={styles.emptyStateTitle}>No achievements available</Text>
                <Text style={styles.emptyStateSubtitle}>Start working out to unlock achievements!</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'challenges' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Active Challenges</Text>
            {challenges.filter(c => c.active).length > 0 ? (
              challenges.filter(c => c.active).map((challenge) => (
                <View key={challenge.id} style={styles.challengeCard}>
                  <View style={styles.challengeHeader}>
                    <View>
                      <Text style={styles.challengeName}>{challenge.name}</Text>
                      <Text style={styles.challengeType}>{challenge.type.charAt(0).toUpperCase() + challenge.type.slice(1)} Challenge</Text>
                    </View>
                    <Text style={styles.challengeReward}>+{challenge.reward} pts</Text>
                  </View>
                  <Text style={styles.challengeDescription}>{challenge.description}</Text>
                  <View style={styles.challengeProgress}>
                    <View style={styles.progressBar}>
                      <View 
                        style={[
                          styles.progressFill, 
                          { width: `${Math.min((challenge.current / challenge.target) * 100, 100)}%` }
                        ]} 
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {challenge.current}/{challenge.target}
                    </Text>
                  </View>
                  <Text style={styles.challengeEndDate}>
                    Ends: {new Date(challenge.endDate).toISOString().split('T')[0]}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Target size={48} color="#D1D5DB" />
                <Text style={styles.emptyStateTitle}>No active challenges</Text>
                <Text style={styles.emptyStateSubtitle}>Check back later for new challenges!</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'leaderboard' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Top Performers</Text>
            {leaderboard.length > 0 ? (
              <View style={styles.leaderboardContainer}>
                {leaderboard.map((entry, index) => (
                  <View key={entry.id} style={styles.leaderboardEntry}>
                    <View style={styles.rankContainer}>
                      <Text style={styles.rankNumber}>#{entry.rank}</Text>
                      {index < 3 && (
                        <View style={[styles.medal, 
                          index === 0 ? styles.goldMedal : 
                          index === 1 ? styles.silverMedal : styles.bronzeMedal
                        ]}>
                          <Text style={styles.medalText}>
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.username}>@{entry.username}</Text>
                      <Text style={styles.fullName}>{entry.fullName}</Text>
                    </View>
                    <View style={styles.userStats}>
                      <Text style={styles.userPoints}>{entry.points} pts</Text>
                      <Text style={styles.userLevel}>Level {entry.level}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Users size={48} color="#D1D5DB" />
                <Text style={styles.emptyStateTitle}>No leaderboard data</Text>
                <Text style={styles.emptyStateSubtitle}>Be the first to start earning points!</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  userStatsContainer: {
    marginBottom: 24,
  },
  userStatsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  userStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  userStat: {
    alignItems: 'center',
    flex: 1,
  },
  userStatIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  userStatNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 4,
  },
  userStatLabel: {
    fontSize: 12,
    color: '#636E72',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#FF6B35',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  tabContent: {
    flex: 1,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 20,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 24,
    lineHeight: 22,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    flex: 1,
    marginHorizontal: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 4,
  },
  achievementCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 20,
    width: '48%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 200,
  },
  achievementCardUnlocked: {
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.02)',
    borderWidth: 2,
  },
  achievementCardPressed: {
    transform: [{ scale: 0.98 }],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    elevation: 6,
  },
  achievementIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 107, 53, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  achievementIconUnlocked: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderColor: 'rgba(255, 215, 0, 0.4)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  achievementName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  achievementDescription: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  achievementProgress: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  achievementProgressFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 3,
  },
  achievementProgressFillUnlocked: {
    backgroundColor: '#FFD700',
  },
  achievementProgressText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 4,
  },
  achievementProgressTextUnlocked: {
    color: '#FFD700',
    fontWeight: '700',
  },
  unlockDate: {
    fontSize: 12,
    color: '#00B894',
    fontWeight: '600',
    marginTop: 8,
  },
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(107, 114, 128, 0.4)',
  },
  lockedContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  lockedIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#6B7280',
  },
  lockedLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  lockedProgress: {
    alignItems: 'center',
    width: '100%',
  },
  lockedProgressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  lockedProgressFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 2,
  },
  lockedProgressText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '600',
    opacity: 0.9,
  },
  // Empty state styles
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  // Achievement icon and text styles
  achievementIconText: {
    fontSize: 28,
    color: '#FF6B35',
  },
  achievementIconTextUnlocked: {
    fontSize: 28,
    color: '#FFD700',
    textShadowColor: 'rgba(255, 215, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  achievementPoints: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF6B35',
    marginTop: 4,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lockedIconText: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  // Challenge styles
  challengeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  challengeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 4,
  },
  challengeType: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '600',
  },
  challengeReward: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00B894',
  },
  challengeDescription: {
    fontSize: 14,
    color: '#636E72',
    marginBottom: 16,
    lineHeight: 20,
  },
  challengeProgress: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#636E72',
    textAlign: 'center',
  },
  challengeEndDate: {
    fontSize: 12,
    color: '#95A5A6',
    textAlign: 'center',
  },
  // Leaderboard styles
  leaderboardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  leaderboardEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  rankContainer: {
    width: 50,
    alignItems: 'center',
    marginRight: 16,
  },
  rankNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3436',
  },
  medal: {
    marginTop: 4,
  },
  goldMedal: {
    // Gold medal styling
  },
  silverMedal: {
    // Silver medal styling
  },
  bronzeMedal: {
    // Bronze medal styling
  },
  medalText: {
    fontSize: 16,
  },
  userInfo: {
    flex: 1,
    marginRight: 16,
  },
  username: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '600',
    marginBottom: 2,
  },
  fullName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
  },
  userStats: {
    alignItems: 'flex-end',
  },
  userPoints: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00B894',
    marginBottom: 4,
  },
  userLevel: {
    fontSize: 14,
    color: '#636E72',
  },

  // Error state styles
  errorState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

});
