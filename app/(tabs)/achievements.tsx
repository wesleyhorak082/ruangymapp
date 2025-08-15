import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy, Target, Users, Star, Zap, Award, TrendingUp, Calendar, Crown } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { GamificationService, Achievement, Challenge, LeaderboardEntry, UserStats } from '@/lib/gamification';

export default function AchievementsScreen() {
  const { user } = useAuth();
  const { isTrainer } = useUserRoles();
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
  });
  const [refreshing, setRefreshing] = useState(false);

  // Early return for trainers - prevent any rendering or data fetching
  if (isTrainer()) {
    return null;
  }

  // Only fetch data for regular users
  useEffect(() => {
    if (user) {
      fetchGamificationData();
    }
  }, [user]);

  const fetchGamificationData = async () => {
    try {
      if (!user) return;

      // Fetch user stats
      const stats = await GamificationService.getUserStats(user.id);
      if (stats) {
        setUserStats(stats);
      }

      // Fetch achievements with error handling
      try {
        const availableAchievements = await GamificationService.getAvailableAchievements();
        const userAchievements = await GamificationService.getUserAchievements(user.id);
        
        // Merge available achievements with user unlock status
        const mergedAchievements = availableAchievements.map(achievement => {
          const userAchievement = userAchievements.find(ua => ua.id === achievement.id);
          return {
            ...achievement,
            unlocked: !!userAchievement,
            unlockedAt: userAchievement?.unlockedAt,
          };
        });
        
        setAchievements(mergedAchievements);
      } catch (achievementError) {
        setAchievements([]);
      }

      // Fetch challenges with error handling
      try {
        const userChallenges = await GamificationService.getUserChallenges(user.id);
        setChallenges(userChallenges);
      } catch (challengeError) {
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
      } catch (leaderboardError) {
        setLeaderboard([]);
      }
    } catch (error) {
      console.error('Error fetching gamification data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGamificationData();
    setRefreshing(false);
  };

  const getCategoryColor = (category: Achievement['category']) => {
    switch (category) {
      case 'workout': return '#4ECDC4';
      case 'streak': return '#FF6B35';
      case 'goal': return '#6C5CE7';
      case 'special': return '#F7931E';
      default: return '#95A5A6';
    }
  };

  const getCategoryIcon = (category: Achievement['category']) => {
    switch (category) {
      case 'workout': return <Target size={16} color="#4ECDC4" />;
      case 'streak': return <Zap size={16} color="#FF6B35" />;
      case 'goal': return <Trophy size={16} color="#6C5CE7" />;
      case 'special': return <Star size={16} color="#F7931E" />;
      default: return <Award size={16} color="#95A5A6" />;
    }
  };

  // Show trainer message if user is a trainer
  if (isTrainer()) {
    return (
      <View style={styles.trainerContainer}>
        <LinearGradient
          colors={['#6C5CE7', '#A855F7']}
          style={styles.trainerHeader}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Trophy size={48} color="#FFFFFF" />
          <Text style={styles.trainerTitle}>Achievements</Text>
          <Text style={styles.trainerSubtitle}>This feature is for gym members only</Text>
        </LinearGradient>
        <View style={styles.trainerContent}>
          <Text style={styles.trainerMessage}>
            As a trainer, you can track your clients' achievements and progress in the Client Dashboard.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <LinearGradient
        colors={['#1E293B', '#334155']}
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
            {achievements.length > 0 ? (
              <View style={styles.achievementsGrid}>
                {achievements.map((achievement) => (
                  <View key={achievement.id} style={[styles.achievementCard, achievement.unlocked && styles.achievementCardUnlocked]}>
                    <View style={styles.achievementIcon}>
                      <Text style={styles.achievementIconText}>{achievement.icon}</Text>
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
                      <Text style={styles.unlockDate}>Unlocked {achievement.unlockDate}</Text>
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
                <Text style={styles.emptyStateText}>No achievements available</Text>
                <Text style={styles.emptyStateSubtext}>Start working out to unlock achievements!</Text>
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
                <Text style={styles.emptyStateText}>No active challenges</Text>
                <Text style={styles.emptyStateSubtext}>Check back later for new challenges!</Text>
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
                <Text style={styles.emptyStateText}>No leaderboard data</Text>
                <Text style={styles.emptyStateSubtext}>Be the first to start earning points!</Text>
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
    backgroundColor: '#6C5CE7',
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 20,
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
    color: '#6C5CE7',
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
    gap: 16,
  },
  achievementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '48%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  achievementCardUnlocked: {
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 16,
  },
  achievementIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  achievementIconUnlocked: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
  },
  achievementName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20,
  },
  achievementDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  achievementProgress: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  achievementProgressFill: {
    height: '100%',
    backgroundColor: '#6C5CE7',
    borderRadius: 4,
  },
  achievementProgressFillUnlocked: {
    backgroundColor: '#FFD700',
  },
  achievementProgressText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(107, 114, 128, 0.3)',
  },
  lockedIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
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
  emptyStateButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 6,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  filterTabActive: {
    backgroundColor: '#6C5CE7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  recentAchievements: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  recentAchievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30, 41, 59, 0.1)',
  },
  recentAchievementItemLast: {
    borderBottomWidth: 0,
  },
  recentAchievementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  recentAchievementInfo: {
    flex: 1,
  },
  recentAchievementName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  recentAchievementDate: {
    fontSize: 14,
    color: '#64748B',
  },
  levelProgressContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  levelInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  currentLevel: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  levelProgress: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  levelProgressBar: {
    height: 12,
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 16,
  },
  levelProgressFill: {
    height: '100%',
    backgroundColor: '#6C5CE7',
    borderRadius: 6,
  },
  levelRewards: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  levelReward: {
    alignItems: 'center',
  },
  rewardIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  rewardText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
  },
  rewardUnlocked: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
  },
  rewardTextUnlocked: {
    color: '#FFD700',
    fontWeight: '700',
  },
  // Missing styles for existing components
  trainerContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  trainerHeader: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  trainerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  trainerSubtitle: {
    fontSize: 16,
    color: '#E5E7EB',
  },
  trainerContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trainerMessage: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  achievementIconText: {
    fontSize: 32,
    color: '#6C5CE7',
  },
  achievementPoints: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C5CE7',
    marginTop: 8,
  },
  unlockDate: {
    fontSize: 12,
    color: '#00B894',
    fontWeight: '600',
    marginTop: 8,
  },
  lockedIconText: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  // Enhanced locked state styles
  lockedContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  lockedIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#6B7280',
  },
  lockedLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: 1,
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
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  lockedProgressFill: {
    height: '100%',
    backgroundColor: '#6C5CE7',
    borderRadius: 3,
  },
  lockedProgressText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
    opacity: 0.8,
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
    color: '#6C5CE7',
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
    backgroundColor: '#6C5CE7',
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
    color: '#6C5CE7',
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
  // Empty state styles
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
});
