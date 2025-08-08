// Test Firebase connection
const admin = require('firebase-admin');

console.log('Testing Firebase configuration...');

// Read environment variables
const projectId = process.env.FIREBASE_PROJECT_ID;
const databaseURL = process.env.FIREBASE_DATABASE_URL;
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

console.log('Project ID:', projectId);
console.log('Database URL:', databaseURL);
console.log('Service account key exists:', !!serviceAccountKey);
console.log('Service account key length:', serviceAccountKey ? serviceAccountKey.length : 0);

if (serviceAccountKey) {
  try {
    const parsed = JSON.parse(serviceAccountKey);
    console.log('✓ Service account key is valid JSON');
    console.log('✓ Project ID in key:', parsed.project_id);
    console.log('✓ Client email:', parsed.client_email);
    
    // Try to initialize Firebase Admin
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(parsed),
        databaseURL: databaseURL
      });
      console.log('✓ Firebase Admin initialized successfully');
      
      // Test database access
      const db = admin.database();
      const ref = db.ref('/test');
      
      ref.once('value')
        .then((snapshot) => {
          console.log('✓ Database connection successful');
          console.log('Data:', snapshot.val());
          process.exit(0);
        })
        .catch((error) => {
          console.error('✗ Database connection failed:', error.message);
          process.exit(1);
        });
    }
  } catch (error) {
    console.error('✗ Service account key parsing failed:', error.message);
    console.log('Key preview:', serviceAccountKey.substring(0, 100) + '...');
    process.exit(1);
  }
} else {
  console.error('✗ No service account key found');
  process.exit(1);
}