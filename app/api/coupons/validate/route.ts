import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api/errors';
import { validateCoupon } from '@/lib/firebase/operations';

// POST /api/coupons/validate - Validate coupon code
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, cartTotal } = body;

    if (!code || !cartTotal) {
      throw new Error('Code and cartTotal required');
    }

    const coupon = await validateCoupon(code, cartTotal);

    // Calculate discount amount
    const discountAmount =
      coupon.discountType === 'percentage'
        ? cartTotal * (coupon.discountValue / 100)
        : coupon.discountValue;

    return createSuccessResponse({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
      description: coupon.description,
    });
  } catch (error) {
    console.error('[API] POST /api/coupons/validate error:', error);
    return createErrorResponse(error as Error);
  }
}
