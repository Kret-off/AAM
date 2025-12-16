/**
 * API Route: Users (Admin only)
 * GET /api/users - List users
 * POST /api/users - Create user
 */

import { NextRequest } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { validateEmail, validatePassword } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { createSuccessResponse, createCreatedResponse, createErrorResponse, CommonErrors } from '@/lib/api/response-utils';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  try {
    // Get token from cookies
    const cookieHeader = request.headers.get('cookie');
    const token = getTokenFromRequest(cookieHeader);

    if (!token) {
      return CommonErrors.unauthorized(AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.UNAUTHORIZED]);
    }

    // Verify token
    const payload = verifyToken(token);
    if (!payload) {
      return CommonErrors.unauthorized(AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INVALID_SESSION]);
    }

    // Get user from database to get role
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return createErrorResponse(
        AUTH_ERROR_CODES.USER_NOT_FOUND,
        AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_NOT_FOUND],
        404
      );
    }

    if (!user.isActive) {
      return CommonErrors.forbidden(AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_INACTIVE]);
    }

    // Check admin access
    if (user.role !== 'ADMIN') {
      return CommonErrors.forbidden('Admin access required');
    }

    // Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const pageParam = searchParams.get('page');
    const pageSizeParam = searchParams.get('pageSize');

    // Validate pagination parameters
    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const pageSize = pageSizeParam ? parseInt(pageSizeParam, 10) : DEFAULT_PAGE_SIZE;

    if (isNaN(page) || page < 1) {
      return CommonErrors.badRequest('Page must be a positive integer', { code: 'INVALID_PAGINATION_PARAMS' });
    }

    if (isNaN(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
      return CommonErrors.badRequest(`Page size must be between 1 and ${MAX_PAGE_SIZE}`, { code: 'INVALID_PAGINATION_PARAMS' });
    }

    // Calculate skip and take
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Get total count
    const total = await prisma.user.count();

    // Get users with pagination
    const users = await prisma.user.findMany({
      skip,
      take,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate total pages
    const totalPages = Math.ceil(total / pageSize);

    // Return success response
    return createSuccessResponse({
      items: users,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (error) {
    return CommonErrors.internal(undefined, { originalError: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get token from cookies
    const cookieHeader = request.headers.get('cookie');
    const token = getTokenFromRequest(cookieHeader);

    if (!token) {
      return CommonErrors.unauthorized(AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.UNAUTHORIZED]);
    }

    // Verify token
    const payload = verifyToken(token);
    if (!payload) {
      return CommonErrors.unauthorized(AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INVALID_SESSION]);
    }

    // Get user from database to get role
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return createErrorResponse(
        AUTH_ERROR_CODES.USER_NOT_FOUND,
        AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_NOT_FOUND],
        404
      );
    }

    if (!user.isActive) {
      return CommonErrors.forbidden(AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_INACTIVE]);
    }

    // Check admin access
    if (user.role !== 'ADMIN') {
      return CommonErrors.forbidden('Admin access required');
    }

    // Parse request body
    const body = await request.json();
    const { email, password, name, role } = body;

    // Validate required fields
    if (!email || !password || !name) {
      return CommonErrors.badRequest('Email, password, and name are required', { code: 'VALIDATION_ERROR' });
    }

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return CommonErrors.badRequest(
        emailValidation.error || AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INVALID_EMAIL],
        { code: AUTH_ERROR_CODES.INVALID_EMAIL }
      );
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return CommonErrors.badRequest(
        passwordValidation.errors.join('; '),
        { code: 'VALIDATION_ERROR' }
      );
    }

    // Validate role
    const userRole = role === 'ADMIN' ? UserRole.ADMIN : UserRole.USER;
    if (role && role !== 'USER' && role !== 'ADMIN') {
      return CommonErrors.badRequest('Role must be either USER or ADMIN', { code: 'VALIDATION_ERROR' });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return CommonErrors.badRequest('User with this email already exists', { code: 'VALIDATION_ERROR' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate short ID
    const { generateShortId } = await import('@/lib/db/id-generator');
    const userId = await generateShortId('user');

    // Create user
    const newUser = await prisma.user.create({
      data: {
        id: userId,
        email: email.toLowerCase().trim(),
        passwordHash,
        name: name.trim(),
        role: userRole,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Return success response
    return createCreatedResponse({
      user: newUser,
    });
  } catch (error) {
    // Handle Prisma unique constraint error
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return CommonErrors.badRequest('User with this email already exists', { code: 'VALIDATION_ERROR' });
    }

    return CommonErrors.internal(undefined, { originalError: error instanceof Error ? error.message : 'Unknown error' });
  }
}

