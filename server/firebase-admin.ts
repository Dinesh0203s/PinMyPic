// Load environment variables from .env file in development
import dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

import admin from 'firebase-admin';

let firebaseAdmin: admin.app.App;

export function initializeFirebaseAdmin() {
  if (!firebaseAdmin) {
    if (!admin.apps.length) {
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        firebaseAdmin = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: process.env.FIREBASE_PROJECT_ID
        });
        console.log(`Firebase Admin: Using service account for project ${serviceAccount.project_id}`);
      } else {
        // For development with project ID
        firebaseAdmin = admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID
        });
        console.log('Firebase Admin: Using project ID for development');
      }
    } else {
      firebaseAdmin = admin.apps[0] as admin.app.App;
    }
  }
  return firebaseAdmin;
}

export async function verifyFirebaseToken(token: string) {
  try {
    // Always use full Firebase Admin verification (no development bypass)
    const app = initializeFirebaseAdmin();
    const decodedToken = await app.auth().verifyIdToken(token);
    console.log('Full Firebase verification: Token successfully verified');
    return decodedToken;
  } catch (error) {
    console.error('Firebase verification failed - Full verification enforced:', error);
    throw new Error('Invalid token');
  }
}

export { admin };