import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
let app: admin.app.App;

try {
  // Check if app already initialized
  app = admin.app();
} catch {
  // Initialize only if not already initialized
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    throw new Error(
      'Firebase Admin SDK credentials not found. ' +
      'Please set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL environment variables.'
    );
  }

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      privateKey,
      clientEmail,
    } as admin.ServiceAccount),
    databaseURL: `https://${projectId}.firebaseio.com`,
  });
}

export const db = admin.firestore(app);
export const auth = admin.auth(app);

// Set up Firestore settings for optimized performance
db.settings({
  ignoreUndefinedProperties: true,
});

// Helper functions for common operations
export async function setUserClaims(uid: string, claims: Record<string, unknown>) {
  return auth.setCustomUserClaims(uid, claims);
}

export async function getUserClaims(uid: string) {
  const user = await auth.getUser(uid);
  return user.customClaims || {};
}

export async function createAuditLog(
  action: string,
  userId: string,
  targetCollection: string,
  targetDocId: string,
  changes?: { before: Record<string, unknown>; after: Record<string, unknown> },
  metadata?: { ipAddress: string; userAgent: string }
) {
  try {
    await db.collection('auditLogs').add({
      action,
      userId,
      targetCollection,
      targetDocId,
      changes,
      metadata,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: 'success',
    });
  } catch (error) {
    console.error('[Firebase] Failed to create audit log:', error);
    // Don't throw - audit logging should not block operations
  }
}

export async function createAuditLogError(
  action: string,
  userId: string,
  error: unknown
) {
  try {
    await db.collection('auditLogs').add({
      action,
      userId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: 'failure',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
  } catch (logError) {
    console.error('[Firebase] Failed to create error audit log:', logError);
  }
}
