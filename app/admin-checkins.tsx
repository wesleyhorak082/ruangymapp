import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Users, UserCheck, Clock } from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface CheckInRecord {
  id: string;
  user_id: string;
  user_type: string;
  check_in_time: string;
  check_out_time: string | null;
  check_in_reason: string | null;
  is_checked_in: boolean;
  created_at: string;
  user_profiles: {
    full_name: string | null;
    username: string | null;
    user_type: string;
  };
}

type TimeFilter = 'today' | 'week' | 'month' | 'all';

export default function AdminCheckInsScreen() {

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'users' | 'trainers'>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [stats, setStats] = useState({
    totalCheckIns: 0,
    activeCheckIns: 0,
    averageSessionTime: 0,
  });

  // State for aggregated data
  const [aggregatedData, setAggregatedData] = useState<any[]>([]);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchCheckIns();
  }, [filter, timeFilter]);

  const fetchCheckIns = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('gym_checkins')
        .select(`
          *,
          user_profiles (
            full_name,
            username,
            user_type
          )
        `)
        .order('check_in_time', { ascending: false });

      // Apply user type filter
      if (filter !== 'all') {
        query = query.eq('user_profiles.user_type', filter === 'trainers' ? 'trainer' : 'user');
      }

      // Apply time filter
      const now = new Date();
      let startDate: Date;

      switch (timeFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(0); // Beginning of time
      }

      if (timeFilter !== 'all') {
        query = query.gte('check_in_time', startDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching check-ins:', error);
        return;
      }

      // Filter out records with missing user profiles when filtering by user type
      let filteredData = data || [];
      if (filter !== 'all') {
        filteredData = filteredData.filter(checkIn => 
          checkIn.user_profiles && checkIn.user_profiles.user_type
        );
      }

      // NEW: Store aggregated data for new UI
      const aggregatedDataResult = aggregateCheckInsByUser(filteredData);
      setAggregatedData(aggregatedDataResult);

      
      calculateStats(filteredData);
    } catch (error) {
      console.error('Error fetching check-ins:', error);
    } finally {
      setLoading(false);
    }
  };

  // NEW: Data aggregation function to group check-ins by user
  const aggregateCheckInsByUser = (data: CheckInRecord[]) => {
    const userMap = new Map();
    
    data.forEach(checkIn => {
      const userId = checkIn.user_id;
      
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userInfo: {
            id: userId,
            name: checkIn.user_profiles?.full_name || checkIn.user_profiles?.username || 'Unknown User',
            type: checkIn.user_type,
            icon: getUserTypeIcon(checkIn.user_type)
          },
          checkIns: [],
          summary: {
            totalCheckIns: 0,
            isCurrentlyActive: false,
            lastCheckInTime: null,
            totalSessionTime: 0,
            completedSessions: 0
          }
        });
      }
      
      const userData = userMap.get(userId);
      userData.checkIns.push(checkIn);
      userData.summary.totalCheckIns++;
      
      // Update active status
      if (checkIn.is_checked_in) {
        userData.summary.isCurrentlyActive = true;
      }
      
      // Update last check-in time
      const checkInTime = new Date(checkIn.check_in_time);
      if (!userData.summary.lastCheckInTime || checkInTime > userData.summary.lastCheckInTime) {
        userData.summary.lastCheckInTime = checkInTime;
      }
      
      // Calculate session duration if completed
      if (checkIn.check_out_time && checkIn.check_in_time) {
        const duration = new Date(checkIn.check_out_time).getTime() - checkInTime.getTime();
        userData.summary.totalSessionTime += duration;
        userData.summary.completedSessions++;
      }
    });
    
    // Convert to array and sort by last check-in time
    const aggregatedData = Array.from(userMap.values()).sort((a, b) => {
      if (!a.summary.lastCheckInTime) return 1;
      if (!b.summary.lastCheckInTime) return -1;
      return b.summary.lastCheckInTime.getTime() - a.summary.lastCheckInTime.getTime();
    });
    
    return aggregatedData;
  };

  const calculateStats = (data: CheckInRecord[]) => {
    const total = data.length;
    const active = data.filter(c => c.is_checked_in).length;
    
    let totalSessionTime = 0;
    let completedSessions = 0;
    
    data.forEach(checkIn => {
      if (checkIn.check_out_time && checkIn.check_in_time) {
        const duration = new Date(checkIn.check_out_time).getTime() - new Date(checkIn.check_in_time).getTime();
        totalSessionTime += duration;
        completedSessions++;
      }
    });

    const averageSessionTime = completedSessions > 0 ? totalSessionTime / completedSessions / (1000 * 60) : 0;

    setStats({
      totalCheckIns: total,
      activeCheckIns: active,
      averageSessionTime: Math.round(averageSessionTime),
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCheckIns();
    setRefreshing(false);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };



  const getUserTypeIcon = (userType: string) => {
    return userType === 'trainer' ? '🏋️' : '💪';
  };

  const getUserTypeLabel = (userType: string) => {
    return userType === 'trainer' ? 'Trainer' : 'Member';
  };

  const getTimeFilterLabel = (filter: TimeFilter) => {
    switch (filter) {
      case 'today': return 'Today';
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      case 'all': return 'All Time';
    }
  };

  const getTimeFilterColor = (filter: TimeFilter) => {
    switch (filter) {
      case 'today': return '#2ECC71';
      case 'week': return '#3498DB';
      case 'month': return '#9B59B6';
      case 'all': return '#95A5A6';
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2C3E50', '#34495E']}
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
        <Text style={styles.headerTitle}>Check-in Analytics</Text>
        <Text style={styles.headerSubtitle}>Monitor gym attendance and patterns</Text>
      </LinearGradient>

      {/* Stats Overview */}
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalCheckIns}</Text>
            <Text style={styles.statLabel}>Total Check-ins</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.activeCheckIns}</Text>
            <Text style={styles.statLabel}>Currently Active</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.averageSessionTime}</Text>
            <Text style={styles.statLabel}>Avg. Session (min)</Text>
          </View>
        </View>
      </View>

      {/* Time Filter Tabs */}
      <View style={styles.timeFilterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(['today', 'week', 'month', 'all'] as TimeFilter[]).map((timeFilterOption) => (
            <TouchableOpacity 
              key={timeFilterOption}
              style={[
                styles.timeFilterTab,
                timeFilter === timeFilterOption && {
                  backgroundColor: getTimeFilterColor(timeFilterOption),
                }
              ]}
              onPress={() => setTimeFilter(timeFilterOption)}
            >
              <Text style={[
                styles.timeFilterText,
                timeFilter === timeFilterOption && styles.timeFilterTextActive
              ]}>
                {getTimeFilterLabel(timeFilterOption)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      

      {/* User Type Filter */}
      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Users size={16} color={filter === 'all' ? '#FFFFFF' : '#2C3E50'} />
          <Text style={[styles.filterButtonText, filter === 'all' && styles.filterButtonTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.filterButton, filter === 'users' && styles.filterButtonActive]}
          onPress={() => setFilter('users')}
        >
          <UserCheck size={16} color={filter === 'users' ? '#FFFFFF' : '#2C3E50'} />
          <Text style={[styles.filterButtonText, filter === 'users' && styles.filterButtonTextActive]}>
            Members
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.filterButton, filter === 'trainers' && styles.filterButtonActive]}
          onPress={() => setFilter('trainers')}
        >
          <Text style={[styles.filterButtonText, filter === 'trainers' && styles.filterButtonTextActive]}>
            🏋️ Trainers
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading check-ins...</Text>
          </View>
                 ) : aggregatedData.length === 0 ? (
           <View style={styles.emptyContainer}>
             <Text style={styles.emptyText}>No users found for {getTimeFilterLabel(timeFilter).toLowerCase()}</Text>
           </View>
         ) : (
           aggregatedData.map((userData) => (
             <View key={userData.userInfo.id} style={styles.userSummaryCard}>
               {/* User Summary Header */}
               <View style={styles.userSummaryHeader}>
                 <View style={styles.userInfo}>
                   <Text style={styles.userTypeIcon}>
                     {userData.userInfo.icon}
                   </Text>
                   <View style={styles.userDetails}>
                     <Text style={styles.userName}>
                       {userData.userInfo.name}
                     </Text>
                     <Text style={styles.userType}>
                       {getUserTypeLabel(userData.userInfo.type)}
                     </Text>
                   </View>
                 </View>
                 
                 <View style={styles.userSummaryStats}>
                   <View style={[
                     styles.statusBadge,
                     { backgroundColor: userData.summary.isCurrentlyActive ? '#00B894' : '#E17055' }
                   ]}>
                     <Text style={styles.statusText}>
                       {userData.summary.isCurrentlyActive ? 'Active' : 'Inactive'}
                     </Text>
                   </View>
                   
                   <TouchableOpacity
                     style={styles.expandButton}
                     onPress={() => {
                       const newExpanded = new Set(expandedUsers);
                       if (newExpanded.has(userData.userInfo.id)) {
                         newExpanded.delete(userData.userInfo.id);
                       } else {
                         newExpanded.add(userData.userInfo.id);
                       }
                       setExpandedUsers(newExpanded);
                     }}
                   >
                     <Text style={styles.expandButtonText}>
                       {expandedUsers.has(userData.userInfo.id) ? '▼' : '▶'}
                     </Text>
                   </TouchableOpacity>
                 </View>
               </View>

               {/* User Summary Info */}
               <View style={styles.userSummaryInfo}>
                 <View style={styles.summaryRow}>
                   <Text style={styles.summaryLabel}>Total Check-ins:</Text>
                   <Text style={styles.summaryValue}>{userData.summary.totalCheckIns}</Text>
                 </View>
                 
                 {userData.summary.lastCheckInTime && (
                   <View style={styles.summaryRow}>
                     <Text style={styles.summaryLabel}>Last Check-in:</Text>
                     <Text style={styles.summaryValue}>
                       {formatTime(userData.summary.lastCheckInTime.toISOString())} • {formatDateTime(userData.summary.lastCheckInTime.toISOString())}
                     </Text>
                   </View>
                 )}
                 
                 {userData.summary.completedSessions > 0 && (
                   <View style={styles.summaryRow}>
                     <Text style={styles.summaryLabel}>Avg. Session:</Text>
                     <Text style={styles.summaryValue}>
                       {Math.round(userData.summary.totalSessionTime / userData.summary.completedSessions / (1000 * 60))} min
                     </Text>
                   </View>
                 )}
               </View>

               {/* Expanded Details */}
               {expandedUsers.has(userData.userInfo.id) && (
                 <View style={styles.expandedDetails}>
                   <Text style={styles.expandedTitle}>Check-in History:</Text>
                   {userData.checkIns.map((checkIn: CheckInRecord) => (
                     <View key={checkIn.id} style={styles.detailRow}>
                       <Clock size={14} color="#636E72" />
                       <Text style={styles.detailText}>
                         {formatTime(checkIn.check_in_time)} • {formatDateTime(checkIn.check_in_time)}
                         {checkIn.check_out_time && ` → ${formatTime(checkIn.check_out_time)}`}
                         {checkIn.check_out_time && checkIn.check_in_time && 
                           ` (${Math.round((new Date(checkIn.check_out_time).getTime() - new Date(checkIn.check_in_time).getTime()) / (1000 * 60))} min)`
                         }
                       </Text>
                     </View>
                   ))}
                 </View>
               )}
             </View>
           ))
         )}
      </ScrollView>
    </View>
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
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
  statsContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    textAlign: 'center',
    fontWeight: '500',
  },
  timeFilterContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  timeFilterTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 6,
    backgroundColor: '#F8F9FA',
  },
  timeFilterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7F8C8D',
  },
  timeFilterTextActive: {
    color: '#FFFFFF',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  filterButtonActive: {
    backgroundColor: '#2C3E50',
    borderColor: '#2C3E50',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginLeft: 6,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#636E72',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#636E72',
  },
  checkInCard: {
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
  checkInHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userTypeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 2,
  },
  userType: {
    fontSize: 12,
    color: '#636E72',
    textTransform: 'capitalize',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  checkInDetails: {
    borderTopWidth: 1,
    borderTopColor: '#F1F3F4',
    paddingTop: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#636E72',
    marginLeft: 8,
  },


  userSummaryCard: {
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
  userSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  userDetails: {
    flex: 1,
  },
  userSummaryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  expandButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  expandButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  userSummaryInfo: {
    borderTopWidth: 1,
    borderTopColor: '#F1F3F4',
    paddingTop: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#636E72',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    color: '#2D3436',
    fontWeight: '600',
  },
  expandedDetails: {
    borderTopWidth: 1,
    borderTopColor: '#F1F3F4',
    paddingTop: 16,
  },
  expandedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 12,
  },
});
