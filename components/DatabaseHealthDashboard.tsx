import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Shield,
  Zap,
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw,
  Database,
  Activity,
  Lock,
  Settings,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface HealthMetric {
  metric: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  recommendation?: string;
}

interface SecurityIssue {
  type: 'warning' | 'error' | 'info';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
  affected_entities?: string[];
}

interface HealthReport {
  timestamp: string;
  overall_score: number;
  metrics: HealthMetric[];
  recommendations: string[];
  status: 'optimal' | 'good' | 'needs_attention' | 'critical';
}

interface SecurityReport {
  timestamp: string;
  overall_score: number;
  score_breakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  issues: SecurityIssue[];
  recommendations: {
    immediate: SecurityIssue[];
    short_term: SecurityIssue[];
    long_term: SecurityIssue[];
  };
  status: 'secure' | 'moderate' | 'at_risk';
}

export default function DatabaseHealthDashboard() {
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [securityReport, setSecurityReport] = useState<SecurityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'security' | 'performance'>('overview');

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      
      // Fetch health check data
      const { data: healthData, error: healthError } = await supabase.functions.invoke('health-check');
      if (!healthError && healthData) {
        setHealthReport(healthData);
      }

      // Fetch security monitor data
      const { data: securityData, error: securityError } = await supabase.functions.invoke('security-monitor');
      if (!securityError && securityData) {
        setSecurityReport(securityData);
      }

      // Fetch performance monitor data
      const { data: performanceData, error: performanceError } = await supabase.functions.invoke('performance-monitor');
      if (!performanceError && performanceData) {
        setHealthReport(performanceData);
      }

    } catch (error) {
      console.error('Error fetching health data:', error);
      Alert.alert('Error', 'Failed to fetch database health data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHealthData();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'optimal':
      case 'secure':
      case 'good':
        return '#00B894';
      case 'moderate':
      case 'needs_attention':
        return '#FDCB6E';
      case 'critical':
      case 'at_risk':
        return '#E17055';
      default:
        return '#636E72';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'optimal':
      case 'secure':
      case 'good':
        return <CheckCircle size={20} color="#00B894" />;
      case 'moderate':
      case 'needs_attention':
        return <AlertTriangle size={20} color="#FDCB6E" />;
      case 'critical':
      case 'at_risk':
        return <AlertTriangle size={20} color="#E17055" />;
      default:
        return <Info size={20} color="#636E72" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#E17055';
      case 'high':
        return '#FDCB6E';
      case 'medium':
        return '#74B9FF';
      case 'low':
        return '#00B894';
      default:
        return '#636E72';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E17055" />
        <Text style={styles.loadingText}>Analyzing database health...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <LinearGradient
        colors={['#E17055', '#FDCB6E']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <Database size={32} color="#FFFFFF" />
          <Text style={styles.headerTitle}>Database Health Dashboard</Text>
          <Text style={styles.headerSubtitle}>Real-time monitoring and insights</Text>
        </View>
      </LinearGradient>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <Activity size={16} color={activeTab === 'overview' ? '#E17055' : '#636E72'} />
          <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
            Overview
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'security' && styles.activeTab]}
          onPress={() => setActiveTab('security')}
        >
          <Shield size={16} color={activeTab === 'security' ? '#E17055' : '#636E72'} />
          <Text style={[styles.tabText, activeTab === 'security' && styles.activeTabText]}>
            Security
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'performance' && styles.activeTab]}
          onPress={() => setActiveTab('performance')}
        >
          <Zap size={16} color={activeTab === 'performance' ? '#E17055' : '#636E72'} />
          <Text style={[styles.tabText, activeTab === 'performance' && styles.activeTabText]}>
            Performance
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content based on active tab */}
      {activeTab === 'overview' && (
        <View style={styles.content}>
          {/* Overall Health Score */}
          {healthReport && (
            <View style={styles.scoreCard}>
              <LinearGradient
                colors={['#FFFFFF', '#F8F9FA']}
                style={styles.scoreGradient}
              >
                <Text style={styles.scoreLabel}>Overall Health Score</Text>
                <View style={styles.scoreValue}>
                  <Text style={[styles.scoreNumber, { color: getStatusColor(healthReport.status) }]}>
                    {healthReport.overall_score}
                  </Text>
                  <Text style={styles.scoreUnit}>/100</Text>
                </View>
                <View style={styles.scoreStatus}>
                  {getStatusIcon(healthReport.status)}
                  <Text style={[styles.statusText, { color: getStatusColor(healthReport.status) }]}>
                    {healthReport.status.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
              </LinearGradient>
            </View>
          )}

          {/* Key Metrics */}
          {healthReport && (
            <View style={styles.metricsContainer}>
              <Text style={styles.sectionTitle}>Key Metrics</Text>
              {healthReport.metrics.slice(0, 6).map((metric, index) => (
                <View key={index} style={styles.metricRow}>
                  <View style={styles.metricInfo}>
                    <Text style={styles.metricName}>{metric.metric}</Text>
                    <Text style={styles.metricValue}>
                      {metric.value} {metric.unit}
                    </Text>
                  </View>
                  <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(metric.status) }]} />
                </View>
              ))}
            </View>
          )}

          {/* Quick Actions */}
          <View style={styles.actionsContainer}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <TouchableOpacity style={styles.actionButton} onPress={fetchHealthData}>
              <RefreshCw size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Refresh Data</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]}>
              <Settings size={20} color="#E17055" />
              <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
                View Details
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {activeTab === 'security' && (
        <View style={styles.content}>
          {securityReport ? (
            <>
              {/* Security Score */}
              <View style={styles.scoreCard}>
                <LinearGradient
                  colors={['#FFFFFF', '#F8F9FA']}
                  style={styles.scoreGradient}
                >
                  <Text style={styles.scoreLabel}>Security Score</Text>
                  <View style={styles.scoreValue}>
                    <Text style={[styles.scoreNumber, { color: getStatusColor(securityReport.status) }]}>
                      {securityReport.overall_score}
                    </Text>
                    <Text style={styles.scoreUnit}>/100</Text>
                  </View>
                  <View style={styles.scoreStatus}>
                    <Lock size={20} color={getStatusColor(securityReport.status)} />
                    <Text style={[styles.statusText, { color: getStatusColor(securityReport.status) }]}>
                      {securityReport.status.toUpperCase()}
                    </Text>
                  </View>
                </LinearGradient>
              </View>

              {/* Security Issues */}
              <View style={styles.issuesContainer}>
                <Text style={styles.sectionTitle}>Security Issues</Text>
                {securityReport.issues.map((issue, index) => (
                  <View key={index} style={styles.issueCard}>
                    <View style={styles.issueHeader}>
                      <View style={[styles.severityIndicator, { backgroundColor: getSeverityColor(issue.severity) }]} />
                      <Text style={styles.issueType}>{issue.type.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.issueMessage}>{issue.message}</Text>
                    <Text style={styles.issueRecommendation}>{issue.recommendation}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Shield size={48} color="#636E72" />
              <Text style={styles.emptyStateText}>No security data available</Text>
            </View>
          )}
        </View>
      )}

      {activeTab === 'performance' && (
        <View style={styles.content}>
          {healthReport ? (
            <>
              {/* Performance Metrics */}
              <View style={styles.metricsContainer}>
                <Text style={styles.sectionTitle}>Performance Metrics</Text>
                {healthReport.metrics.map((metric, index) => (
                  <View key={index} style={styles.metricCard}>
                    <View style={styles.metricHeader}>
                      <Text style={styles.metricName}>{metric.metric}</Text>
                      <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(metric.status) }]} />
                    </View>
                    <Text style={styles.metricValue}>
                      {metric.value} {metric.unit}
                    </Text>
                    {metric.recommendation && (
                      <Text style={styles.metricRecommendation}>{metric.recommendation}</Text>
                    )}
                  </View>
                ))}
              </View>

              {/* Recommendations */}
              {healthReport.recommendations.length > 0 && (
                <View style={styles.recommendationsContainer}>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                  {healthReport.recommendations.map((recommendation, index) => (
                    <View key={index} style={styles.recommendationItem}>
                      <Text style={styles.recommendationText}>• {recommendation}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Zap size={48} color="#636E72" />
              <Text style={styles.emptyStateText}>No performance data available</Text>
            </View>
          )}
        </View>
      )}

      {/* Last Updated */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Last updated: {healthReport?.timestamp ? new Date(healthReport.timestamp).toLocaleString() : 'Never'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#636E72',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: -20,
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: '#F8F9FA',
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#636E72',
  },
  activeTabText: {
    color: '#E17055',
  },
  content: {
    padding: 20,
  },
  scoreCard: {
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  scoreGradient: {
    padding: 24,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 16,
    color: '#636E72',
    marginBottom: 16,
  },
  scoreValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  scoreUnit: {
    fontSize: 20,
    color: '#636E72',
    marginLeft: 4,
  },
  scoreStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metricsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 16,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  metricInfo: {
    flex: 1,
  },
  metricName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 14,
    color: '#636E72',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  metricCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metricRecommendation: {
    fontSize: 12,
    color: '#636E72',
    fontStyle: 'italic',
    marginTop: 8,
  },
  issuesContainer: {
    marginBottom: 24,
  },
  issueCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  issueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  severityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  issueType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#636E72',
    textTransform: 'uppercase',
  },
  issueMessage: {
    fontSize: 14,
    color: '#2D3436',
    marginBottom: 8,
  },
  issueRecommendation: {
    fontSize: 12,
    color: '#636E72',
    fontStyle: 'italic',
  },
  recommendationsContainer: {
    marginBottom: 24,
  },
  recommendationItem: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  recommendationText: {
    fontSize: 14,
    color: '#2D3436',
    lineHeight: 20,
  },
  actionsContainer: {
    marginBottom: 24,
  },
  actionButton: {
    backgroundColor: '#E17055',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#E17055',
  },
  secondaryButtonText: {
    color: '#E17055',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#636E72',
    marginTop: 16,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#636E72',
  },
});
