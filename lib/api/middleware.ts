import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase/admin';
import { UnauthorizedError, ForbiddenError } from '@/lib/api/errors';
import { UserCustomClaims } from '@/lib/types/firestore';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    uid: string;
    email?: string;
    claims: UserCustomClaims;
  };
}

export type RouteHandler = (
  request: AuthenticatedRequest,
  context?: { params: Record<string, unknown> }
) => Promise<NextResponse>;

/**
 * Middleware to verify Firebase authentication token from Authorization header
 * Attaches user info to request.user if valid
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthenticatedRequest> {
  const authRequest = request as AuthenticatedRequest;

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError();
    }

    const token = authHeader.slice(7);
    const decodedToken = await auth.verifyIdToken(token);

    authRequest.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      claims: (decodedToken.custom_claims as UserCustomClaims) || { role: 'customer' },
    };

    return authRequest;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    throw new UnauthorizedError();
  }
}

/**
 * Verify user is authenticated
 */
export function requireAuth(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context?) => {
    try {
      const authRequest = await authenticateRequest(request);
      return handler(authRequest, context);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required',
            },
            timestamp: new Date().toISOString(),
          },
          { status: 401 }
        );
      }
      throw error;
    }
  };
}

/**
 * Verify user has required role(s)
 */
export function requireRole(...roles: string[]) {
  return (handler: RouteHandler): RouteHandler => {
    return async (request: NextRequest, context?) => {
      try {
        const authRequest = await authenticateRequest(request);

        if (!authRequest.user) {
          throw new UnauthorizedError();
        }

        const userRole = authRequest.user.claims.role;
        if (!roles.includes(userRole)) {
          throw new ForbiddenError();
        }

        return handler(authRequest, context);
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
              },
              timestamp: new Date().toISOString(),
            },
            { status: 401 }
          );
        }
        if (error instanceof ForbiddenError) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'Insufficient permissions',
              },
              timestamp: new Date().toISOString(),
            },
            { status: 403 }
          );
        }
        throw error;
      }
    };
  };
}

/**
 * Extract and validate request body with Zod schema
 */
export async function validateBody<T>(request: NextRequest, schema: any): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      throw error;
    }
    throw new Error('Invalid request body');
  }
}

/**
 * Extract query parameters
 */
export function getQueryParams(request: NextRequest): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};
  const searchParams = request.nextUrl.searchParams;

  searchParams.forEach((value, key) => {
    if (params[key]) {
      const existing = params[key];
      params[key] = Array.isArray(existing) ? [...existing, value] : [existing as string, value];
    } else {
      params[key] = value;
    }
  });

  return params;
}

/**
 * Extract pagination parameters
 */
export function getPaginationParams(request: NextRequest): { page: number; pageSize: number } {
  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));

  return { page, pageSize };
}

/**
 * Get request metadata (IP, user agent)
 */
export function getRequestMetadata(request: NextRequest) {
  return {
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}
