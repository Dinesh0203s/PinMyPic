/**
 * Pre-deployment validation checks
 */

import { getValidatedConfig } from './environment-validation';

export async function runDeploymentChecks(): Promise<boolean> {
  console.log('🔍 Running deployment readiness checks...\n');
  
  let allChecksPassed = true;

  // 1. Environment Variables Check
  try {
    console.log('1. Checking environment variables...');
    const config = getValidatedConfig();
    console.log('   ✅ Environment variables validated');
    
    // Check critical configurations
    if (config.NODE_ENV !== 'production') {
      console.log('   ⚠️  NODE_ENV is not set to production');
    }
  } catch (error) {
    console.error('   ❌ Environment validation failed:', error);
    allChecksPassed = false;
  }

  // 2. Database Connection Check
  try {
    console.log('2. Testing database connection...');
    const { mongoService } = await import('./mongodb');
    await mongoService.connect();
    const db = mongoService.getDb();
    await db.admin().ping();
    console.log('   ✅ Database connection successful');
  } catch (error) {
    console.error('   ❌ Database connection failed:', error);
    allChecksPassed = false;
  }

  // 3. Face Service Check
  try {
    console.log('3. Testing face recognition service...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch('http://localhost:5001/health', {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log('   ✅ Face recognition service is healthy');
    } else {
      console.error('   ❌ Face recognition service returned error:', response.status);
      // Don't fail deployment for face service issues
      console.log('   ⚠️  Continuing without face recognition (non-critical)');
    }
  } catch (error) {
    console.error('   ⚠️  Face recognition service not available:', error);
    console.log('   ⚠️  Continuing without face recognition (non-critical)');
  }

  // 4. Critical File Existence Check
  try {
    console.log('4. Checking critical files...');
    const fs = await import('fs');
    const path = await import('path');
    
    const criticalFiles = [
      'package.json',
      'server/index.ts',
      'client/src/main.tsx',
      'public/sw.js',
    ];
    
    for (const file of criticalFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`Critical file missing: ${file}`);
      }
    }
    
    console.log('   ✅ All critical files present');
  } catch (error) {
    console.error('   ❌ Critical file check failed:', error);
    allChecksPassed = false;
  }

  // 5. Memory and Performance Check
  try {
    console.log('5. Checking system resources...');
    const usage = process.memoryUsage();
    const mbUsage = {
      rss: Math.round(usage.rss / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
    };
    
    console.log(`   Memory usage: ${mbUsage.heapUsed}/${mbUsage.heapTotal}MB`);
    
    if (mbUsage.heapUsed > 256) {
      console.log('   ⚠️  High memory usage detected');
    } else {
      console.log('   ✅ Memory usage within normal range');
    }
  } catch (error) {
    console.error('   ❌ Resource check failed:', error);
    allChecksPassed = false;
  }

  // 6. Dependencies Check
  try {
    console.log('6. Checking package dependencies...');
    const fs = await import('fs');
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // Check for critical dependencies
    const criticalDeps = ['express', 'mongodb', 'react'];
    for (const dep of criticalDeps) {
      if (!packageJson.dependencies[dep] && !packageJson.devDependencies[dep]) {
        throw new Error(`Critical dependency missing: ${dep}`);
      }
    }
    
    console.log('   ✅ All critical dependencies present');
  } catch (error) {
    console.error('   ❌ Dependencies check failed:', error);
    allChecksPassed = false;
  }

  console.log('\n' + '='.repeat(50));
  
  if (allChecksPassed) {
    console.log('🎉 All deployment checks passed! Ready for deployment.');
    console.log('\n📋 Deployment Instructions:');
    console.log('1. Ensure MONGODB_URI environment variable is set');
    console.log('2. Configure Firebase credentials if using authentication');
    console.log('3. Set NODE_ENV=production');
    console.log('4. Run: npm run build');
    console.log('5. Run: npm start');
    
    return true;
  } else {
    console.log('❌ Some deployment checks failed. Please fix the issues above before deploying.');
    return false;
  }
}

// Run checks if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDeploymentChecks()
    .then(passed => {
      process.exit(passed ? 0 : 1);
    })
    .catch(error => {
      console.error('Deployment checks failed:', error);
      process.exit(1);
    });
}