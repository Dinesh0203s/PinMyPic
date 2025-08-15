/**
 * Environment variable validation for deployment readiness
 */

interface EnvironmentConfig {
  NODE_ENV: string;
  MONGODB_URI: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
  ADMIN_EMAIL?: string;
  PORT?: string;
}

const requiredVars: Array<keyof EnvironmentConfig> = [
  'MONGODB_URI'
];

const optionalVars: Array<keyof EnvironmentConfig> = [
  'NODE_ENV',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL', 
  'FIREBASE_PRIVATE_KEY',
  'ADMIN_EMAIL',
  'PORT'
];

export function validateEnvironment(): EnvironmentConfig {
  const config: Partial<EnvironmentConfig> = {};
  const missingVars: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (!value) {
      missingVars.push(varName);
    } else {
      config[varName] = value;
    }
  }

  // Check optional variables (but don't warn about them)
  for (const varName of optionalVars) {
    const value = process.env[varName];
    if (value) {
      config[varName] = value;
    }
  }

  // Handle critical missing variables
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => {
      console.error(`  - ${varName}`);
    });
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Only warn about incomplete Firebase configuration if partially configured
  const firebaseVars = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
  const firebaseConfigured = firebaseVars.filter(v => process.env[v]);
  
  if (firebaseConfigured.length > 0 && firebaseConfigured.length < firebaseVars.length) {
    console.warn('⚠️  Incomplete Firebase configuration detected:');
    const missingFirebase = firebaseVars.filter(v => !process.env[v]);
    missingFirebase.forEach(envVar => {
      console.warn(`  - ${envVar} is required for full Firebase functionality`);
    });
  }

  // Set defaults for missing optional variables
  if (!config.NODE_ENV) {
    config.NODE_ENV = 'production';
  }

  if (!config.PORT) {
    config.PORT = '3000';
  }

  if (!config.ADMIN_EMAIL) {
    config.ADMIN_EMAIL = 'admin@pinmypic.com';
  }

  console.log('✅ Environment validation completed successfully');
  return config as EnvironmentConfig;
}

export function getValidatedConfig(): EnvironmentConfig {
  return validateEnvironment();
}