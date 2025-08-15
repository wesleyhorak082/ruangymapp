import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SecurityIssue {
  type: 'warning' | 'error' | 'info'
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  recommendation: string
  affected_entities?: string[]
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

    const securityIssues: SecurityIssue[] = []

    // Check for functions with mutable search paths
    const { data: functions, error: funcError } = await supabase
      .rpc('get_functions_with_mutable_search_paths')

    if (!funcError && functions && functions.length > 0) {
      securityIssues.push({
        type: 'warning',
        message: `Found ${functions.length} functions with mutable search paths`,
        severity: 'medium',
        recommendation: 'Set explicit search_path in all functions to prevent SQL injection',
        affected_entities: functions.map((f: any) => f.function_name)
      })
    }

    // Check RLS policy performance
    const { data: rlsIssues, error: rlsError } = await supabase
      .rpc('check_rls_policy_performance')

    if (!rlsError && rlsIssues && rlsIssues.length > 0) {
      securityIssues.push({
        type: 'warning',
        message: `Found ${rlsIssues.length} RLS policies with performance issues`,
        severity: 'low',
        recommendation: 'Optimize RLS policies to avoid re-evaluating auth functions per row',
        affected_entities: rlsIssues.map((r: any) => r.table_name)
      })
    }

    // Check for unused indexes
    const { data: unusedIndexes, error: indexError } = await supabase
      .rpc('get_unused_indexes')

    if (!indexError && unusedIndexes && unusedIndexes.length > 0) {
      securityIssues.push({
        type: 'info',
        message: `Found ${unusedIndexes.length} unused indexes`,
        severity: 'low',
        recommendation: 'Consider removing unused indexes to improve write performance',
        affected_entities: unusedIndexes.map((i: any) => i.index_name)
      })
    }

    // Check authentication settings
    const { data: authSettings, error: authError } = await supabase
      .rpc('check_auth_security_settings')

    if (!authError && authSettings) {
      if (authSettings.otp_expiry > 900) { // 15 minutes in seconds
        securityIssues.push({
          type: 'warning',
          message: 'OTP expiry time is longer than recommended',
          severity: 'medium',
          recommendation: 'Set OTP expiry to 15 minutes or less for better security'
        })
      }

      if (!authSettings.leaked_password_protection) {
        securityIssues.push({
          type: 'error',
          message: 'Leaked password protection is disabled',
          severity: 'high',
          recommendation: 'Enable leaked password protection immediately'
        })
      }
    }

    // Check for missing foreign key indexes
    const { data: missingIndexes, error: missingIndexError } = await supabase
      .rpc('get_missing_foreign_key_indexes')

    if (!missingIndexError && missingIndexes && missingIndexes.length > 0) {
      securityIssues.push({
        type: 'info',
        message: `Found ${missingIndexes.length} foreign keys without covering indexes`,
        severity: 'low',
        recommendation: 'Add indexes on foreign key columns to improve query performance',
        affected_entities: missingIndexes.map((i: any) => `${i.table_name}.${i.column_name}`)
      })
    }

    // Calculate overall security score
    const criticalIssues = securityIssues.filter(issue => issue.severity === 'critical').length
    const highIssues = securityIssues.filter(issue => issue.severity === 'high').length
    const mediumIssues = securityIssues.filter(issue => issue.severity === 'medium').length
    const lowIssues = securityIssues.filter(issue => issue.severity === 'low').length

    let securityScore = 100
    securityScore -= criticalIssues * 25
    securityScore -= highIssues * 15
    securityScore -= mediumIssues * 10
    securityScore -= lowIssues * 5
    securityScore = Math.max(0, securityScore)

    const securityReport = {
      timestamp: new Date().toISOString(),
      overall_score: securityScore,
      score_breakdown: {
        critical: criticalIssues,
        high: highIssues,
        medium: mediumIssues,
        low: lowIssues
      },
      issues: securityIssues,
      recommendations: {
        immediate: securityIssues.filter(issue => issue.severity === 'critical' || issue.severity === 'high'),
        short_term: securityIssues.filter(issue => issue.severity === 'medium'),
        long_term: securityIssues.filter(issue => issue.severity === 'low')
      },
      status: securityScore >= 80 ? 'secure' : securityScore >= 60 ? 'moderate' : 'at_risk'
    }

    return new Response(
      JSON.stringify(securityReport),
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
      details: error.details || 'Unknown error occurred during security scan'
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
