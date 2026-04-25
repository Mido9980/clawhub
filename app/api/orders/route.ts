import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api/errors';
import { getPaginationParams, getQueryParams } from '@/lib/api/middleware';
import { getUserOrders, createOrder, getCart, upsertCart, reserveInventory, createAuditLog } from '@/lib/firebase/operations';
import { createOrderSchema } from '@/lib/schemas/validation';
import { ZodError } from 'zod';
import * as admin from 'firebase-admin';

// GET /api/orders - Get user's orders
export async function GET(request: NextRequest) {
  try {
    // In production, get userId from authenticated request
    const userId = 'user-123';
    const { page, pageSize } = getPaginationParams(request);

    const result = await getUserOrders(userId, pageSize, (page - 1) * pageSize);
    const hasMore = page * pageSize < result.total;

    return createSuccessResponse({
      items: result.items,
      total: result.total,
      hasMore,
      pageSize,
      page,
    });
  } catch (error) {
    console.error('[API] GET /api/orders error:', error);
    return createErrorResponse(error as Error);
  }
}

// POST /api/orders - Create order from cart
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createOrderSchema.parse(body);

    // In production, get userId from authenticated request
    const userId = 'user-123';

    // Get current cart
    const cart = await getCart(userId);

    if (cart.items.length === 0) {
      throw new Error('Cart is empty');
    }

    // Calculate order totals
    const subtotal = validatedData.items.reduce(
      (sum, item) => sum + item.priceAtPurchase * item.quantity,
      0
    );

    // Simple tax calculation (10%)
    const tax = subtotal * 0.1;
    const total = subtotal + tax + validatedData.items.length * 5; // $5 flat shipping per item

    // Generate order number
    const orderNumber = `ORD-${Date.now()}`;

    // Create order
    const orderId = await createOrder({
      userId,
      orderNumber,
      items: validatedData.items,
      subtotal,
      tax,
      shippingCost: validatedData.items.length * 5,
      total,
      status: 'pending',
      shippingAddress: validatedData.shippingAddress,
      billingAddress: validatedData.billingAddress,
      paymentMethod: validatedData.paymentMethod,
      notes: validatedData.notes,
      updatedAt: new Date(),
    } as any);

    // Reserve inventory for each item
    for (const item of validatedData.items) {
      try {
        await reserveInventory(item.productId, item.quantity);
      } catch (error) {
        console.error(`Failed to reserve inventory for product ${item.productId}:`, error);
        // In production, you might want to roll back the order or handle this more gracefully
      }
    }

    // Clear cart
    cart.items = [];
    cart.subtotal = 0;
    cart.couponDiscount = 0;
    cart.total = 0;
    cart.couponCode = undefined;
    await upsertCart(cart);

    // Log audit trail
    await createAuditLog(
      'ORDER_CREATED',
      userId,
      'orders',
      orderId,
      undefined,
      { ipAddress: request.headers.get('x-forwarded-for') || 'unknown', userAgent: request.headers.get('user-agent') || 'unknown' }
    );

    return createSuccessResponse(
      {
        id: orderId,
        orderNumber,
        status: 'pending',
        total,
      },
      201
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return createErrorResponse(error);
    }
    console.error('[API] POST /api/orders error:', error);
    return createErrorResponse(error as Error);
  }
}
