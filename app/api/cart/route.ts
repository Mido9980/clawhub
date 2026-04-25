import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api/errors';
import { getCart } from '@/lib/firebase/operations';

// GET /api/cart - Get current user's cart
export async function GET(request: NextRequest) {
  try {
    // In production, get userId from authenticated request
    const userId = 'user-123'; // Would come from authenticateRequest

    const cart = await getCart(userId);
    return createSuccessResponse(cart);
  } catch (error) {
    console.error('[API] GET /api/cart error:', error);
    return createErrorResponse(error as Error);
  }
}
