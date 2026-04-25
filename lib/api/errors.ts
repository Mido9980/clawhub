import { NextResponse } from 'next/server';
import { ApiResponse } from '@/lib/types/firestore';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    public details?: Record<string, unknown>
  ) {
    super();
    this.name = 'ApiError';
  }
}

export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  INVALID_COUPON: 'INVALID_COUPON',
  INSUFFICIENT_INVENTORY: 'INSUFFICIENT_INVENTORY',
  DUPLICATE_ORDER: 'DUPLICATE_ORDER',
} as const;

export const statusCodeMap: Record<string, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  BAD_REQUEST: 400,
  INVALID_COUPON: 400,
  INSUFFICIENT_INVENTORY: 409,
  DUPLICATE_ORDER: 409,
};

export function createErrorResponse<T>(
  error: ApiError | ZodError | Error,
  statusCode?: number
): NextResponse<ApiResponse<T>> {
  let code = ErrorCodes.INTERNAL_ERROR;
  let message = 'An unexpected error occurred';
  let status = 500;
  let details: Record<string, unknown> | undefined;

  if (error instanceof ApiError) {
    code = error.code;
    message = error.message;
    status = error.statusCode;
    details = error.details;
  } else if (error instanceof ZodError) {
    code = ErrorCodes.VALIDATION_ERROR;
    message = 'Validation failed';
    status = 400;
    details = {
      errors: error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code,
      })),
    };
  } else if (error instanceof Error) {
    message = error.message;
  }

  if (statusCode) {
    status = statusCode;
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

export function createSuccessResponse<T>(
  data: T,
  statusCode: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  );
}

// Specific error creators
export class ValidationError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCodes.VALIDATION_ERROR, 400, details);
    this.message = message;
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(ErrorCodes.NOT_FOUND, 404);
    this.message = `${resource} not found`;
  }
}

export class UnauthorizedError extends ApiError {
  constructor() {
    super(ErrorCodes.UNAUTHORIZED, 401);
    this.message = 'Authentication required';
  }
}

export class ForbiddenError extends ApiError {
  constructor() {
    super(ErrorCodes.FORBIDDEN, 403);
    this.message = 'Insufficient permissions';
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(ErrorCodes.CONFLICT, 409);
    this.message = message;
  }
}

export class InsufficientInventoryError extends ApiError {
  constructor(available: number, requested: number) {
    super(ErrorCodes.INSUFFICIENT_INVENTORY, 409, { available, requested });
    this.message = `Insufficient inventory. Available: ${available}, Requested: ${requested}`;
  }
}

export class InvalidCouponError extends ApiError {
  constructor(message: string) {
    super(ErrorCodes.INVALID_COUPON, 400);
    this.message = message;
  }
}

export class RateLimitError extends ApiError {
  constructor() {
    super(ErrorCodes.RATE_LIMITED, 429);
    this.message = 'Too many requests. Please try again later.';
  }
}

// Helper to wrap async route handlers with error handling
export function withErrorHandling(handler: Function) {
  return async (...args: unknown[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error('[API Error]', error);
      if (error instanceof ApiError || error instanceof ZodError) {
        return createErrorResponse(error as Error);
      }
      return createErrorResponse(error as Error);
    }
  };
}
