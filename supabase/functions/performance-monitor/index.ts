import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PerformanceMetric {
  metric: string
  value: number
  unit: string
  status: 'good' | 'warning' | 'critical'
  recommendation?: string
}

interface PerformanceReport {
  timestamp: string
  overall_score: number
  metrics: PerformanceMetric[]
  recommendations: string[]
  status: 'optimal' | 'good' | 'needs_attention' | 'critical'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const metrics: PerformanceMetric[] = []
    const recommendations: string[] = []

    // Check database size
    const { data: dbSize, error: sizeError } = await supabase
      .rpc('get_database_size')

    if (!sizeError && dbSize) {
      const sizeInMB = dbSize.size_mb
      let status: 'good' | 'warning' | 'critical' = 'good'
      let recommendation: string | undefined

      if (sizeInMB > 1000) {
        status = 'warning'
        recommendation = 'Consider archiving old data or implementing data retention policies'
      } else if (sizeInMB > 5000) {
        status = 'critical'
        recommendation = 'Database size is critical. Implement immediate data cleanup strategies'
      }

      metrics.push({
        metric: 'Database Size',
        value: sizeInMB,
        unit: 'MB',
        status,
        recommendation
      })

      if (recommendation) recommendations.push(recommendation)
    }

    // Check table sizes
    const { data: tableSizes, error: tableError } = await supabase
      .rpc('get_table_sizes')

    if (!tableError && tableSizes) {
      const largestTable = tableSizes[0]
      if (largestTable && largestTable.size_mb > 100) {
        metrics.push({
          metric: 'Largest Table',
          value: largestTable.size_mb,
          unit: 'MB',
          status: 'warning',
          recommendation: `Table '${largestTable.table_name}' is large. Consider partitioning or archiving`
        })
        recommendations.push(`Optimize large table: ${largestTable.table_name}`)
      }
    }

    // Check index usage
    const { data: indexUsage, error: indexUsageError } = await supabase
      .rpc('get_index_usage_stats')

    if (!indexUsageError && indexUsage) {
      const unusedIndexes = indexUsage.filter((idx: any) => idx.idx_scan === 0)
      if (unusedIndexes.length > 0) {
        metrics.push({
          metric: 'Unused Indexes',
          value: unusedIndexes.length,
          unit: 'count',
          status: 'warning',
          recommendation: 'Remove unused indexes to improve write performance'
        })
        recommendations.push('Clean up unused indexes')
      }
    }

    // Check query performance
    const { data: slowQueries, error: queryError } = await supabase
      .rpc('get_slow_queries')

    if (!queryError && slowQueries) {
      const slowCount = slowQueries.filter((q: any) => q.mean_time > 1000).length
      if (slowCount > 0) {
        metrics.push({
          metric: 'Slow Queries',
          value: slowCount,
          unit: 'count',
          status: slowCount > 5 ? 'critical' : 'warning',
          recommendation: 'Optimize slow queries or add appropriate indexes'
        })
        recommendations.push('Optimize slow-running queries')
      }
    }

    // Check connection count
    const { data: connections, error: connError } = await supabase
      .rpc('get_connection_count')

    if (!connError && connections) {
      const activeConnections = connections.active_connections
      let status: 'good' | 'warning' | 'critical' = 'good'
      let recommendation: string | undefined

      if (activeConnections > 50) {
        status = 'warning'
        recommendation = 'Monitor connection pool usage'
      } else if (activeConnections > 100) {
        status = 'critical'
        recommendation = 'Connection count is high. Check for connection leaks'
      }

      metrics.push({
        metric: 'Active Connections',
        value: activeConnections,
        unit: 'count',
        status,
        recommendation
      })

      if (recommendation) recommendations.push(recommendation)
    }

    // Check cache hit ratio
    const { data: cacheStats, error: cacheError } = await supabase
      .rpc('get_cache_hit_ratio')

    if (!cacheError && cacheStats) {
      const hitRatio = cacheStats.hit_ratio
      let status: 'good' | 'warning' | 'critical' = 'good'
      let recommendation: string | undefined

      if (hitRatio < 0.8) {
        status = 'warning'
        recommendation = 'Cache hit ratio is low. Consider increasing shared_buffers'
      } else if (hitRatio < 0.6) {
        status = 'critical'
        recommendation = 'Cache performance is poor. Immediate optimization needed'
      }

      metrics.push({
        metric: 'Cache Hit Ratio',
        value: hitRatio * 100,
        unit: '%',
        status,
        recommendation
      })

      if (recommendation) recommendations.push(recommendation)
    }

    // Check RLS policy performance
    const { data: rlsPerformance, error: rlsError } = await supabase
      .rpc('check_rls_policy_performance')

    if (!rlsError && rlsPerformance) {
      const slowPolicies = rlsPerformance.filter((p: any) => p.avg_time > 100)
      if (slowPolicies.length > 0) {
        metrics.push({
          metric: 'Slow RLS Policies',
          value: slowPolicies.length,
          unit: 'count',
          status: slowPolicies.length > 3 ? 'critical' : 'warning',
          recommendation: 'Optimize RLS policies to avoid re-evaluating auth functions per row'
        })
        recommendations.push('Optimize RLS policy performance')
      }
    }

    // Calculate overall performance score
    let totalScore = 0
    let maxScore = 0

    metrics.forEach(metric => {
      maxScore += 100
      switch (metric.status) {
        case 'good':
          totalScore += 100
          break
        case 'warning':
          totalScore += 60
          break
        case 'critical':
          totalScore += 20
          break
      }
    })

    const overallScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 100

    // Determine overall status
    let status: 'optimal' | 'good' | 'needs_attention' | 'critical'
    if (overallScore >= 90) {
      status = 'optimal'
    } else if (overallScore >= 75) {
      status = 'good'
    } else if (overallScore >= 50) {
      status = 'needs_attention'
    } else {
      status = 'critical'
    }

    const performanceReport: PerformanceReport = {
      timestamp: new Date().toISOString(),
      overall_score: overallScore,
      metrics,
      recommendations,
      status
    }

    return new Response(
      JSON.stringify(performanceReport),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    const errorResponse = {
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
      details: error.details || 'Unknown error occurred during performance scan'
    }

    return new Response(
      JSON.stringify(errorResponse),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
