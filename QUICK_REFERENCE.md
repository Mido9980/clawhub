# Quick Reference Guide

Fast lookup for common tasks and patterns.

## Project Structure

```
lib/
├── types/firestore.ts          # All TypeScript types
├── schemas/validation.ts       # Zod validation schemas
├── firebase/
│   ├── admin.ts               # Server-side setup
│   ├── client.ts              # Client-side setup
│   └── operations.ts          # Database CRUD
└── api/
    ├── errors.ts              # Error types
    ├── middleware.ts          # Auth middleware
    └── auth-helpers.ts        # Auth utilities

app/api/                        # API endpoints
├── products/
├── orders/
├── cart/
├── reviews/
└── coupons/

Documentation:
├── ECOMMERCE_API_DOCS.md      # Full API reference
├── SETUP_GUIDE.md             # Setup instructions
├── ARCHITECTURE.md            # System design
└── IMPLEMENTATION_SUMMARY.md  # Overview
```

## Common Tasks

### Create a New API Endpoint

1. Create route file: `app/api/[resource]/route.ts`
2. Import helpers:
   ```typescript
   import { createSuccessResponse, createErrorResponse } from '@/lib/api/errors';
   import { requireAuth, requireRole, validateBody } from '@/lib/api/middleware';
   import { someSchema } from '@/lib/schemas/validation';
   ```
3. Implement handler:
   ```typescript
   export async function GET(request: NextRequest) {
     try {
       // Your logic
       return createSuccessResponse(data);
     } catch (error) {
       return createErrorResponse(error);
     }
   }
   ```

### Add Authentication to Endpoint

```typescript
import { authenticateRequest } from '@/lib/api/middleware';

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    // user.uid, user.email, user.claims available
  } catch (error) {
    return createErrorResponse(error);
  }
}
```

### Require Admin Role

```typescript
import { requireRole } from '@/lib/api/middleware';

export const POST = requireRole('admin')(async (request, context) => {
  // Admin-only code
});
```

### Create Firestore Document

```typescript
import { db } from '@/lib/firebase/admin';

const docRef = await db.collection('products').add({
  name: 'Product Name',
  price: 99.99,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
});
```

### Query with Filters

```typescript
const snapshot = await db
  .collection('orders')
  .where('userId', '==', uid)
  .where('status', '==', 'pending')
  .orderBy('createdAt', 'desc')
  .limit(20)
  .get();

const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
```

### Add Audit Log

```typescript
import { createAuditLog } from '@/lib/firebase/admin';

await createAuditLog(
  'PRODUCT_CREATED',
  userId,
  'products',
  productId,
  { before: {}, after: productData }
);
```

### Validate Request Body

```typescript
import { createProductSchema } from '@/lib/schemas/validation';
import { ZodError } from 'zod';

try {
  const body = await request.json();
  const data = createProductSchema.parse(body);
  // data is typed correctly
} catch (error) {
  if (error instanceof ZodError) {
    return createErrorResponse(error);
  }
}
```

### Handle Transactions

```typescript
await db.runTransaction(async (transaction) => {
  // Read
  const doc = await transaction.get(documentRef);
  
  // Write
  transaction.update(documentRef, { field: value });
  transaction.set(anotherRef, data);
  
  // Commit on function end or rollback on error
});
```

## API Endpoints

### List Products
```bash
GET /api/products
  ?page=1
  &pageSize=20
  &category=electronics
  &status=active
  &search=query
```

### Get Product
```bash
GET /api/products/{id}
```

### Create Product (Admin)
```bash
POST /api/products
{
  "name": "string",
  "description": "string (min 10)",
  "sku": "string",
  "price": number,
  "stock": number,
  "category": "string",
  "images": [{ "url": "string", "alt": "string" }]
}
```

### Get Cart
```bash
GET /api/cart
Auth: Bearer {token}
```

### Add to Cart
```bash
POST /api/cart/items
Auth: Bearer {token}
{
  "productId": "string",
  "quantity": number
}
```

### Create Order
```bash
POST /api/orders
Auth: Bearer {token}
{
  "items": [...],
  "shippingAddress": {...},
  "billingAddress": {...},
  "paymentMethod": {...}
}
```

### Get Orders
```bash
GET /api/orders
Auth: Bearer {token}
  ?page=1
  &pageSize=20
```

### Get Order
```bash
GET /api/orders/{id}
Auth: Bearer {token}
```

### Update Order Status (Admin)
```bash
PATCH /api/orders/{id}
Auth: Bearer {admin-token}
{
  "status": "shipped",
  "trackingNumber": "string"
}
```

### Get Reviews
```bash
GET /api/reviews
  ?productId={id}
  &page=1
  &pageSize=20
```

### Create Review
```bash
POST /api/reviews
Auth: Bearer {token}
{
  "productId": "string",
  "orderId": "string",
  "rating": 1-5,
  "title": "string",
  "content": "string (min 10)"
}
```

### Validate Coupon
```bash
POST /api/coupons/validate
{
  "code": "SAVE10",
  "cartTotal": 150.00
}
```

## Error Response Codes

| Code | Status | Meaning |
|------|--------|---------|
| `VALIDATION_ERROR` | 400 | Invalid input |
| `UNAUTHORIZED` | 401 | Auth required |
| `FORBIDDEN` | 403 | Permission denied |
| `NOT_FOUND` | 404 | Resource missing |
| `CONFLICT` | 409 | Duplicate/constraint |
| `INSUFFICIENT_INVENTORY` | 409 | Out of stock |
| `INVALID_COUPON` | 400 | Bad coupon |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## TypeScript Types

```typescript
// Imports
import {
  Product,
  Order,
  Customer,
  Review,
  Cart,
  Coupon,
  Inventory,
  AuditLog,
  ApiResponse,
  PaginatedResponse,
} from '@/lib/types/firestore';

// Validation inputs
import {
  CreateProductInput,
  CreateOrderInput,
  AddToCartInput,
  CreateReviewInput,
  CreateCouponInput,
} from '@/lib/schemas/validation';
```

## Firebase Admin Operations

```typescript
import { db, auth, createAuditLog } from '@/lib/firebase/admin';
import { getProduct, createOrder, validateCoupon } from '@/lib/firebase/operations';
import { createUserWithRole, updateUserRole } from '@/lib/api/auth-helpers';
```

## Database Collections

| Collection | Document ID | Purpose |
|-----------|------------|---------|
| `products` | UUID | Product catalog |
| `orders` | UUID | Customer orders |
| `customers` | Firebase UID | User profiles |
| `inventory` | productId | Stock tracking |
| `reviews` | UUID | Product reviews |
| `carts` | (query by userId) | Shopping carts |
| `coupons` | UUID | Discount codes |
| `auditLogs` | UUID | Activity logs |

## Environment Variables

```env
# Required for server
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=

# Required for browser
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

## Firestore Indexes

**Create in Firebase Console → Firestore → Indexes**

### Required Composite Indexes
- orders: `userId + status + createdAt DESC`
- orders: `status + createdAt DESC`
- reviews: `productId + status + createdAt DESC`
- reviews: `productId + rating DESC`
- products: `category + status + createdAt DESC`
- coupons: `status + validFrom + validUntil`
- customers: `status + totalSpent DESC + memberSince DESC`

## Security Rules

```firestore
// Public read
allow read: if true;

// Own data only
allow read, write: if request.auth.uid == userId;

// Admin only
allow write: if request.auth.token.admin == true;

// Immutable
allow create: if true;
allow update, delete: if false;
```

## Performance Tips

1. **Use pagination**: `limit(20)` instead of getting all docs
2. **Index your queries**: Create composite indexes
3. **Cache client-side**: Use TanStack Query with staleTime
4. **Denormalize**: Store frequently accessed data in document
5. **Batch reads**: Use multiple `where` conditions instead of multiple queries

## Testing API Endpoints

```bash
# Get token in browser
const token = await firebase.auth().currentUser.getIdToken();
console.log(token);

# Test public endpoint
curl http://localhost:3000/api/products

# Test authenticated endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/orders

# Test with body
curl -X POST http://localhost:3000/api/cart/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"productId": "id", "quantity": 1}'
```

## Common Patterns

### Pagination
```typescript
const { page = 1, pageSize = 20 } = params;
const offset = (page - 1) * pageSize;
const { items, total } = await getProducts(filters, pageSize, offset);
const hasMore = page * pageSize < total;
```

### Error Handling
```typescript
try {
  return createSuccessResponse(data);
} catch (error) {
  if (error instanceof ZodError) {
    return createErrorResponse(error);
  }
  if (error instanceof ApiError) {
    return createErrorResponse(error);
  }
  console.error('Unexpected error:', error);
  return createErrorResponse(error);
}
```

### Transactions
```typescript
await db.runTransaction(async (transaction) => {
  const docRef = db.collection('...').doc('...');
  const doc = await transaction.get(docRef);
  
  if (!doc.exists) throw new NotFoundError('...');
  
  transaction.update(docRef, { field: newValue });
  // Auto-commits on success or rolls back on error
});
```

## Debugging

```typescript
// Log variable states
console.log('[v0] Checking user:', user);
console.log('[v0] Order data:', orderData);

// Check Firestore connection
const doc = await db.collection('_test').doc('test').get();
console.log('[Firebase] Connected:', doc.exists);

// Verify token
const token = await currentUser.getIdToken();
console.log('[Auth] Token:', token.substring(0, 20) + '...');

// Check permissions
console.log('[Auth] Claims:', authRequest.user?.claims);
```

## Deployment Commands

```bash
# Deploy rules
firebase deploy --only firestore:rules

# Build for production
npm run build

# Start production server
npm run start

# Deploy to Vercel
vercel deploy --prod
```

## Files to Review

1. **For API patterns**: `app/api/products/route.ts`
2. **For database operations**: `lib/firebase/operations.ts`
3. **For error handling**: `lib/api/errors.ts`
4. **For authentication**: `lib/api/auth-helpers.ts`
5. **For validation**: `lib/schemas/validation.ts`
6. **For full API docs**: `ECOMMERCE_API_DOCS.md`
7. **For setup**: `SETUP_GUIDE.md`
8. **For architecture**: `ARCHITECTURE.md`

---

**Quick Reference v1.0** | April 2026
