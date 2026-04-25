import { db } from '@/lib/firebase/admin';
import { Product, Order, Customer, Cart, Review, Coupon, Inventory } from '@/lib/types/firestore';
import {
  NotFoundError,
  InsufficientInventoryError,
  ConflictError,
  InvalidCouponError,
} from '@/lib/api/errors';
import * as admin from 'firebase-admin';

// Product operations
export async function getProduct(productId: string): Promise<Product> {
  const doc = await db.collection('products').doc(productId).get();
  if (!doc.exists) {
    throw new NotFoundError('Product');
  }
  return { id: doc.id, ...doc.data() } as Product;
}

export async function getProducts(
  filters?: { category?: string; status?: string; tags?: string[] },
  pageSize: number = 20,
  offset: number = 0
): Promise<{ items: Product[]; total: number }> {
  let query: any = db.collection('products');

  if (filters?.status) {
    query = query.where('status', '==', filters.status);
  }
  if (filters?.category) {
    query = query.where('category', '==', filters.category);
  }

  const total = (await query.count().get()).data().count;
  const snapshot = await query.orderBy('createdAt', 'desc').limit(pageSize).offset(offset).get();

  const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product));
  return { items, total };
}

export async function searchProducts(searchText: string, pageSize: number = 20, offset: number = 0) {
  const snapshot = await db
    .collection('products')
    .where('status', '==', 'active')
    .orderBy('createdAt', 'desc')
    .limit(pageSize)
    .offset(offset)
    .get();

  const items = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as Product))
    .filter((product) => {
      const search = searchText.toLowerCase();
      return (
        product.name.toLowerCase().includes(search) ||
        product.description.toLowerCase().includes(search) ||
        product.sku.toLowerCase().includes(search)
      );
    });

  return { items, total: items.length };
}

export async function createProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const docRef = await db.collection('products').add({
    ...product,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
}

export async function updateProduct(
  productId: string,
  updates: Partial<Omit<Product, 'id' | 'createdAt'>>
) {
  const productRef = db.collection('products').doc(productId);
  const doc = await productRef.get();

  if (!doc.exists) {
    throw new NotFoundError('Product');
  }

  await productRef.update({
    ...updates,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function deleteProduct(productId: string) {
  const productRef = db.collection('products').doc(productId);
  const doc = await productRef.get();

  if (!doc.exists) {
    throw new NotFoundError('Product');
  }

  await productRef.delete();
}

// Order operations
export async function getOrder(orderId: string): Promise<Order> {
  const doc = await db.collection('orders').doc(orderId).get();
  if (!doc.exists) {
    throw new NotFoundError('Order');
  }
  return { id: doc.id, ...doc.data() } as Order;
}

export async function getUserOrders(
  userId: string,
  pageSize: number = 20,
  offset: number = 0
): Promise<{ items: Order[]; total: number }> {
  const query = db
    .collection('orders')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc');

  const total = (await query.count().get()).data().count;
  const snapshot = await query.limit(pageSize).offset(offset).get();

  const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Order));
  return { items, total };
}

export async function createOrder(order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const docRef = await db.collection('orders').add({
    ...order,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
}

export async function updateOrderStatus(
  orderId: string,
  status: Order['status'],
  trackingNumber?: string
) {
  const orderRef = db.collection('orders').doc(orderId);
  const doc = await orderRef.get();

  if (!doc.exists) {
    throw new NotFoundError('Order');
  }

  await orderRef.update({
    status,
    ...(trackingNumber && { trackingNumber }),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// Inventory operations
export async function getInventory(productId: string): Promise<Inventory> {
  const doc = await db.collection('inventory').doc(productId).get();
  if (!doc.exists) {
    throw new NotFoundError('Inventory');
  }
  return { productId: doc.id, ...doc.data() } as Inventory;
}

export async function reserveInventory(productId: string, quantity: number) {
  const inventoryRef = db.collection('inventory').doc(productId);
  const doc = await inventoryRef.get();

  if (!doc.exists) {
    throw new NotFoundError('Inventory');
  }

  const inventory = doc.data() as Inventory;
  if (inventory.available < quantity) {
    throw new InsufficientInventoryError(inventory.available, quantity);
  }

  await inventoryRef.update({
    reserved: inventory.reserved + quantity,
    available: inventory.available - quantity,
  });
}

export async function releaseInventory(productId: string, quantity: number) {
  const inventoryRef = db.collection('inventory').doc(productId);
  const doc = await inventoryRef.get();

  if (!doc.exists) {
    throw new NotFoundError('Inventory');
  }

  const inventory = doc.data() as Inventory;

  await inventoryRef.update({
    reserved: Math.max(0, inventory.reserved - quantity),
    available: inventory.available + quantity,
  });
}

// Cart operations
export async function getCart(userId: string): Promise<Cart> {
  const query = db.collection('carts').where('userId', '==', userId).limit(1);
  const snapshot = await query.get();

  if (snapshot.empty) {
    // Return empty cart
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    return {
      userId,
      items: [],
      subtotal: 0,
      couponDiscount: 0,
      total: 0,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      lastModifiedAt: admin.firestore.Timestamp.now(),
    };
  }

  const doc = snapshot.docs[0];
  return { userId, ...doc.data() } as Cart;
}

export async function upsertCart(cart: Cart) {
  const query = db.collection('carts').where('userId', '==', cart.userId).limit(1);
  const snapshot = await query.get();

  if (snapshot.empty) {
    await db.collection('carts').add({
      ...cart,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    await snapshot.docs[0].ref.update({
      ...cart,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

// Customer operations
export async function getCustomer(userId: string): Promise<Customer> {
  const doc = await db.collection('customers').doc(userId).get();
  if (!doc.exists) {
    throw new NotFoundError('Customer');
  }
  return { id: doc.id, ...doc.data() } as Customer;
}

export async function updateCustomer(
  userId: string,
  updates: Partial<Omit<Customer, 'id'>>
) {
  const customerRef = db.collection('customers').doc(userId);
  await customerRef.update(updates);
}

// Review operations
export async function getProductReviews(
  productId: string,
  pageSize: number = 20,
  offset: number = 0
): Promise<{ items: Review[]; total: number }> {
  const query = db
    .collection('reviews')
    .where('productId', '==', productId)
    .where('status', '==', 'approved')
    .orderBy('createdAt', 'desc');

  const total = (await query.count().get()).data().count;
  const snapshot = await query.limit(pageSize).offset(offset).get();

  const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Review));
  return { items, total };
}

export async function createReview(review: Omit<Review, 'id' | 'createdAt'>) {
  const docRef = await db.collection('reviews').add({
    ...review,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return docRef.id;
}

// Coupon operations
export async function validateCoupon(code: string, cartTotal: number): Promise<Coupon> {
  const query = db.collection('coupons').where('code', '==', code.toUpperCase()).limit(1);
  const snapshot = await query.get();

  if (snapshot.empty) {
    throw new InvalidCouponError('Coupon code not found');
  }

  const coupon = snapshot.docs[0].data() as Coupon;
  const now = new Date();

  if (coupon.status !== 'active') {
    throw new InvalidCouponError('Coupon is not active');
  }

  if (coupon.validFrom.toDate() > now) {
    throw new InvalidCouponError('Coupon is not yet valid');
  }

  if (coupon.validUntil.toDate() < now) {
    throw new InvalidCouponError('Coupon has expired');
  }

  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    throw new InvalidCouponError('Coupon usage limit reached');
  }

  if (coupon.minimumPurchase && cartTotal < coupon.minimumPurchase) {
    throw new InvalidCouponError(
      `Minimum purchase of $${coupon.minimumPurchase} required`
    );
  }

  return coupon;
}

export async function getCoupon(couponId: string): Promise<Coupon> {
  const doc = await db.collection('coupons').doc(couponId).get();
  if (!doc.exists) {
    throw new NotFoundError('Coupon');
  }
  return { id: doc.id, ...doc.data() } as Coupon;
}

export async function createCoupon(coupon: Omit<Coupon, 'id' | 'createdAt'>) {
  const docRef = await db.collection('coupons').add({
    ...coupon,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return docRef.id;
}

export async function incrementCouponUsage(couponId: string) {
  const couponRef = db.collection('coupons').doc(couponId);
  await couponRef.update({
    usedCount: admin.firestore.FieldValue.increment(1),
  });
}
