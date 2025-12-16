/**
 * API Route: User
 * GET /api/users/[userId] - Get user with available meeting types
 * PATCH /api/users/[userId] - Update user
 * PUT /api/users/[userId] - Update user (for backward compatibility)
 * DELETE /api/users/[userId] - Delete user
 */

import { NextRequest } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { validateEmail, validatePassword } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createSuccessResponse, createErrorResponse, CommonErrors } from '@/lib/api/response-utils';
import { logger } from '@/lib/logger';

async function getUser(
  request: NextRequest,
  userId: string
) {
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
    const currentUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!currentUser) {
      return createErrorResponse(
        AUTH_ERROR_CODES.USER_NOT_FOUND,
        AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_NOT_FOUND],
        404
      );
    }

    if (!currentUser.isActive) {
      return CommonErrors.forbidden(AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_INACTIVE]);
    }

    // Check admin access
    if (currentUser.role !== 'ADMIN') {
      return CommonErrors.forbidden('Admin access required');
    }

    // Get target user with available meeting types
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        availableMeetingTypes: {
          select: {
            meetingTypeId: true,
            meetingType: {
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!targetUser) {
      return CommonErrors.notFound('User');
    }

    // Parse name into firstName and lastName
    const nameParts = targetUser.name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Return success response
    return createSuccessResponse({
      id: targetUser.id,
      email: targetUser.email,
      firstName,
      lastName,
      name: targetUser.name,
      role: targetUser.role,
      isActive: targetUser.isActive,
      createdAt: targetUser.createdAt.toISOString(),
      availableMeetingTypes: targetUser.availableMeetingTypes.map((umt) => ({
        id: umt.meetingType.id,
        name: umt.meetingType.name,
        isActive: umt.meetingType.isActive,
      })),
    });
  } catch (error) {
    logger.error('Error in getUser:', error);
    return CommonErrors.internal(undefined, { originalError: error instanceof Error ? error.message : 'Unknown error' });
  }
}

async function updateUser(
  request: NextRequest,
  userId: string
) {
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
    const currentUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!currentUser) {
      return createErrorResponse(
        AUTH_ERROR_CODES.USER_NOT_FOUND,
        AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_NOT_FOUND],
        404
      );
    }

    if (!currentUser.isActive) {
      return CommonErrors.forbidden(AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_INACTIVE]);
    }

    // Check admin access
    if (currentUser.role !== 'ADMIN') {
      return CommonErrors.forbidden('Admin access required');
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return CommonErrors.notFound('User');
    }

    // Parse request body
    const body = await request.json();
    const { email, firstName, lastName, name, password, role, isActive, meetingTypeIds } = body;

    // Build update data
    const updateData: {
      email?: string;
      name?: string;
      passwordHash?: string;
      role?: UserRole;
      isActive?: boolean;
    } = {};

    // Update email if provided
    if (email !== undefined) {
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        return CommonErrors.badRequest(
          emailValidation.error || AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INVALID_EMAIL],
          { code: AUTH_ERROR_CODES.INVALID_EMAIL }
        );
      }

      // Check if email is already taken by another user
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (existingUser && existingUser.id !== userId) {
        return CommonErrors.badRequest('User with this email already exists', { code: 'VALIDATION_ERROR' });
      }

      updateData.email = email.toLowerCase().trim();
    }

    // Update name if provided (either as full name or firstName + lastName)
    if (name !== undefined) {
      if (!name.trim()) {
        return CommonErrors.badRequest('Name cannot be empty', { code: 'VALIDATION_ERROR' });
      }
      updateData.name = name.trim();
    } else if (firstName !== undefined || lastName !== undefined) {
      // If firstName or lastName provided, combine them
      const firstNameValue = firstName?.trim() || '';
      const lastNameValue = lastName?.trim() || '';
      const fullName = `${firstNameValue} ${lastNameValue}`.trim();
      
      if (!fullName) {
        return CommonErrors.badRequest('Name cannot be empty', { code: 'VALIDATION_ERROR' });
      }
      updateData.name = fullName;
    }

    // Update password if provided
    if (password !== undefined && password !== '') {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return CommonErrors.badRequest(passwordValidation.errors.join('; '), { code: 'VALIDATION_ERROR' });
      }
      // Hash password
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    // Update role if provided
    if (role !== undefined) {
      if (role !== 'USER' && role !== 'ADMIN') {
        return CommonErrors.badRequest('Role must be either USER or ADMIN', { code: 'VALIDATION_ERROR' });
      }
      updateData.role = role === 'ADMIN' ? UserRole.ADMIN : UserRole.USER;
    }

    // Update isActive if provided
    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return CommonErrors.badRequest('isActive must be a boolean', { code: 'VALIDATION_ERROR' });
      }
      updateData.isActive = isActive;
    }

    // Update meeting types if provided
    if (meetingTypeIds !== undefined) {
      if (!Array.isArray(meetingTypeIds)) {
        return CommonErrors.badRequest('meetingTypeIds must be an array', { code: 'VALIDATION_ERROR' });
      }

      // Validate that all meeting types exist
      if (meetingTypeIds.length > 0) {
        const meetingTypes = await prisma.meetingType.findMany({
          where: {
            id: { in: meetingTypeIds },
            isActive: true,
          },
          select: { id: true },
        });

        if (meetingTypes.length !== meetingTypeIds.length) {
          return CommonErrors.badRequest('One or more meeting types not found or inactive', { code: 'VALIDATION_ERROR' });
        }
      }

      // Use transaction to update user and meeting types
      await prisma.$transaction(async (tx) => {
        // Update user if there are other fields to update
        if (Object.keys(updateData).length > 0) {
          await tx.user.update({
            where: { id: userId },
            data: updateData,
          });
        }

        // Delete existing meeting type associations
        await tx.userMeetingType.deleteMany({
          where: { userId },
        });

        // Create new meeting type associations
        if (meetingTypeIds.length > 0) {
          await tx.userMeetingType.createMany({
            data: meetingTypeIds.map((meetingTypeId: string) => ({
              userId,
              meetingTypeId,
            })),
          });
        }
      });
    } else {
      // No meeting types to update, just update user fields
      if (Object.keys(updateData).length === 0) {
        return CommonErrors.badRequest('No fields to update', { code: 'VALIDATION_ERROR' });
      }

      await prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
    }

    // Fetch updated user with meeting types
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        availableMeetingTypes: {
          select: {
            meetingTypeId: true,
            meetingType: {
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!updatedUser) {
      return CommonErrors.notFound('User');
    }

    // Parse name into firstName and lastName
    const nameParts = updatedUser.name.trim().split(/\s+/);
    const parsedFirstName = nameParts[0] || '';
    const parsedLastName = nameParts.slice(1).join(' ') || '';

    // Return success response
    return createSuccessResponse({
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: parsedFirstName,
      lastName: parsedLastName,
      name: updatedUser.name,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      createdAt: updatedUser.createdAt.toISOString(),
      availableMeetingTypes: updatedUser.availableMeetingTypes.map((umt) => ({
        id: umt.meetingType.id,
        name: umt.meetingType.name,
        isActive: umt.meetingType.isActive,
      })),
    });
  } catch (error) {
    // Handle Prisma unique constraint error
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return CommonErrors.badRequest('User with this email already exists', { code: 'VALIDATION_ERROR' });
    }

    // Handle Prisma not found error
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return CommonErrors.notFound('User');
    }

    return CommonErrors.internal(undefined, { originalError: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  return getUser(request, userId);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  return updateUser(request, userId);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  return updateUser(request, userId);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

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

    // Import deleteUser service
    const { deleteUser } = await import('@/lib/user/service');

    // Call service
    const result = await deleteUser(userId, user.role);

    // Handle error response
    if ('error' in result) {
      const statusCode =
        result.error.code === 'USER_NOT_FOUND' ? 404
        : result.error.code === 'UNAUTHORIZED_ACCESS' ? 403
        : result.error.code === 'CANNOT_DELETE_LAST_ADMIN' ? 400
        : 500;
      return createErrorResponse(
        result.error.code,
        result.error.message,
        statusCode,
        result.error.details
      );
    }

    // Return success response
    return createSuccessResponse(result.data);
  } catch (error) {
    return CommonErrors.internal(undefined, { originalError: error instanceof Error ? error.message : 'Unknown error' });
  }
}

