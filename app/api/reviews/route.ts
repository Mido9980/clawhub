import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api/errors';
import { getProductReviews, createReview, getOrder } from '@/lib/firebase/operations';
import { getPaginationParams, getQueryParams } from '@/lib/api/middleware';
import { createReviewSchema } from '@/lib/schemas/validation';
import { ZodError } from 'zod';

// GET /api/reviews?productId=xyz - Get product reviews
export async function GET(request: NextRequest) {
  try {
    const params = getQueryParams(request);
    const productId = params.productId as string | undefined;

    if (!productId) {
      throw new Error('productId query parameter required');
    }

    const { page, pageSize } = getPaginationParams(request);
    const result = await getProductReviews(productId, pageSize, (page - 1) * pageSize);
    const hasMore = page * pageSize < result.total;

    return createSuccessResponse({
      items: result.items,
      total: result.total,
      hasMore,
      pageSize,
      page,
    });
  } catch (error) {
    console.error('[API] GET /api/reviews error:', error);
    return createErrorResponse(error as Error);
  }
}

// POST /api/reviews - Create review (verified purchase only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createReviewSchema.parse(body);

    // In production, get userId from authenticated request
    const userId = 'user-123';

    // Verify user actually purchased this product
    const order = await getOrder(validatedData.orderId);

    if (order.userId !== userId) {
      throw new Error('Unauthorized: Order does not belong to user');
    }

    // Check if order contains this product
    const productInOrder = order.items.some((item) => item.productId === validatedData.productId);
    if (!productInOrder) {
      throw new Error('Product not found in order');
    }

    // Create review
    const reviewId = await createReview({
      ...validatedData,
      verified: true,
      helpful: 0,
      unhelpful: 0,
      status: 'pending', // Reviews require approval
      userId,
    });

    return createSuccessResponse({ id: reviewId, ...validatedData }, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      return createErrorResponse(error);
    }
    console.error('[API] POST /api/reviews error:', error);
    return createErrorResponse(error as Error);
  }
}
