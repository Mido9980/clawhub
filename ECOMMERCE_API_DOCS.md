# E-Commerce Platform: Complete API Documentation

## Overview

A comprehensive NoSQL database solution built with Google Cloud Firestore and Next.js, providing a production-ready e-commerce backend with secure authentication, role-based access control, and optimized performance.

## Table of Contents

1. [Architecture](#architecture)
2. [Authentication & Authorization](#authentication--authorization)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Error Handling](#error-handling)
6. [Security](#security)
7. [Performance Optimization](#performance-optimization)
8. [Deployment Guide](#deployment-guide)

---

## Architecture

### Technology Stack

- **Database**: Google Cloud Firestore (NoSQL, document-based)
- **Backend**: Next.js 16 with TypeScript
- **Authentication**: Firebase Authentication
- **Validation**: Zod schemas
- **Client State**: TanStack Query (React Query)
- **Type Safety**: Full TypeScript throughout

### High-Level Data Flow

```
Client Request
    ↓
API Route Handler
    ↓
Authentication Middleware
    ↓
Validation Middleware (Zod)
    ↓
Firestore Operations
    ↓
Security Rules Check
    ↓
Audit Logging
    ↓
Response
```

---

## Authentication & Authorization

### User Roles

```typescript
type UserRole = 'customer' | 'admin' | 'super_admin';
```

**Role Hierarchy**:
- **Customer**: Can view products, manage own cart/orders/profile, create reviews
- **Admin**: Can manage products, inventory, view all orders, moderate reviews
- **SuperAdmin**: Full system access, user management, system configuration

### Firebase Custom Claims

Each user has custom claims set in Firebase:

```typescript
{
  role: 'customer' | 'admin' | 'super_admin',
  admin?: boolean,
  permissions?: string[]
}
```

### Authentication Flow

1. User logs in with Firebase Authentication
2. Firebase generates ID token
3. Client includes token in `Authorization: Bearer <token>` header
4. API verifies token with Firebase Admin SDK
5. Custom claims extracted and attached to request

### Setting User Claims

```typescript
// Admin operation to set user role
await setUserClaims(uid, {
  role: 'admin',
  admin: true,
  permissions: ['manage_products', 'manage_orders', 'view_analytics']
});
```

---

## Database Schema

### Collections Overview

| Collection | Purpose | TTL | Size Estimate |
|-----------|---------|-----|---------------|
| `products` | Product catalog | None | ~100-1M docs |
| `orders` | Customer orders | None | ~1M+ docs |
| `customers` | User profiles | None | ~100K-1M docs |
| `inventory` | Stock tracking | None | ~100-1M docs |
| `reviews` | Product reviews | None | ~1M+ docs |
| `carts` | Shopping carts | 30 days | ~100K docs |
| `coupons` | Discount codes | None | ~1K docs |
| `auditLogs` | Activity logs | 90 days | ~10M+ docs |

### Detailed Schema

#### Products

```typescript
{
  id: string;
  name: string;
  description: string;
  sku: string; // Unique identifier
  price: number;
  compareAtPrice?: number; // Original price
  stock: number;
  status: 'active' | 'archived' | 'draft';
  category: string; // Indexed
  tags: string[]; // For categorization
  images: { url: string; alt: string }[];
  specifications?: Record<string, unknown>;
  createdAt: Timestamp; // Indexed
  updatedAt: Timestamp;
  createdBy: string; // User reference
}
```

**Indexes**:
- `status + createdAt (DESC)`
- `category + status`
- `tags + status`
- `sku` (single field, case-insensitive search)

#### Orders

```typescript
{
  id: string;
  userId: string; // Reference
  orderNumber: string; // Unique, indexed
  items: [
    {
      productId: string;
      quantity: number;
      priceAtPurchase: number;
      discount?: number;
    }
  ];
  subtotal: number;
  tax: number;
  shippingCost: number;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: Address;
  billingAddress: Address;
  paymentMethod: {
    type: string;
    last4Digits: string;
    brand: string;
  };
  trackingNumber?: string;
  notes?: string;
  createdAt: Timestamp; // Indexed
  updatedAt: Timestamp;
}
```

**Indexes** (Composite):
- `userId + status + createdAt (DESC)`
- `status + createdAt (DESC)`
- `orderNumber`

#### Customers

```typescript
{
  id: string; // Firebase UID
  email: string; // Indexed
  firstName: string;
  lastName: string;
  phone: string;
  avatar?: string;
  defaultShippingAddress?: string; // Reference
  defaultBillingAddress?: string; // Reference
  status: 'active' | 'suspended' | 'inactive';
  totalSpent: number;
  orderCount: number;
  memberSince: Timestamp; // Indexed
  lastOrderAt?: Timestamp;
  preferences: {
    newsletter: boolean;
    notifications: boolean;
  };
  tags: string[]; // Segmentation
}
```

**Indexes**:
- `status + totalSpent (DESC)`
- `memberSince (DESC)`

#### Inventory

```typescript
{
  productId: string; // Mirrors product ID
  quantity: number;
  reserved: number; // For pending orders
  available: number; // Calculated: quantity - reserved
  reorderPoint: number;
  reorderQuantity: number;
  lastRestockedAt: Timestamp;
  warehouseLocation: string;
  batchNumber?: string;
  expiryDate?: Timestamp;
  history: [
    {
      action: string; // 'ADD', 'REDUCE', 'RESERVE', 'RELEASE'
      quantity: number;
      timestamp: Timestamp;
      note?: string;
    }
  ];
}
```

#### Reviews

```typescript
{
  id: string;
  productId: string; // Indexed
  userId: string; // Indexed
  orderId: string; // Indexed
  rating: number; // 1-5
  title: string;
  content: string;
  images?: string[];
  verified: boolean; // Verified purchase
  helpful: number;
  unhelpful: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp; // Indexed
}
```

**Indexes** (Composite):
- `productId + status + createdAt (DESC)`
- `productId + rating`
- `userId + createdAt (DESC)`

#### Carts

```typescript
{
  userId: string; // Reference, indexed
  items: [
    {
      productId: string;
      quantity: number;
      priceAtAddTime: number;
    }
  ];
  subtotal: number;
  couponCode?: string;
  couponDiscount: number;
  total: number;
  expiresAt: Timestamp; // 30 days, TTL
  lastModifiedAt: Timestamp;
}
```

#### Coupons

```typescript
{
  id: string;
  code: string; // Unique, indexed
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minimumPurchase: number;
  maxUses: number;
  usedCount: number;
  validFrom: Timestamp;
  validUntil: Timestamp;
  applicableProductIds: string[];
  applicableCategories: string[];
  status: 'active' | 'inactive' | 'expired';
  createdAt: Timestamp;
}
```

#### Audit Logs

```typescript
{
  id: string;
  action: string; // 'PRODUCT_CREATED', 'ORDER_UPDATED', etc.
  userId: string; // Who performed action
  targetCollection: string;
  targetDocId: string;
  changes?: {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  };
  metadata?: {
    ipAddress: string;
    userAgent: string;
  };
  timestamp: Timestamp; // Indexed
  status: 'success' | 'failure';
  errorMessage?: string;
}
```

---

## API Endpoints

### Base URL
```
https://your-domain.com/api
```

### Request Headers
```
Authorization: Bearer <firebase-id-token>
Content-Type: application/json
```

### Response Format (Success)
```json
{
  "success": true,
  "data": { /* response data */ },
  "timestamp": "2026-04-26T10:30:00Z"
}
```

### Response Format (Error)
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": { /* optional details */ }
  },
  "timestamp": "2026-04-26T10:30:00Z"
}
```

---

## Products Endpoints

### List Products

```
GET /api/products
```

**Query Parameters**:
- `page` (number): Page number, default 1
- `pageSize` (number): Items per page, default 20, max 100
- `category` (string): Filter by category
- `status` (string): Filter by status (active/archived/draft)
- `search` (string): Search products

**Example Request**:
```bash
curl -X GET "https://your-domain.com/api/products?category=electronics&page=1&pageSize=20"
```

**Response**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "prod123",
        "name": "Product Name",
        "price": 99.99,
        "category": "electronics",
        "stock": 50,
        "images": [{ "url": "...", "alt": "..." }]
      }
    ],
    "total": 150,
    "hasMore": true,
    "pageSize": 20,
    "page": 1
  },
  "timestamp": "2026-04-26T10:30:00Z"
}
```

### Get Product Details

```
GET /api/products/{id}
```

**Example Request**:
```bash
curl -X GET "https://your-domain.com/api/products/prod123"
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "prod123",
    "name": "Product Name",
    "description": "Full description",
    "price": 99.99,
    "category": "electronics",
    "stock": 50,
    "status": "active",
    "images": [{ "url": "...", "alt": "..." }],
    "specifications": { "color": "blue", "size": "large" },
    "createdAt": "2026-01-15T08:00:00Z",
    "updatedAt": "2026-04-20T12:30:00Z"
  },
  "timestamp": "2026-04-26T10:30:00Z"
}
```

### Create Product

```
POST /api/products
Authorization: Bearer <admin-token>
```

**Request Body**:
```json
{
  "name": "New Product",
  "description": "Product description (min 10 chars)",
  "sku": "SKU-001",
  "price": 99.99,
  "compareAtPrice": 129.99,
  "stock": 100,
  "status": "active",
  "category": "electronics",
  "tags": ["popular", "featured"],
  "images": [
    {
      "url": "https://example.com/image.jpg",
      "alt": "Product image"
    }
  ],
  "specifications": {
    "color": "blue",
    "size": "large"
  }
}
```

**Validation**:
- `name`: Min 3 characters
- `description`: Min 10 characters
- `sku`: Format `[A-Z0-9-]+`
- `price`: Must be positive
- `images`: At least 1 required

**Response**: Returns created product with ID

### Update Product

```
PATCH /api/products/{id}
Authorization: Bearer <admin-token>
```

**Request Body**: Same as create (all fields optional)

**Response**: Returns updated product

### Delete Product

```
DELETE /api/products/{id}
Authorization: Bearer <admin-token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "prod123",
    "deleted": true
  },
  "timestamp": "2026-04-26T10:30:00Z"
}
```

---

## Cart Endpoints

### Get Cart

```
GET /api/cart
Authorization: Bearer <user-token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "userId": "user123",
    "items": [
      {
        "productId": "prod123",
        "quantity": 2,
        "priceAtAddTime": 99.99
      }
    ],
    "subtotal": 199.98,
    "couponCode": "SAVE10",
    "couponDiscount": 20,
    "total": 179.98,
    "expiresAt": "2026-05-26T10:30:00Z",
    "lastModifiedAt": "2026-04-26T10:30:00Z"
  },
  "timestamp": "2026-04-26T10:30:00Z"
}
```

### Add to Cart

```
POST /api/cart/items
Authorization: Bearer <user-token>
```

**Request Body**:
```json
{
  "productId": "prod123",
  "quantity": 2
}
```

**Validation**:
- `productId`: Required
- `quantity`: Must be positive integer

**Response**: Returns updated cart

### Update Cart Item

```
PATCH /api/cart/items/{productId}
Authorization: Bearer <user-token>
```

**Request Body**:
```json
{
  "quantity": 5
}
```

**Note**: Set quantity to 0 to remove from cart

### Remove from Cart

```
DELETE /api/cart/items/{productId}
Authorization: Bearer <user-token>
```

---

## Orders Endpoints

### List User's Orders

```
GET /api/orders
Authorization: Bearer <user-token>
```

**Query Parameters**:
- `page` (number): Default 1
- `pageSize` (number): Default 20, max 100

**Response**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "order123",
        "orderNumber": "ORD-1234567890",
        "status": "processing",
        "total": 179.98,
        "items": [...],
        "createdAt": "2026-04-26T10:30:00Z"
      }
    ],
    "total": 5,
    "hasMore": false,
    "pageSize": 20,
    "page": 1
  },
  "timestamp": "2026-04-26T10:30:00Z"
}
```

### Get Order Details

```
GET /api/orders/{id}
Authorization: Bearer <user-token>
```

**Note**: User can only view own orders (unless admin)

**Response**: Detailed order object

### Create Order

```
POST /api/orders
Authorization: Bearer <user-token>
```

**Request Body**:
```json
{
  "items": [
    {
      "productId": "prod123",
      "quantity": 2,
      "priceAtPurchase": 99.99
    }
  ],
  "shippingAddress": {
    "street": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94102",
    "country": "USA"
  },
  "billingAddress": {
    "street": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94102",
    "country": "USA"
  },
  "paymentMethod": {
    "type": "credit_card",
    "last4Digits": "4242",
    "brand": "Visa"
  },
  "notes": "Optional delivery notes"
}
```

**Process**:
1. Validates cart items
2. Calculates totals (subtotal + tax + shipping)
3. Reserves inventory
4. Creates order record
5. Clears user's cart
6. Logs audit trail

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "order123",
    "orderNumber": "ORD-1234567890",
    "status": "pending",
    "total": 179.98
  },
  "timestamp": "2026-04-26T10:30:00Z"
}
```

### Update Order Status

```
PATCH /api/orders/{id}
Authorization: Bearer <admin-token>
```

**Request Body**:
```json
{
  "status": "shipped",
  "trackingNumber": "TRACK123"
}
```

**Valid Status Transitions**:
- `pending` → `processing` → `shipped` → `delivered`
- Any status → `cancelled` (if not delivered)

**Response**: Returns updated order

---

## Reviews Endpoints

### Get Product Reviews

```
GET /api/reviews?productId={productId}
```

**Query Parameters**:
- `productId` (string): Required
- `page` (number): Default 1
- `pageSize` (number): Default 20, max 100

**Response**: Paginated list of approved reviews

### Create Review

```
POST /api/reviews
Authorization: Bearer <user-token>
```

**Request Body**:
```json
{
  "productId": "prod123",
  "orderId": "order123",
  "rating": 5,
  "title": "Excellent product!",
  "content": "This product exceeded my expectations. Great quality and fast shipping.",
  "images": ["url1", "url2"]
}
```

**Validation**:
- `rating`: 1-5
- `title`: 3-100 characters
- `content`: 10-5000 characters
- `orderId`: Must be a valid order that contains product

**Process**:
1. Verifies user owns the order
2. Verifies order contains the product
3. Creates review with `status: 'pending'`
4. Marks review as verified purchase

**Response**: Returns created review

---

## Coupons Endpoints

### Validate Coupon

```
POST /api/coupons/validate
```

**Request Body**:
```json
{
  "code": "SAVE10",
  "cartTotal": 150.00
}
```

**Validation Checks**:
- Coupon exists
- Coupon is active
- Current date within validity period
- Usage limit not exceeded
- Cart total meets minimum purchase

**Response**:
```json
{
  "success": true,
  "data": {
    "code": "SAVE10",
    "discountType": "percentage",
    "discountValue": 10,
    "discountAmount": 15.00,
    "description": "Save 10% on your order"
  },
  "timestamp": "2026-04-26T10:30:00Z"
}
```

---

## Error Handling

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `CONFLICT` | 409 | Constraint violation |
| `RATE_LIMITED` | 429 | Too many requests |
| `INSUFFICIENT_INVENTORY` | 409 | Not enough stock |
| `INVALID_COUPON` | 400 | Coupon validation failed |
| `INTERNAL_ERROR` | 500 | Server error |

### Example Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "errors": [
        {
          "path": "price",
          "message": "Must be positive",
          "code": "invalid_type"
        }
      ]
    }
  },
  "timestamp": "2026-04-26T10:30:00Z"
}
```

---

## Security

### Security Rules

Firestore rules enforce:

1. **Products**: Public read, admin write
2. **Orders**: User reads own, admin manages
3. **Customers**: User reads/writes own, admin can read
4. **Cart**: User exclusive access
5. **Reviews**: Public read approved, user-created access
6. **Audit Logs**: Admin read only, immutable

### Best Practices Implemented

1. **Authentication**:
   - Firebase ID tokens required
   - Token validation on every request
   - Custom claims for role-based access

2. **Authorization**:
   - Middleware enforces permissions
   - Row-level security in Firestore rules
   - User isolation (can't access others' data)

3. **Data Protection**:
   - Sensitive data not in logs
   - Encrypted in transit (HTTPS)
   - Firestore encryption at rest

4. **Input Validation**:
   - Zod schemas validate all inputs
   - Type checking with TypeScript
   - Database-level validation rules

5. **Audit Logging**:
   - All write operations logged
   - Immutable audit trail
   - Metadata captured (IP, user agent)

---

## Performance Optimization

### Caching Strategy

**Client-Side (TanStack Query)**:
```typescript
const { data: products } = useQuery({
  queryKey: ['products', { category, page }],
  queryFn: () => fetchProducts({ category, page }),
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 30 * 60 * 1000, // 30 minutes
});
```

**Server-Side**:
- Denormalized fields (prices in orders)
- Pre-calculated totals
- Cached aggregations

### Indexing Strategy

**Composite Indexes**:
- `orders`: userId + status + createdAt
- `reviews`: productId + status + createdAt
- `products`: category + status + createdAt

**Single-Field Indexes**:
- High-cardinality fields
- Frequently filtered/sorted fields
- Query-hot data

### Query Optimization

1. **Limit fields returned**:
   ```
   GET /api/products?fields=id,name,price
   ```

2. **Pagination**:
   ```
   GET /api/orders?page=1&pageSize=20
   ```

3. **Filtering**:
   ```
   GET /api/products?status=active&category=electronics
   ```

4. **Sorting**:
   - Use indexed fields
   - Avoid sorting on unindexed fields

### Scalability Considerations

1. **Sharding** (for high-volume fields):
   - Store counters in sharded subcollections
   - Useful for product view counts, review counts

2. **Subcollections**:
   - Addresses under customers
   - Maintains document size limits

3. **Rate Limiting**:
   - 100 requests/minute per user (default)
   - Custom limits for admin operations

4. **Batch Operations**:
   - Batch reads for multiple products
   - Batch writes when possible

---

## Deployment Guide

### Environment Variables

```env
# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-email@firebase.com

# Firebase Client SDK
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-bucket.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Optional
SENTRY_DSN=optional-sentry-dsn
```

### Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### Deploy to Vercel

```bash
vercel deploy
```

### Health Check

```bash
curl https://your-domain.com/api/health
```

---

## Example: Complete Order Flow

### 1. Get Products

```bash
curl -X GET "https://your-domain.com/api/products?category=electronics"
```

### 2. Add to Cart

```bash
curl -X POST "https://your-domain.com/api/cart/items" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"productId": "prod123", "quantity": 2}'
```

### 3. Validate Coupon

```bash
curl -X POST "https://your-domain.com/api/coupons/validate" \
  -H "Content-Type: application/json" \
  -d '{"code": "SAVE10", "cartTotal": 199.98}'
```

### 4. Create Order

```bash
curl -X POST "https://your-domain.com/api/orders" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [...],
    "shippingAddress": {...},
    "billingAddress": {...},
    "paymentMethod": {...}
  }'
```

### 5. Track Order

```bash
curl -X GET "https://your-domain.com/api/orders/order123" \
  -H "Authorization: Bearer <token>"
```

### 6. Leave Review

```bash
curl -X POST "https://your-domain.com/api/reviews" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "prod123",
    "orderId": "order123",
    "rating": 5,
    "title": "Great product!",
    "content": "..."
  }'
```

---

## Support & Monitoring

### Error Tracking

Enable Sentry integration:
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.captureException(error);
```

### Audit Logging

Access audit logs:
```bash
curl -X GET "https://your-domain.com/api/admin/audit-logs" \
  -H "Authorization: Bearer <admin-token>"
```

### Performance Monitoring

Firestore provides built-in metrics:
- Query latency
- Document read/write operations
- Storage usage
- Index utilization

---

## FAQ

**Q: Can I cache product data?**
A: Yes! Use TanStack Query with 5-minute stale time for frequently accessed products.

**Q: How are transactions handled?**
A: Firestore transactions automatically handle multi-document consistency for order creation.

**Q: What's the maximum document size?**
A: 1 MB per document. Use subcollections for large data sets.

**Q: How can I search products?**
A: Use the `/api/products?search=query` endpoint for text search, or integrate Algolia for advanced search.

---

## Support

For issues or questions:
- Check Firestore documentation: https://firebase.google.com/docs/firestore
- Next.js docs: https://nextjs.org/docs
- File issues on GitHub repository
