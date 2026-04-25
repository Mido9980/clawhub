import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api/errors';
import { getProduct, updateProduct, deleteProduct } from '@/lib/firebase/operations';
import { updateProductSchema } from '@/lib/schemas/validation';
import { ZodError } from 'zod';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/products/[id] - Get product details
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const product = await getProduct(id);
    return createSuccessResponse(product);
  } catch (error) {
    console.error('[API] GET /api/products/[id] error:', error);
    return createErrorResponse(error as Error);
  }
}

// PATCH /api/products/[id] - Update product (admin only)
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const validatedData = updateProductSchema.parse(body);

    // In production, verify admin role here
    // const authRequest = await authenticateRequest(request);
    // if (authRequest.user?.claims.role !== 'admin') {
    //   throw new ForbiddenError();
    // }

    await updateProduct(id, validatedData as any);

    const updatedProduct = await getProduct(id);
    return createSuccessResponse(updatedProduct);
  } catch (error) {
    if (error instanceof ZodError) {
      return createErrorResponse(error);
    }
    console.error('[API] PATCH /api/products/[id] error:', error);
    return createErrorResponse(error as Error);
  }
}

// DELETE /api/products/[id] - Delete product (admin only)
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // In production, verify admin role here
    // const authRequest = await authenticateRequest(request);
    // if (authRequest.user?.claims.role !== 'admin') {
    //   throw new ForbiddenError();
    // }

    await deleteProduct(id);
    return createSuccessResponse({ id, deleted: true });
  } catch (error) {
    console.error('[API] DELETE /api/products/[id] error:', error);
    return createErrorResponse(error as Error);
  }
}
