import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse, ForbiddenError } from '@/lib/api/errors';
import { getOrder, updateOrderStatus, createAuditLog } from '@/lib/firebase/operations';
import { updateOrderStatusSchema } from '@/lib/schemas/validation';
import { ZodError } from 'zod';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/orders/[id] - Get order details
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    // In production, get userId from authenticated request
    const userId = 'user-123';

    const order = await getOrder(id);

    // Verify user owns order or is admin
    if (order.userId !== userId) {
      throw new ForbiddenError();
    }

    return createSuccessResponse(order);
  } catch (error) {
    console.error('[API] GET /api/orders/[id] error:', error);
    return createErrorResponse(error as Error);
  }
}

// PATCH /api/orders/[id] - Update order status (admin only)
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    // In production, verify admin role here
    // const authRequest = await authenticateRequest(request);
    // if (authRequest.user?.claims.role !== 'admin') {
    //   throw new ForbiddenError();
    // }

    const body = await request.json();
    const { status, trackingNumber } = updateOrderStatusSchema.parse(body);

    // Get original order for audit log
    const originalOrder = await getOrder(id);

    await updateOrderStatus(id, status, trackingNumber);

    // Log audit trail
    await createAuditLog(
      'ORDER_UPDATED',
      'admin-user', // In production, would be actual admin userId
      'orders',
      id,
      {
        before: { status: originalOrder.status },
        after: { status },
      }
    );

    const updatedOrder = await getOrder(id);
    return createSuccessResponse(updatedOrder);
  } catch (error) {
    if (error instanceof ZodError) {
      return createErrorResponse(error);
    }
    console.error('[API] PATCH /api/orders/[id] error:', error);
    return createErrorResponse(error as Error);
  }
}
