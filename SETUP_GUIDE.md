# E-Commerce Platform Setup Guide

Complete instructions for setting up the NoSQL e-commerce platform with Firestore, Next.js, and TypeScript.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Firebase Setup](#firebase-setup)
3. [Project Configuration](#project-configuration)
4. [Database Schema Setup](#database-schema-setup)
5. [Security Rules Deployment](#security-rules-deployment)
6. [API Testing](#api-testing)
7. [Production Deployment](#production-deployment)
8. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Google Cloud account
- Firebase project (free tier OK)
- Git for version control
- Postman or similar for API testing (optional)

---

## Firebase Setup

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name (e.g., "ecommerce-platform")
4. Follow the setup wizard
5. Enable Google Analytics (optional)

### Step 2: Enable Firestore

1. In Firebase Console, go to "Cloud Firestore"
2. Click "Create database"
3. Select your region (us-central1 recommended)
4. Choose "Start in test mode" (we'll update rules later)
5. Click "Create"

### Step 3: Enable Firebase Authentication

1. Go to "Authentication" section
2. Click "Get Started"
3. Enable "Email/Password" provider
4. (Optional) Enable other providers as needed

### Step 4: Generate Service Account Key

1. Go to Project Settings (gear icon)
2. Click "Service Accounts" tab
3. Click "Generate New Private Key"
4. Save the JSON file securely
5. Extract credentials:
   - `project_id` → FIREBASE_PROJECT_ID
   - `private_key` → FIREBASE_PRIVATE_KEY
   - `client_email` → FIREBASE_CLIENT_EMAIL

### Step 5: Get Web SDK Configuration

1. In Project Settings, find "Your apps" section
2. Click the web app (or create one)
3. Copy the Firebase config object
4. Extract these values:
   - `apiKey` → NEXT_PUBLIC_FIREBASE_API_KEY
   - `authDomain` → NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
   - `projectId` → NEXT_PUBLIC_FIREBASE_PROJECT_ID
   - `storageBucket` → NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
   - `messagingSenderId` → NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
   - `appId` → NEXT_PUBLIC_FIREBASE_APP_ID

---

## Project Configuration

### Step 1: Clone or Setup Project

```bash
cd /path/to/project
npm install
```

### Step 2: Create .env.local File

Copy the template:
```bash
cp .env.example .env.local
```

Fill in all Firebase credentials from previous steps.

### Step 3: Verify Configuration

```bash
npm run dev
```

Check console for Firebase initialization messages:
```
[Firebase] Admin SDK initialized
[Firebase] Client SDK initialized
```

### Step 4: Test Firebase Connection

Create a test file `test-firebase.ts`:

```typescript
import { db, auth } from '@/lib/firebase/admin';

async function test() {
  try {
    // Test Firestore
    const doc = await db.collection('_test').doc('connection').get();
    console.log('✓ Firestore connected');

    // Test Auth
    const user = await auth.getUser('test-user').catch(() => null);
    console.log('✓ Firebase Auth connected');
  } catch (error) {
    console.error('✗ Firebase connection failed:', error);
  }
}

test();
```

Run test:
```bash
npx ts-node test-firebase.ts
```

---

## Database Schema Setup

### Step 1: Initialize Collections

The database automatically creates collections when you write documents. We'll create initial structure:

```typescript
// scripts/init-firestore.ts
import * as admin from 'firebase-admin';

async function initializeFirestore() {
  const db = admin.firestore();

  // Create empty documents to establish collections
  const collections = ['products', 'orders', 'customers', 'inventory', 'reviews', 'carts', 'coupons', 'auditLogs'];

  for (const collection of collections) {
    try {
      await db.collection(collection).doc('__placeholder__').set({
        placeholder: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`✓ Created collection: ${collection}`);
    } catch (error) {
      console.error(`✗ Failed to create ${collection}:`, error);
    }
  }

  console.log('✓ Firestore initialization complete');
}

initializeFirestore();
```

Run:
```bash
npx ts-node scripts/init-firestore.ts
```

### Step 2: Create Composite Indexes

Go to Firestore Console → Indexes tab. Create these composite indexes:

**Orders Collection**:
- Fields: `userId` (Ascending), `status` (Ascending), `createdAt` (Descending)
- Fields: `status` (Ascending), `createdAt` (Descending)

**Reviews Collection**:
- Fields: `productId` (Ascending), `status` (Ascending), `createdAt` (Descending)
- Fields: `productId` (Ascending), `rating` (Descending)

**Products Collection**:
- Fields: `category` (Ascending), `status` (Ascending), `createdAt` (Descending)

**Coupons Collection**:
- Fields: `status` (Ascending), `validFrom` (Ascending), `validUntil` (Ascending)

**Customers Collection**:
- Fields: `status` (Ascending), `totalSpent` (Descending), `memberSince` (Descending)

### Step 3: Enable TTL for Carts

1. Go to Firestore Console
2. In "Carts" collection, find the `expiresAt` field
3. Click the menu → "Treat as timestamp for TTL"
4. Firestore will automatically delete expired carts

---

## Security Rules Deployment

### Step 1: Install Firebase CLI

```bash
npm install -g firebase-tools
```

### Step 2: Login to Firebase

```bash
firebase login
```

### Step 3: Initialize Firebase in Project

```bash
firebase init firestore
# Select your project when prompted
# Keep existing firestore.json if exists
```

### Step 4: Deploy Security Rules

The project includes `firestore.rules` with comprehensive security rules:

```bash
firebase deploy --only firestore:rules
```

Verify deployment in Firebase Console → Firestore → Rules tab.

### Step 5: Test Security Rules

Create test file `test-security-rules.ts`:

```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

async function testRules() {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);

  // Test public product read
  try {
    const products = await getDocs(collection(db, 'products'));
    console.log('✓ Can read products (public)');
  } catch {
    console.log('✗ Cannot read products (expected to be public)');
  }

  // Test anonymous access to orders (should fail)
  try {
    await signInAnonymously(auth);
    const orders = await getDocs(collection(db, 'orders'));
    console.log('✗ Can read all orders (security issue!)');
  } catch {
    console.log('✓ Cannot read others\' orders (rules working)');
  }
}
```

---

## API Testing

### Step 1: Test Without Authentication

```bash
# Get public products
curl http://localhost:3000/api/products

# Search products
curl http://localhost:3000/api/products?search=electronics

# Validate coupon (public endpoint)
curl -X POST http://localhost:3000/api/coupons/validate \
  -H "Content-Type: application/json" \
  -d '{"code": "SAVE10", "cartTotal": 100}'
```

### Step 2: Test With Authentication

1. Create a test user in Firebase Console (Authentication tab)
2. Get Firebase ID token:

```typescript
// In browser console
const user = firebase.auth().currentUser;
const token = await user.getIdToken();
console.log('Token:', token);
```

3. Test authenticated endpoints:

```bash
# Get user's orders
curl http://localhost:3000/api/orders \
  -H "Authorization: Bearer $TOKEN"

# Get user's cart
curl http://localhost:3000/api/cart \
  -H "Authorization: Bearer $TOKEN"

# Add to cart
curl -X POST http://localhost:3000/api/cart/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "prod123",
    "quantity": 1
  }'
```

### Step 3: Test Admin Endpoints

1. Create admin user in Firebase Console
2. Set custom claims:

```typescript
// In Node.js
import admin from 'firebase-admin';

const auth = admin.auth();
await auth.setCustomUserClaims('user-id', {
  role: 'admin',
  admin: true
});

console.log('Admin role set');
```

3. Get admin token and test:

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "description": "Test description",
    "sku": "TEST-001",
    "price": 99.99,
    "stock": 100,
    "category": "electronics",
    "tags": ["test"],
    "images": [{"url": "https://example.com/image.jpg", "alt": "Test"}]
  }'
```

---

## Production Deployment

### Step 1: Environment Variables

Add to Vercel (or your hosting):

```
FIREBASE_PROJECT_ID=***
FIREBASE_PRIVATE_KEY=***
FIREBASE_CLIENT_EMAIL=***
NEXT_PUBLIC_FIREBASE_API_KEY=***
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=***
NEXT_PUBLIC_FIREBASE_PROJECT_ID=***
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=***
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=***
NEXT_PUBLIC_FIREBASE_APP_ID=***
```

### Step 2: Security Checklist

- [ ] Firestore security rules deployed
- [ ] Firebase Authentication enabled
- [ ] Custom claims set for admin users
- [ ] API key validation implemented
- [ ] HTTPS enforced
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] Audit logging active

### Step 3: Build & Deploy

```bash
# Build
npm run build

# Test build locally
npm run start

# Deploy to Vercel
vercel deploy --prod
```

### Step 4: Verify Production

```bash
curl https://your-domain.com/api/products
```

---

## Monitoring & Maintenance

### View Firestore Metrics

1. Firebase Console → Firestore
2. Check metrics:
   - Read/write operations
   - Storage usage
   - Query performance

### Monitor Errors

1. Set up Sentry (optional):
```bash
npm install @sentry/nextjs
```

2. Configure in `next.config.js`:
```javascript
const withSentryConfig = require("@sentry/nextjs/config")(withSentryConfig);
```

### Regular Maintenance

**Weekly**:
- Check Firestore usage
- Review error logs
- Monitor API performance

**Monthly**:
- Update dependencies
- Review security rules
- Audit API logs
- Cleanup expired data

**Quarterly**:
- Capacity planning
- Performance optimization
- Security audit

### Database Backups

Enable automatic backups:

```bash
# Enable scheduled backups (Google Cloud Console)
# Or use: gcloud firestore backups create --async
```

---

## Troubleshooting

### Firebase Connection Issues

**Error**: "Failed to initialize Firebase"
- Check environment variables
- Verify Firebase project is active
- Ensure billing is enabled

### Authentication Failures

**Error**: "UNAUTHORIZED"
- Verify token is included in header
- Check token expiration
- Ensure custom claims are set

### Database Errors

**Error**: "PERMISSION_DENIED"
- Check Firestore security rules
- Verify user has required role
- Review audit logs

### Index Errors

**Error**: "FAILED_PRECONDITION"
- Create missing composite indexes
- Wait for index creation (may take time)
- Check Firebase Console → Indexes

---

## Next Steps

1. **Frontend Integration**: 
   - Install Firebase SDK: `npm install firebase`
   - Create authentication pages
   - Build shopping cart UI
   - Implement checkout flow

2. **Payment Processing**:
   - Integrate Stripe
   - Implement webhook handlers
   - Handle payment status updates

3. **Email Notifications**:
   - Setup SendGrid
   - Create email templates
   - Trigger emails on order events

4. **Advanced Features**:
   - Implement search with Algolia
   - Add inventory webhooks
   - Setup analytics tracking
   - Create admin dashboard

---

## Support Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [API Documentation](./ECOMMERCE_API_DOCS.md)

---

## Quick Reference

### Common Commands

```bash
# Development
npm run dev

# Build
npm run build

# Test
npm test

# Deploy security rules
firebase deploy --only firestore:rules

# Initialize database
npx ts-node scripts/init-firestore.ts

# View logs
firebase functions:log
```

### Useful URLs

- Firebase Console: https://console.firebase.google.com
- Firestore Documentation: https://firebase.google.com/docs/firestore
- Security Rules Documentation: https://firebase.google.com/docs/firestore/security/get-started
- Next.js Deployment: https://vercel.com/docs

---

**Last Updated**: April 2026
**Version**: 1.0.0
