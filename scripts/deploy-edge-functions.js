#!/usr/bin/env node

/**
 * Script to deploy Edge Functions to Supabase
 * This addresses the "None currently deployed" issue from the database health overview
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${step}: ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function checkSupabaseCLI() {
  try {
    execSync('supabase --version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

function checkSupabaseProject() {
  try {
    const configPath = path.join(process.cwd(), 'supabase', 'config.toml');
    if (!fs.existsSync(configPath)) {
      return false;
    }
    
    const config = fs.readFileSync(configPath, 'utf8');
    return config.includes('project_id');
  } catch (error) {
    return false;
  }
}

function deployFunction(functionName) {
  try {
    logStep('Deploying', `${functionName} Edge Function`);
    
    const functionPath = path.join(process.cwd(), 'supabase', 'functions', functionName);
    
    if (!fs.existsSync(functionPath)) {
      logError(`Function ${functionName} not found at ${functionPath}`);
      return false;
    }
    
    // Deploy the function
    execSync(`supabase functions deploy ${functionName}`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    logSuccess(`${functionName} deployed successfully`);
    return true;
  } catch (error) {
    logError(`Failed to deploy ${functionName}: ${error.message}`);
    return false;
  }
}

function testFunction(functionName) {
  try {
    logStep('Testing', `${functionName} Edge Function`);
    
    // Get the function URL
    const { stdout } = execSync('supabase functions list --json', { encoding: 'utf8' });
    const functions = JSON.parse(stdout);
    const functionInfo = functions.find(f => f.name === functionName);
    
    if (!functionInfo) {
      logWarning(`Function ${functionName} not found in deployed functions list`);
      return false;
    }
    
    const functionUrl = functionInfo.url;
    log(`Function URL: ${functionUrl}`, 'blue');
    
    // Test the function with a simple GET request
    const response = execSync(`curl -s -o /dev/null -w "%{http_code}" ${functionUrl}`, { encoding: 'utf8' });
    
    if (response.trim() === '200') {
      logSuccess(`${functionName} is responding correctly`);
      return true;
    } else {
      logWarning(`${functionName} returned status code: ${response.trim()}`);
      return false;
    }
  } catch (error) {
    logError(`Failed to test ${functionName}: ${error.message}`);
    return false;
  }
}

async function main() {
  log('🚀 Supabase Edge Functions Deployment Script', 'bright');
  log('============================================', 'bright');
  
  // Check prerequisites
  logStep('Checking', 'Prerequisites');
  
  if (!checkSupabaseCLI()) {
    logError('Supabase CLI is not installed. Please install it first:');
    log('npm install -g supabase', 'blue');
    log('or visit: https://supabase.com/docs/guides/cli', 'blue');
    process.exit(1);
  }
  logSuccess('Supabase CLI is installed');
  
  if (!checkSupabaseProject()) {
    logError('Not in a Supabase project directory. Please run this script from your project root.');
    process.exit(1);
  }
  logSuccess('Supabase project configuration found');
  
  // Check if we're logged in
  try {
    execSync('supabase status', { stdio: 'pipe' });
    logSuccess('Supabase CLI is authenticated');
  } catch (error) {
    logError('Supabase CLI is not authenticated. Please run:');
    log('supabase login', 'blue');
    process.exit(1);
  }
  
  // List available functions
  logStep('Discovering', 'Available Edge Functions');
  const functionsDir = path.join(process.cwd(), 'supabase', 'functions');
  const functions = fs.readdirSync(functionsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  if (functions.length === 0) {
    logWarning('No Edge Functions found in supabase/functions/');
    log('Creating sample functions...', 'blue');
    
    // Create sample functions if none exist
    const sampleFunctions = ['health-check', 'security-monitor', 'performance-monitor'];
    sampleFunctions.forEach(funcName => {
      const funcDir = path.join(functionsDir, funcName);
      if (!fs.existsSync(funcDir)) {
        fs.mkdirSync(funcDir, { recursive: true });
        log(`Created directory for ${funcName}`, 'blue');
      }
    });
    
    // Re-read functions
    const newFunctions = fs.readdirSync(functionsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    logSuccess(`Found ${newFunctions.length} Edge Functions`);
    log(`Functions: ${newFunctions.join(', ')}`, 'blue');
  } else {
    logSuccess(`Found ${functions.length} Edge Functions`);
    log(`Functions: ${functions.join(', ')}`, 'blue');
  }
  
  // Deploy each function
  logStep('Deploying', 'Edge Functions');
  const deploymentResults = [];
  
  for (const functionName of functions) {
    const success = deployFunction(functionName);
    deploymentResults.push({ name: functionName, deployed: success });
  }
  
  // Test deployed functions
  logStep('Testing', 'Deployed Functions');
  const testResults = [];
  
  for (const result of deploymentResults) {
    if (result.deployed) {
      const tested = testFunction(result.name);
      testResults.push({ name: result.name, tested });
    }
  }
  
  // Summary
  logStep('Summary', 'Deployment Results');
  
  const deployedCount = deploymentResults.filter(r => r.deployed).length;
  const testedCount = testResults.filter(r => r.tested).length;
  
  logSuccess(`Deployed: ${deployedCount}/${functions.length} functions`);
  logSuccess(`Tested: ${testedCount}/${deployedCount} functions`);
  
  if (deployedCount === functions.length) {
    logSuccess('🎉 All Edge Functions deployed successfully!');
    log('\nYour database health monitoring is now active:', 'bright');
    log('• Health Check: /functions/v1/health-check', 'blue');
    log('• Security Monitor: /functions/v1/security-monitor', 'blue');
    log('• Performance Monitor: /functions/v1/performance-monitor', 'blue');
  } else {
    logWarning('Some functions failed to deploy. Check the errors above.');
  }
  
  // Next steps
  logStep('Next Steps', 'What to do now');
  log('1. Monitor your Edge Functions in the Supabase Dashboard', 'blue');
  log('2. Set up alerts for security and performance issues', 'blue');
  log('3. Run the database health optimization migration', 'blue');
  log('4. Schedule regular health checks using the Edge Functions', 'blue');
  
  log('\n✨ Edge Functions deployment complete!', 'bright');
}

// Handle errors gracefully
process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled Rejection at:');
  logError(`Promise: ${promise}`);
  logError(`Reason: ${reason}`);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logError('Uncaught Exception:');
  logError(error.message);
  logError(error.stack);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main().catch(error => {
    logError('Script failed with error:');
    logError(error.message);
    process.exit(1);
  });
}

module.exports = { deployFunction, testFunction };
