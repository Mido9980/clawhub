import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api/errors';
import { getPaginationParams, getQueryParams, requireAuth, requireRole } from '@/lib/api/middleware';
import { getProducts, createProduct, searchProducts } from '@/lib/firebase/operations';
import { createProductSchema } from '@/lib/schemas/validation';
import { ZodError } from 'zod';

// GET /api/products - List products with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const { page, pageSize } = getPaginationParams(request);
    const params = getQueryParams(request);
    const search = params.search as string | undefined;
    const category = params.category as string | undefined;
    const status = params.status as string | undefined;

    let result;

    if (search) {
      result = await searchProducts(search, pageSize, (page - 1) * pageSize);
    } else {
      result = await getProducts(
        {
          category,
          status: status || 'active',
        },
        pageSize,
        (page - 1) * pageSize
      );
    }

    const hasMore = page * pageSize < result.total;

    return createSuccessResponse({
      items: result.items,
      total: result.total,
      hasMore,
      pageSize,
      page,
    });
  } catch (error) {
    console.error('[API] GET /api/products error:', error);
    return createErrorResponse(error as Error);
  }
}

// POST /api/products - Create new product (admin only)
export async function POST(request: NextRequest) {
  try {
    // This would be wrapped with requireRole('admin') in production
    // For now, showing the structure
    const body = await request.json();
    const validatedData = createProductSchema.parse(body);

    // In production, verify admin role here
    // const authRequest = await authenticateRequest(request);
    // if (authRequest.user?.claims.role !== 'admin') {
    //   throw new ForbiddenError();
    // }

    const productId = await createProduct({
      ...validatedData,
      createdBy: 'user-123', // Would come from authenticated request
      updatedAt: new Date(),
    } as any);

    return createSuccessResponse({ id: productId, ...validatedData }, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      return createErrorResponse(error);
    }
    console.error('[API] POST /api/products error:', error);
    return createErrorResponse(error as Error);
  }
}
