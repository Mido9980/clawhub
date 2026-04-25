# System Architecture & Design

Comprehensive overview of the e-commerce platform architecture, data flow, and design decisions.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Data Flow](#data-flow)
3. [Collection Relationships](#collection-relationships)
4. [Consistency Model](#consistency-model)
5. [Scalability Strategy](#scalability-strategy)
6. [Disaster Recovery](#disaster-recovery)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
│  (React/TypeScript with Firebase SDK)                       │
│  - Authentication (Firebase Auth)                            │
│  - Real-time subscriptions                                  │
│  - Local caching (TanStack Query)                           │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS + ID Token
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Next.js)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Route Handlers: /api/*                               │   │
│  │ - Products, Orders, Cart, Coupons, Reviews          │   │
│  │ - Authentication Middleware                          │   │
│  │ - Request Validation (Zod)                           │   │
│  │ - Error Handling                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Services Layer                                        │   │
│  │ - Firebase Operations (CRUD)                         │   │
│  │ - Business Logic                                      │   │
│  │ - Transactions                                        │   │
│  │ - Audit Logging                                       │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │ Admin SDK
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              Database Layer (Firestore)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Collections:                                          │   │
│  │ - products, orders, customers, inventory            │   │
│  │ - reviews, carts, coupons, auditLogs                │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Security Layer (Firestore Rules)                      │   │
│  │ - Role-based access control                          │   │
│  │ - Row-level security                                 │   │
│  │ - Field-level validation                             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │                           │
         ↓                           ↓
   ┌─────────────┐           ┌──────────────┐
   │   Storage   │           │   Auth SDK   │
   │  (Firestore)│           │  (Firebase)  │
   └─────────────┘           └──────────────┘
```

### Technology Stack Decision Rationale

| Component | Technology | Reason |
|-----------|-----------|--------|
| Database | Firestore | NoSQL flexibility, real-time capabilities, built-in security |
| Backend | Next.js | Server components, API routes, full-stack framework |
| Language | TypeScript | Type safety, better DX, fewer runtime errors |
| Validation | Zod | Runtime validation, type inference |
| Authentication | Firebase Auth | Integrated with Firestore, managed service |
| Client State | TanStack Query | Server state management, caching, sync |

---

## Data Flow

### User Registration & Authentication

```
1. User enters email/password
   ↓
2. Firebase Auth creates user account
   ├─→ Sets custom claims (role: 'customer')
   └─→ Sends verification email
   ↓
3. Admin SDK creates customer profile document
   ├─→ personalizedjection: { newsletter, notifications }
   └─→ Initialize totals: { orderCount: 0, totalSpent: 0 }
   ↓
4. Auth token returned to client
   ↓
5. Client stores token in localStorage
   ↓
6. Subsequent requests include token in Authorization header
```

### Product Browse & Add to Cart

```
1. Client requests /api/products?category=electronics
   ↓
2. No auth required (public read)
   ↓
3. Firestore returns active products (optimized query)
   ├─→ Uses index: category + status
   └─→ Paginated results (20 per page)
   ↓
4. Client displays products with TanStack Query caching
   ↓
5. User clicks "Add to Cart"
   ├─→ Authenticates request
   ├─→ Validates product exists & in stock
   ├─→ Adds/updates item in user's cart
   ├─→ Recalculates totals
   └─→ Returns updated cart
   ↓
6. Client updates local cache (TanStack Query)
```

### Order Creation (Multi-Step Transaction)

```
1. User submits checkout
   ↓
2. POST /api/orders with validated data
   ├─→ Authenticate user
   ├─→ Validate request body (Zod)
   └─→ Check inventory availability
   ↓
3. Firestore Transaction (all-or-nothing):
   
   Step A: Get current cart
   ↓
   Step B: For each item, reserve inventory
         ├─→ Check available >= quantity
         └─→ Decrement available, increment reserved
   ↓
   Step C: Calculate order totals
         ├─→ Subtotal = sum(price × quantity)
         ├─→ Tax = subtotal × 0.1
         └─→ Shipping = items.length × 5
   ↓
   Step D: Create order document
         ├─→ status: 'pending'
         ├─→ Items denormalized (price at purchase)
         └─→ Addresses stored
   ↓
   Step E: Clear user's cart
   ↓
   Step F: Commit transaction (all succeed or all fail)
   ↓
4. If transaction succeeds:
   ├─→ Create audit log entry
   ├─→ Return order confirmation
   └─→ Client redirects to order tracking
   ↓
5. If transaction fails:
   ├─→ Inventory rollback automatic
   ├─→ Return error with details
   └─→ User retries checkout
```

### Admin Product Management

```
1. Admin visits product creation form
   ↓
2. Fills in product details + uploads images
   ↓
3. POST /api/products
   ├─→ Verify Authorization header has admin token
   ├─→ Validate request (Zod schema)
   └─→ Check admin role via custom claims
   ↓
4. If authorized:
   
   Step A: Create product document
   ├─→ Generate product ID
   ├─→ Store all fields
   └─→ Set status: 'draft'
   ↓
   Step B: Create inventory record
   ├─→ Mirror product ID
   ├─→ Initialize quantities
   └─→ Set reorder point
   ↓
   Step C: Create audit log
         ├─→ action: 'PRODUCT_CREATED'
         ├─→ userId: admin's ID
         └─→ changes: { before: {}, after: {...product} }
   ↓
5. Return created product with ID
   ↓
6. Admin updates status to 'active' (PATCH /api/products/[id])
   ├─→ Verify admin token
   ├─→ Update status field
   ├─→ Audit log updated status
   └─→ Product now visible to customers
```

---

## Collection Relationships

### Entity Relationship Diagram

```
┌─────────────────┐
│  CUSTOMERS      │
│  (Firebase UID) │
├─────────────────┤
│ • email         │
│ • firstName     │
│ • lastName      │
│ • totalSpent    │
│ • tags          │
└────────┬────────┘
         │
    1:N  │ userId reference
         │
         └──────────────────┬─────────────────────┐
                            │                     │
            ┌───────────────▼──────┐   ┌──────────▼──────────┐
            │      ORDERS          │   │      CARTS          │
            │   (Order Documents)  │   │  (Shopping Carts)   │
            ├──────────────────────┤   ├─────────────────────┤
            │ • orderNumber        │   │ • items []          │
            │ • items[] (denorm)   │   │ • subtotal          │
            │ • total              │   │ • couponDiscount    │
            │ • status             │   │ • expiresAt (TTL)   │
            │ • addresses          │   └─────────────────────┘
            │ • paymentMethod      │
            └───────────┬──────────┘
                        │
                   1:N  │ productId reference
                        │
         ┌──────────────▼───────────────┐
         │      PRODUCTS               │
         │  (Product Catalog)          │
         ├─────────────────────────────┤
         │ • name                      │
         │ • price                     │
         │ • category                  │
         │ • images[]                  │
         │ • stock                     │
         │ • status                    │
         └──────────────┬──────────────┘
                        │
                   1:1  │ productId reference
                        │
         ┌──────────────▼────────────┐
         │     INVENTORY             │
         │  (Stock Management)       │
         ├───────────────────────────┤
         │ • quantity                │
         │ • reserved                │
         │ • available               │
         │ • reorderPoint            │
         │ • history[]               │
         └───────────────────────────┘

┌──────────────────────────────┐
│         REVIEWS              │
│  (Product Reviews)           │
├──────────────────────────────┤
│ • productId (reference) ─────┤──→ PRODUCTS
│ • userId (reference) ────────┤──→ CUSTOMERS
│ • orderId (reference) ───────┤──→ ORDERS
│ • rating                     │
│ • status (pending/approved)  │
│ • helpful/unhelpful          │
└──────────────────────────────┘

┌──────────────────────────────┐
│       COUPONS                │
│  (Discount Codes)            │
├──────────────────────────────┤
│ • code (unique index)        │
│ • discountType               │
│ • discountValue              │
│ • validFrom/Until            │
│ • applicableProductIds[]     │
│ • applicableCategories[]     │
└──────────────────────────────┘

┌──────────────────────────────┐
│      AUDIT LOGS              │
│  (Activity Trail)            │
├──────────────────────────────┤
│ • action                     │
│ • userId                     │
│ • targetCollection           │
│ • targetDocId                │
│ • changes: {before, after}   │
│ • timestamp (immutable)      │
└──────────────────────────────┘
```

### Key Relationships

**1:N (One-to-Many)**:
- One Customer → Many Orders
- One Customer → Many Cart items
- One Product → Many Reviews

**1:1 (One-to-One)**:
- One Product → One Inventory record

**Reference (Foreign Key)**:
- Orders references Customers (userId)
- Orders references Products (via items[])
- Reviews references Products, Customers, Orders
- Cart references Products (via items[])

**Denormalization**:
- Product price cached in Orders (price_at_purchase)
- Product info cached in Order items
- Customer name cached in Reviews for display

---

## Consistency Model

### Strong Consistency (Transactional)

**Order Creation**:
```
BEGIN TRANSACTION
  1. Verify cart exists
  2. Validate inventory
  3. Reserve inventory
  4. Create order
  5. Clear cart
COMMIT OR ROLLBACK

Result: All-or-nothing atomicity
```

**Benefits**:
- Inventory can never be oversold
- Cart cannot have stale items
- Orders always have valid data

**Trade-off**: Slightly slower writes, but guaranteed correctness

### Eventual Consistency (Asynchronous)

**Order Status Updates**:
```
Admin updates order status
  ↓
Order document updated immediately
  ↓
Async: Update customer totalSpent/orderCount
  ↓
Async: Send email notification
  ↓
Async: Update product popularity metrics

Result: Data eventually consistent (seconds)
```

**Benefits**:
- Fast status updates
- Non-blocking operations
- Can retry if fails

**Trade-off**: Brief delay before all data synchronized

### Data Validation Layers

**Layer 1: Client**:
```typescript
// Zod schema validation before submission
const schema = createProductSchema;
schema.parse(formData); // Throws if invalid
```

**Layer 2: API**:
```typescript
// Validate incoming request
const validatedData = createProductSchema.parse(body);
```

**Layer 3: Database**:
```firestore
// Firestore rules validate at database level
allow create: if request.resource.data.price > 0
           && request.resource.data.name.size() > 3;
```

---

## Scalability Strategy

### Read-Heavy Operations (Products)

**Challenge**: Thousands of concurrent product views

**Solution**:
1. **Denormalization**: Cache frequently accessed fields
2. **Indexing**: Composite indexes on common queries
3. **Pagination**: Limit results per request
4. **Caching**: Client-side with TanStack Query
5. **CDN**: Static content (images) served from CDN

**Example Query** (optimized):
```typescript
// Without index (slow)
products
  .where('status', '==', 'active')
  .where('category', '==', 'electronics')
  .where('price', '<', 100)
  .orderBy('createdAt', 'desc')
  // Requires 3 indexes, many doc reads

// With index and limits (fast)
products
  .where('status', '==', 'active')
  .where('category', '==', 'electronics')
  .orderBy('createdAt', 'desc')
  .limit(20)
  // Uses 1 composite index, 20 doc reads
```

### Write-Heavy Operations (Orders)

**Challenge**: High-volume order creation

**Solution**:
1. **Transaction batching**: Group related writes
2. **Sharding**: Distribute write load
3. **Queue-based processing**: Async operations
4. **Retry logic**: Exponential backoff

**Example Sharding** (for high-volume counters):
```typescript
// Instead of single document with counter
// Single inventory doc: writes compete for lock
const inventory = db.collection('inventory').doc(productId);
inventory.update({ quantity: decrement(1) }); // Bottleneck

// Use sharded subcollection
const shard = Math.floor(Math.random() * 10); // 0-9
const shardedRef = db
  .collection('inventory')
  .doc(productId)
  .collection('quantity_shards')
  .doc(`shard_${shard}`);
shardedRef.update({ count: decrement(1) }); // Distributed

// Read: aggregate all shards
const shards = await db
  .collection('inventory')
  .doc(productId)
  .collection('quantity_shards')
  .get();
const total = shards.docs.reduce((sum, doc) => sum + doc.data().count, 0);
```

### Storage Scaling

**Collection Size Estimates**:

| Collection | Est. Size | Growth |
|-----------|-----------|---------|
| Products | 1M docs | 100/day |
| Customers | 1M docs | 1K/day |
| Orders | 10M docs | 10K/day |
| OrderItems | 50M docs | 50K/day |
| Reviews | 10M docs | 10K/day |
| AuditLogs | 100M docs | 100K/day |

**Mitigation Strategies**:
1. **TTL**: Auto-delete old data (e.g., audit logs after 90 days)
2. **Archiving**: Move old data to Cloud Storage
3. **Partitioning**: Split collections by time/region
4. **Cleanup Jobs**: Periodic deletion of test/duplicate data

### Query Optimization at Scale

```typescript
// SLOW: Scanning large collection
db.collection('orders')
  .where('userId', '==', uid)
  .get() // Reads ALL matching docs

// FAST: Pagination
const query = db
  .collection('orders')
  .where('userId', '==', uid)
  .orderBy('createdAt', 'desc')
  .limit(20); // Only reads 20 docs

// FASTER: Indexed query
// Create index: userId + createdAt
```

---

## Disaster Recovery

### Data Backup Strategy

**Automated Backups**:
```bash
# Google Cloud Firestore Backups (24-hour retention)
gcloud firestore backups create \
  --async \
  --retention-duration=30d

# Or enable scheduled backups in console
```

**Point-in-Time Recovery**:
1. Firestore maintains transaction logs
2. Can restore to any point within 35 days
3. Request restoration via support

### Failover Strategy

**Multi-Region Deployment**:
1. Application deployed to multiple regions
2. Database: Firestore multi-region (for premium)
3. DNS failover: Route to nearest healthy region

**Example Firestore Multi-Region**:
```
Primary: us-central1 (Read/Write)
Secondary: eu-west1 (Read-only replicas)
```

### Rollback Procedures

**Database Rollback**:
```bash
# 1. Create backup snapshot
gcloud firestore export gs://bucket/backup-[timestamp]

# 2. If needed, restore from backup
gcloud firestore import gs://bucket/backup-[timestamp]
```

**API Rollback**:
```bash
# 1. Git: Tag current version
git tag -a v2.0.0 -m "Release v2.0.0"

# 2. Deploy previous version
git checkout v1.9.9
npm run build && vercel deploy --prod

# 3. Monitor for issues
```

### High Availability Checklist

- [ ] Firestore backups enabled and tested
- [ ] API deployed to multiple regions
- [ ] Health checks configured
- [ ] Error tracking (Sentry) active
- [ ] Monitoring alerts configured
- [ ] Runbooks documented for common issues
- [ ] Disaster recovery tested quarterly

---

## Performance Benchmarks

### Expected Performance Metrics

| Operation | Metric | Target |
|-----------|--------|--------|
| Product List | Latency | < 200ms |
| Product Detail | Latency | < 100ms |
| Add to Cart | Latency | < 150ms |
| Create Order | Latency | < 500ms |
| Get Reviews | Latency | < 200ms |
| Search | Latency | < 300ms |
| API Availability | Uptime | 99.9% |
| Database Read | Cost | ~$0.06/100K reads |
| Database Write | Cost | ~$0.18/100K writes |

### Monitoring Queries

```typescript
// Monitor read costs
const reads = db.collection('products').where('status', '==', 'active').count();
// Est: 10K products = ~$0.60/day

// Monitor write costs
const writes = db.collection('orders').count();
// Est: 10K orders/day = ~$1.80/day

// Estimate monthly cost
// 300K reads/day = ~$18/month (reads)
// 30K writes/day = ~$5.40/month (writes)
// Total: ~$23/month base cost
```

---

## Future Improvements

1. **Machine Learning**:
   - Product recommendations based on purchase history
   - Fraud detection for orders
   - Price optimization

2. **Advanced Features**:
   - Real-time inventory updates via Firestore listeners
   - Push notifications for order status
   - Advanced search with Algolia
   - Multi-language support

3. **Performance**:
   - Implement caching layer (Redis)
   - GraphQL API for complex queries
   - API rate limiting per user tier

4. **Analytics**:
   - Custom event tracking
   - Cohort analysis
   - Revenue forecasting
   - Inventory optimization

---

**Document Version**: 1.0.0  
**Last Updated**: April 2026
