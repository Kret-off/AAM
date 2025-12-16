/**
 * API Route: User
 * GET /api/users/[userId] - Get user with available meeting types
 * PATCH /api/users/[userId] - Update user
 * PUT /api/users/[userId] - Update user (for backward compatibility)
 * DELETE /api/users/[userId] - Delete user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { validateEmail, validatePassword } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

async function getUser(
  request: NextRequest,
  userId: string
): Promise<NextResponse> {
  try {
    // Get token from cookies
    const cookieHeader = request.headers.get('cookie');
    const token = getTokenFromRequest(cookieHeader);

    if (!token) {
      return NextResponse.json(
        {
          error: {
            code: AUTH_ERROR_CODES.UNAUTHORIZED,
            message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.UNAUTHORIZED],
          },
        },
        { status: 401 }
      );
    }

    // Verify token
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        {
          error: {
            code: AUTH_ERROR_CODES.INVALID_SESSION,
            message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INVALID_SESSION],
          },
        },
        { status: 401 }
      );
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
      return NextResponse.json(
        {
          error: {
            code: AUTH_ERROR_CODES.USER_NOT_FOUND,
            message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_NOT_FOUND],
          },
        },
        { status: 404 }
      );
    }

    if (!currentUser.isActive) {
      return NextResponse.json(
        {
          error: {
            code: AUTH_ERROR_CODES.USER_INACTIVE,
            message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_INACTIVE],
          },
        },
        { status: 403 }
      );
    }

    // Check admin access
    if (currentUser.role !== 'ADMIN') {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED_ACCESS',
            message: 'Admin access required',
          },
        },
        { status: 403 }
      );
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
      return NextResponse.json(
        {
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        },
        { status: 404 }
      );
    }

    // Parse name into firstName and lastName
    const nameParts = targetUser.name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Return success response
    return NextResponse.json(
      {
        data: {
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
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in getUser:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process request',
          details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
        },
      },
      { status: 500 }
    );
  }
}

async function updateUser(
  request: NextRequest,
  userId: string
): Promise<NextResponse> {
  try {
    // Get token from cookies
    const cookieHeader = request.headers.get('cookie');
    const token = getTokenFromRequest(cookieHeader);

    if (!token) {
      return NextResponse.json(
        {
          error: {
            code: AUTH_ERROR_CODES.UNAUTHORIZED,
            message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.UNAUTHORIZED],
          },
        },
        { status: 401 }
      );
    }

    // Verify token
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        {
          error: {
            code: AUTH_ERROR_CODES.INVALID_SESSION,
            message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INVALID_SESSION],
          },
        },
        { status: 401 }
      );
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
      return NextResponse.json(
        {
          error: {
            code: AUTH_ERROR_CODES.USER_NOT_FOUND,
            message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_NOT_FOUND],
          },
        },
        { status: 404 }
      );
    }

    if (!currentUser.isActive) {
      return NextResponse.json(
        {
          error: {
            code: AUTH_ERROR_CODES.USER_INACTIVE,
            message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_INACTIVE],
          },
        },
        { status: 403 }
      );
    }

    // Check admin access
    if (currentUser.role !== 'ADMIN') {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED_ACCESS',
            message: 'Admin access required',
          },
        },
        { status: 403 }
      );
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json(
        {
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        },
        { status: 404 }
      );
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
        return NextResponse.json(
          {
            error: {
              code: AUTH_ERROR_CODES.INVALID_EMAIL,
              message: emailValidation.error || AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INVALID_EMAIL],
            },
          },
          { status: 400 }
        );
      }

      // Check if email is already taken by another user
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (existingUser && existingUser.id !== userId) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'User with this email already exists',
            },
          },
          { status: 400 }
        );
      }

      updateData.email = email.toLowerCase().trim();
    }

    // Update name if provided (either as full name or firstName + lastName)
    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Name cannot be empty',
            },
          },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    } else if (firstName !== undefined || lastName !== undefined) {
      // If firstName or lastName provided, combine them
      const firstNameValue = firstName?.trim() || '';
      const lastNameValue = lastName?.trim() || '';
      const fullName = `${firstNameValue} ${lastNameValue}`.trim();
      
      if (!fullName) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Name cannot be empty',
            },
          },
          { status: 400 }
        );
      }
      updateData.name = fullName;
    }

    // Update password if provided
    if (password !== undefined && password !== '') {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: passwordValidation.errors.join('; '),
            },
          },
          { status: 400 }
        );
      }
      // Hash password
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    // Update role if provided
    if (role !== undefined) {
      if (role !== 'USER' && role !== 'ADMIN') {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Role must be either USER or ADMIN',
            },
          },
          { status: 400 }
        );
      }
      updateData.role = role === 'ADMIN' ? UserRole.ADMIN : UserRole.USER;
    }

    // Update isActive if provided
    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'isActive must be a boolean',
            },
          },
          { status: 400 }
        );
      }
      updateData.isActive = isActive;
    }

    // Update meeting types if provided
    if (meetingTypeIds !== undefined) {
      if (!Array.isArray(meetingTypeIds)) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'meetingTypeIds must be an array',
            },
          },
          { status: 400 }
        );
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
          return NextResponse.json(
            {
              error: {
                code: 'VALIDATION_ERROR',
                message: 'One or more meeting types not found or inactive',
              },
            },
            { status: 400 }
          );
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
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'No fields to update',
            },
          },
          { status: 400 }
        );
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
      return NextResponse.json(
        {
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found after update',
          },
        },
        { status: 404 }
      );
    }

    // Parse name into firstName and lastName
    const nameParts = updatedUser.name.trim().split(/\s+/);
    const parsedFirstName = nameParts[0] || '';
    const parsedLastName = nameParts.slice(1).join(' ') || '';

    // Return success response
    return NextResponse.json(
      {
        data: {
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
        },
      },
      { status: 200 }
    );
  } catch (error) {
    // Handle Prisma unique constraint error
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'User with this email already exists',
          },
        },
        { status: 400 }
      );
    }

    // Handle Prisma not found error
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        {
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process request',
          details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
        },
      },
      { status: 500 }
    );
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
      return NextResponse.json(
        {
          error: {
            code: AUTH_ERROR_CODES.UNAUTHORIZED,
            message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.UNAUTHORIZED],
          },
        },
        { status: 401 }
      );
    }

    // Verify token
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        {
          error: {
            code: AUTH_ERROR_CODES.INVALID_SESSION,
            message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INVALID_SESSION],
          },
        },
        { status: 401 }
      );
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
      return NextResponse.json(
        {
          error: {
            code: AUTH_ERROR_CODES.USER_NOT_FOUND,
            message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_NOT_FOUND],
          },
        },
        { status: 404 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          error: {
            code: AUTH_ERROR_CODES.USER_INACTIVE,
            message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_INACTIVE],
          },
        },
        { status: 403 }
      );
    }

    // Check admin access
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED_ACCESS',
            message: 'Admin access required',
          },
        },
        { status: 403 }
      );
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
      return NextResponse.json(
        {
          error: {
            code: result.error.code,
            message: result.error.message,
            details: result.error.details,
          },
        },
        { status: statusCode }
      );
    }

    // Return success response
    return NextResponse.json(
      {
        data: result.data,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process request',
          details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
        },
      },
      { status: 500 }
    );
  }
}

