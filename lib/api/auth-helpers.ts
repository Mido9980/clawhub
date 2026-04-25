import { NextRequest } from 'next/server';
import { auth, db } from '@/lib/firebase/admin';
import { UserCustomClaims } from '@/lib/types/firestore';
import { UnauthorizedError, ForbiddenError } from '@/lib/api/errors';
import * as admin from 'firebase-admin';

/**
 * Verify and decode Firebase ID token from Authorization header
 */
export async function verifyIdToken(request: NextRequest): Promise<{
  uid: string;
  email?: string;
  claims: UserCustomClaims;
}> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError();
  }

  const token = authHeader.slice(7);
  
  try {
    const decodedToken = await auth.verifyIdToken(token);
    
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      claims: (decodedToken.custom_claims as UserCustomClaims) || { role: 'customer' },
    };
  } catch (error) {
    console.error('[Auth] Token verification failed:', error);
    throw new UnauthorizedError();
  }
}

/**
 * Require authentication for endpoint
 */
export async function requireAuthenticated(request: NextRequest) {
  try {
    return await verifyIdToken(request);
  } catch {
    throw new UnauthorizedError();
  }
}

/**
 * Require specific role for endpoint
 */
export async function requireRole(request: NextRequest, requiredRoles: string[]) {
  const user = await verifyIdToken(request);
  
  if (!requiredRoles.includes(user.claims.role)) {
    throw new ForbiddenError();
  }
  
  return user;
}

/**
 * Create new user and set initial role
 */
export async function createUserWithRole(
  email: string,
  password: string,
  role: 'customer' | 'admin' = 'customer'
) {
  const user = await auth.createUser({
    email,
    password,
    emailVerified: false,
  });

  // Set custom claims
  await auth.setCustomUserClaims(user.uid, {
    role,
    admin: role === 'admin' || role === 'super_admin',
  });

  // Create customer profile
  if (role === 'customer') {
    await db.collection('customers').doc(user.uid).set({
      email,
      firstName: '',
      lastName: '',
      phone: '',
      status: 'active',
      totalSpent: 0,
      orderCount: 0,
      memberSince: admin.firestore.FieldValue.serverTimestamp(),
      preferences: {
        newsletter: false,
        notifications: true,
      },
      tags: [],
    });
  }

  return user.uid;
}

/**
 * Update user role
 */
export async function updateUserRole(
  uid: string,
  role: 'customer' | 'admin' | 'super_admin'
) {
  await auth.setCustomUserClaims(uid, {
    role,
    admin: role === 'admin' || role === 'super_admin',
  });

  // If demoting from admin to customer, update customer profile
  if (role === 'customer') {
    const exists = await db.collection('customers').doc(uid).get();
    if (!exists.exists) {
      const user = await auth.getUser(uid);
      await db.collection('customers').doc(uid).set({
        email: user.email,
        firstName: '',
        lastName: '',
        phone: '',
        status: 'active',
        totalSpent: 0,
        orderCount: 0,
        memberSince: admin.firestore.FieldValue.serverTimestamp(),
        preferences: {
          newsletter: false,
          notifications: true,
        },
        tags: [],
      });
    }
  }
}

/**
 * Suspend or reactivate user
 */
export async function setUserStatus(uid: string, disabled: boolean) {
  await auth.updateUser(uid, { disabled });

  if (disabled) {
    await db.collection('customers').doc(uid).update({
      status: 'suspended',
    });
  } else {
    await db.collection('customers').doc(uid).update({
      status: 'active',
    });
  }
}

/**
 * Get user with all metadata
 */
export async function getUserWithMetadata(uid: string) {
  const user = await auth.getUser(uid);
  const customer = await db.collection('customers').doc(uid).get();

  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    disabled: user.disabled,
    claims: user.customClaims || { role: 'customer' },
    profile: customer.data(),
    createdAt: user.metadata.creationTime,
    lastSignIn: user.metadata.lastSignInTime,
  };
}

/**
 * Delete user and associated data
 */
export async function deleteUser(uid: string) {
  // Delete user from Firebase Auth
  await auth.deleteUser(uid);

  // Delete customer profile
  await db.collection('customers').doc(uid).delete();

  // Optional: Delete user's orders/carts in background
  const ordersSnapshot = await db.collection('orders').where('userId', '==', uid).get();
  for (const doc of ordersSnapshot.docs) {
    await doc.ref.delete();
  }

  const cartsSnapshot = await db.collection('carts').where('userId', '==', uid).get();
  for (const doc of cartsSnapshot.docs) {
    await doc.ref.delete();
  }
}

/**
 * List all users (admin only)
 */
export async function listUsers(pageToken?: string) {
  const result = await auth.listUsers(1000, pageToken);
  return {
    users: result.users,
    pageToken: result.pageToken,
  };
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string) {
  const link = await auth.generatePasswordResetLink(email);
  return link;
}

/**
 * Verify email change
 */
export async function verifyEmailChange(actionCode: string) {
  return auth.verifyEmailVerificationCode(actionCode);
}

/**
 * Check user permissions for resource
 */
export function hasPermission(
  userRole: string,
  requiredPermission: string
): boolean {
  const rolePermissions: Record<string, string[]> = {
    super_admin: ['all'],
    admin: [
      'manage_products',
      'manage_inventory',
      'manage_orders',
      'manage_reviews',
      'view_analytics',
      'manage_users',
    ],
    customer: ['view_products', 'manage_orders_own', 'create_reviews'],
  };

  const permissions = rolePermissions[userRole] || [];
  return permissions.includes('all') || permissions.includes(requiredPermission);
}

/**
 * Create API key for external integrations (admin only)
 */
export async function createApiKey(name: string, description?: string) {
  const key = `sk_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
  
  await db.collection('apiKeys').add({
    name,
    description,
    key: hashKey(key),
    lastUsed: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    active: true,
  });

  return key; // Only returned once
}

/**
 * Validate API key (for external integrations)
 */
export async function validateApiKey(key: string) {
  const hashedKey = hashKey(key);
  const snapshot = await db
    .collection('apiKeys')
    .where('key', '==', hashedKey)
    .where('active', '==', true)
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new UnauthorizedError();
  }

  const apiKey = snapshot.docs[0];
  await apiKey.ref.update({
    lastUsed: admin.firestore.FieldValue.serverTimestamp(),
  });

  return true;
}

/**
 * Simple hash for API keys (use bcrypt in production)
 */
function hashKey(key: string): string {
  // In production, use proper hashing like bcrypt
  return key.split('_')[1] || key;
}
