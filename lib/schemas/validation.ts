import { z } from 'zod';

// Address schema
export const addressSchema = z.object({
  street: z.string().min(5, 'Street address required'),
  city: z.string().min(2, 'City required'),
  state: z.string().min(2, 'State required'),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code'),
  country: z.string().min(2, 'Country required'),
});

// Product schemas
export const createProductSchema = z.object({
  name: z.string().min(3, 'Product name must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  sku: z.string().regex(/^[A-Z0-9-]+$/, 'Invalid SKU format'),
  price: z.number().positive('Price must be positive'),
  compareAtPrice: z.number().positive().optional(),
  stock: z.number().int().nonnegative('Stock must be non-negative'),
  status: z.enum(['active', 'archived', 'draft']).default('active'),
  category: z.string().min(2),
  tags: z.array(z.string()).default([]),
  images: z.array(z.object({
    url: z.string().url(),
    alt: z.string(),
  })).min(1, 'At least one image required'),
  specifications: z.record(z.unknown()).optional(),
});

export const updateProductSchema = createProductSchema.partial();

// Order schemas
export const orderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  priceAtPurchase: z.number().positive(),
  discount: z.number().nonnegative().optional(),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'Order must have at least one item'),
  shippingAddress: addressSchema,
  billingAddress: addressSchema,
  paymentMethod: z.object({
    type: z.string(),
    last4Digits: z.string().regex(/^\d{4}$/),
    brand: z.string(),
  }),
  notes: z.string().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
  trackingNumber: z.string().optional(),
});

// Customer schemas
export const updateCustomerProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  avatar: z.string().url().optional(),
  preferences: z.object({
    newsletter: z.boolean().optional(),
    notifications: z.boolean().optional(),
  }).optional(),
  tags: z.array(z.string()).optional(),
});

// Cart schemas
export const addToCartSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive('Quantity must be at least 1'),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive('Quantity must be at least 1'),
});

export const applyCouponSchema = z.object({
  couponCode: z.string().min(1),
});

// Review schemas
export const createReviewSchema = z.object({
  productId: z.string().min(1),
  orderId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(3).max(100),
  content: z.string().min(10).max(5000),
  images: z.array(z.string().url()).optional(),
});

export const updateReviewSchema = createReviewSchema.partial().omit({ orderId: true, productId: true });

// Coupon schemas
export const createCouponSchema = z.object({
  code: z.string().regex(/^[A-Z0-9-]+$/, 'Invalid coupon code format'),
  description: z.string().min(3),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().positive(),
  minimumPurchase: z.number().nonnegative().optional(),
  maxUses: z.number().int().positive().optional(),
  applicableProductIds: z.array(z.string()).optional(),
  applicableCategories: z.array(z.string()).optional(),
  validFrom: z.string().datetime().or(z.date()),
  validUntil: z.string().datetime().or(z.date()),
});

// Inventory schemas
export const updateInventorySchema = z.object({
  quantity: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative().optional(),
  reorderPoint: z.number().int().nonnegative().optional(),
  reorderQuantity: z.number().int().nonnegative().optional(),
  warehouseLocation: z.string().optional(),
});

// Type exports
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type UpdateCustomerProfileInput = z.infer<typeof updateCustomerProfileSchema>;
export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type CreateCouponInput = z.infer<typeof createCouponSchema>;
