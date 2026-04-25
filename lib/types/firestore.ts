// Firestore collection types for e-commerce platform

import { Timestamp } from 'firebase/firestore';

// Product Types
export interface Product {
  id: string;
  name: string;
  description: string;
  sku: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  status: 'active' | 'archived' | 'draft';
  category: string;
  tags: string[];
  images: { url: string; alt: string }[];
  specifications?: Record<string, unknown>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

// Order Types
export interface OrderItem {
  productId: string;
  quantity: number;
  priceAtPurchase: number;
  discount?: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface PaymentMethod {
  type: string;
  last4Digits: string;
  brand: string;
}

export interface Order {
  id: string;
  userId: string;
  orderNumber: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shippingCost: number;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: Address;
  billingAddress: Address;
  paymentMethod: PaymentMethod;
  trackingNumber?: string;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Customer Types
export interface CustomerPreferences {
  newsletter: boolean;
  notifications: boolean;
}

export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  avatar?: string;
  defaultShippingAddress?: string;
  defaultBillingAddress?: string;
  status: 'active' | 'suspended' | 'inactive';
  totalSpent: number;
  orderCount: number;
  memberSince: Timestamp;
  lastOrderAt?: Timestamp;
  preferences: CustomerPreferences;
  tags: string[];
}

// Inventory Types
export interface InventoryHistory {
  action: string;
  quantity: number;
  timestamp: Timestamp;
  note?: string;
}

export interface Inventory {
  productId: string;
  quantity: number;
  reserved: number;
  available: number;
  reorderPoint: number;
  reorderQuantity: number;
  lastRestockedAt: Timestamp;
  warehouseLocation: string;
  batchNumber?: string;
  expiryDate?: Timestamp;
  history: InventoryHistory[];
}

// Review Types
export interface Review {
  id: string;
  productId: string;
  userId: string;
  orderId: string;
  rating: number;
  title: string;
  content: string;
  images?: string[];
  verified: boolean;
  helpful: number;
  unhelpful: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
}

// Cart Types
export interface CartItem {
  productId: string;
  quantity: number;
  priceAtAddTime: number;
}

export interface Cart {
  userId: string;
  items: CartItem[];
  subtotal: number;
  couponCode?: string;
  couponDiscount: number;
  total: number;
  expiresAt: Timestamp;
  lastModifiedAt: Timestamp;
}

// Coupon Types
export interface Coupon {
  id: string;
  code: string;
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

// Audit Log Types
export interface AuditLog {
  id: string;
  action: string;
  userId: string;
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
  timestamp: Timestamp;
  status: 'success' | 'failure';
  errorMessage?: string;
}

// User Roles
export type UserRole = 'customer' | 'admin' | 'super_admin';

export interface UserCustomClaims {
  role: UserRole;
  admin?: boolean;
  permissions?: string[];
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  pageSize: number;
}
