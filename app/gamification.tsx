import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Trophy, 
  Star, 
  Zap, 
  Target, 
  Users, 
  Award,
  TrendingUp,
  Calendar,
  ArrowLeft
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  unlocked: boolean;
  unlockedAt?: string;
  category: 'workout' | 'streak' | 'goal' | 'special';
}

interface Challenge {
  id: string;
  name: string;
  description: string;
  type: 'weekly' | 'monthly';
  target: number;
  current: number;
  reward: number;
  endDate: string;
  active: boolean;
}

interface LeaderboardEntry {
  id: string;
  username: string;
  fullName: string;
  points: number;
  level: number;
  rank: number;
  avatar?: string;
}

export default function GamificationScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'achievements' | 'challenges' | 'leaderboard'>('achievements');
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userStats, setUserStats] = useState({
    totalPoints: 0,
    currentStreak: 0,
    longestStreak: 0,
    level: 1,
    rank: 0,
  });

  useEffect(() => {
    fetchGamificationData();
  }, []);

  const fetchGamificationData = async () => {
    try {
      // TODO: Implement real API call to fetch gamification data
      // For now, set empty arrays
      setAchievements([]);
      setChallenges([]);
      setLeaderboard([]);
      setUserStats({
        totalPoints: 1250,
        currentStreak: 7,
        longestStreak: 21,
        level: 8,
        rank: 12
      });
    } catch (error) {
      console.error('Error fetching gamification data:', error);
    }
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

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={['#6C5CE7', '#A855F7']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>🏆 Gamification</Text>
        <Text style={styles.subtitle}>Track your progress and compete with others</Text>
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
            <View style={styles.achievementsGrid}>
              {achievements.map((achievement) => (
                <View key={achievement.id} style={styles.achievementCard}>
                  <View style={styles.achievementHeader}>
                    <Text style={styles.achievementIcon}>{achievement.icon}</Text>
                    <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(achievement.category) }]}>
                      {getCategoryIcon(achievement.category)}
                    </View>
                  </View>
                  <Text style={styles.achievementName}>{achievement.name}</Text>
                  <Text style={styles.achievementDescription}>{achievement.description}</Text>
                  <View style={styles.achievementFooter}>
                    <Text style={styles.achievementPoints}>+{achievement.points} pts</Text>
                    {achievement.unlocked ? (
                      <View style={styles.unlockedBadge}>
                        <Text style={styles.unlockedText}>Unlocked</Text>
                      </View>
                    ) : (
                      <View style={styles.lockedBadge}>
                        <Text style={styles.lockedText}>Locked</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'challenges' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Active Challenges</Text>
            {challenges.filter(c => c.active).map((challenge) => (
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
                  Ends: {new Date(challenge.endDate).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'leaderboard' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Top Performers</Text>
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
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    padding: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#E5E7EB',
    textAlign: 'center',
  },
  content: {
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
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 16,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  achievementCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  achievementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  achievementIcon: {
    fontSize: 32,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  achievementName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 8,
    lineHeight: 18,
  },
  achievementDescription: {
    fontSize: 12,
    color: '#636E72',
    marginBottom: 12,
    lineHeight: 16,
  },
  achievementFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  achievementPoints: {
    fontSize: 12,
    color: '#00B894',
    fontWeight: '600',
  },
  unlockedBadge: {
    backgroundColor: '#00B894',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  unlockedText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  lockedBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  lockedText: {
    fontSize: 10,
    color: '#636E72',
    fontWeight: '600',
  },
  challengeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  challengeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 4,
  },
  challengeType: {
    fontSize: 12,
    color: '#6B7280',
  },
  challengeReward: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00B894',
  },
  challengeDescription: {
    fontSize: 14,
    color: '#636E72',
    marginBottom: 16,
    lineHeight: 20,
  },
  challengeProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#F1F3F4',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4ECDC4',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#636E72',
    minWidth: 50,
    textAlign: 'right',
  },
  challengeEndDate: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
  },
  leaderboardContainer: {
    gap: 12,
  },
  leaderboardEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rankContainer: {
    alignItems: 'center',
    marginRight: 16,
    minWidth: 40,
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
    // Gold styling
  },
  silverMedal: {
    // Silver styling
  },
  bronzeMedal: {
    // Bronze styling
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
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 2,
  },
  fullName: {
    fontSize: 12,
    color: '#6B7280',
  },
  userStats: {
    alignItems: 'flex-end',
  },
  userPoints: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6C5CE7',
    marginBottom: 2,
  },
  userLevel: {
    fontSize: 12,
    color: '#6B7280',
  },
});
