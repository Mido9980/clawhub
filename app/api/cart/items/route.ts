import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api/errors';
import { getCart, upsertCart, getProduct, getInventory } from '@/lib/firebase/operations';
import { addToCartSchema, updateCartItemSchema } from '@/lib/schemas/validation';
import { ZodError } from 'zod';

// POST /api/cart/items - Add item to cart
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, quantity } = addToCartSchema.parse(body);

    // In production, get userId from authenticated request
    const userId = 'user-123';

    // Verify product exists and get current price
    const product = await getProduct(productId);

    // Get current cart
    const cart = await getCart(userId);

    // Check if item already in cart
    const existingItemIndex = cart.items.findIndex((item) => item.productId === productId);

    if (existingItemIndex >= 0) {
      // Update quantity
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item
      cart.items.push({
        productId,
        quantity,
        priceAtAddTime: product.price,
      });
    }

    // Recalculate totals
    cart.subtotal = cart.items.reduce(
      (sum, item) => sum + item.priceAtAddTime * item.quantity,
      0
    );
    cart.total = cart.subtotal - cart.couponDiscount;

    // Save cart
    await upsertCart(cart);

    return createSuccessResponse(cart, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      return createErrorResponse(error);
    }
    console.error('[API] POST /api/cart/items error:', error);
    return createErrorResponse(error as Error);
  }
}

// PATCH /api/cart/items/[productId] - Update item quantity
export async function PATCH(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const productId = url.pathname.split('/').pop();

    if (!productId) {
      throw new Error('Product ID required');
    }

    const body = await request.json();
    const { quantity } = updateCartItemSchema.parse(body);

    // In production, get userId from authenticated request
    const userId = 'user-123';

    const cart = await getCart(userId);

    // Find and update item
    const itemIndex = cart.items.findIndex((item) => item.productId === productId);
    if (itemIndex < 0) {
      throw new Error('Item not found in cart');
    }

    if (quantity === 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = quantity;
    }

    // Recalculate totals
    cart.subtotal = cart.items.reduce(
      (sum, item) => sum + item.priceAtAddTime * item.quantity,
      0
    );
    cart.total = cart.subtotal - cart.couponDiscount;

    // Save cart
    await upsertCart(cart);

    return createSuccessResponse(cart);
  } catch (error) {
    if (error instanceof ZodError) {
      return createErrorResponse(error);
    }
    console.error('[API] PATCH /api/cart/items error:', error);
    return createErrorResponse(error as Error);
  }
}
