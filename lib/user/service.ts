/**
 * User Module Service
 * Business logic for user operations
 */

import { UserRole } from '@prisma/client';
import { prisma } from '../prisma';

export type UserServiceError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

const USER_ERROR_CODES = {
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  INVALID_USER_ID: 'INVALID_USER_ID',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  USER_IN_USE: 'USER_IN_USE',
  CANNOT_DELETE_LAST_ADMIN: 'CANNOT_DELETE_LAST_ADMIN',
} as const;

const USER_ERROR_MESSAGES = {
  [USER_ERROR_CODES.USER_NOT_FOUND]: 'User not found',
  [USER_ERROR_CODES.INVALID_USER_ID]: 'Invalid user ID format',
  [USER_ERROR_CODES.UNAUTHORIZED_ACCESS]: 'Unauthorized access. Only Admin can manage users',
  [USER_ERROR_CODES.USER_IN_USE]: 'User is in use and cannot be deleted',
  [USER_ERROR_CODES.CANNOT_DELETE_LAST_ADMIN]: 'Cannot delete the last admin user',
} as const;

/**
 * Check if user is admin
 */
function checkAdminAccess(userRole: UserRole): { allowed: boolean; error?: UserServiceError } {
  if (userRole !== 'ADMIN') {
    return {
      allowed: false,
      error: {
        code: USER_ERROR_CODES.UNAUTHORIZED_ACCESS,
        message: USER_ERROR_MESSAGES[USER_ERROR_CODES.UNAUTHORIZED_ACCESS],
      },
    };
  }
  return { allowed: true };
}

/**
 * Validate user ID format (UUID)
 */
function validateUserId(userId: string): { valid: boolean; error?: UserServiceError } {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    return {
      valid: false,
      error: {
        code: USER_ERROR_CODES.INVALID_USER_ID,
        message: USER_ERROR_MESSAGES[USER_ERROR_CODES.INVALID_USER_ID],
      },
    };
  }
  return { valid: true };
}

/**
 * Delete user (soft delete)
 */
export async function deleteUser(
  userId: string,
  userRole: UserRole
): Promise<{ data: { success: boolean } } | { error: UserServiceError }> {
  // Check admin access
  const accessCheck = checkAdminAccess(userRole);
  if (!accessCheck.allowed) {
    return { error: accessCheck.error! };
  }

  // Validate user ID
  const idValidation = validateUserId(userId);
  if (!idValidation.valid) {
    return {
      error: {
        code: idValidation.error!.code,
        message: idValidation.error!.message,
      },
    };
  }

  try {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return {
        error: {
          code: USER_ERROR_CODES.USER_NOT_FOUND,
          message: USER_ERROR_MESSAGES[USER_ERROR_CODES.USER_NOT_FOUND],
        },
      };
    }

    // Check if this is the last admin
    if (user.role === 'ADMIN') {
      const adminCount = await prisma.user.count({
        where: {
          role: 'ADMIN',
          isActive: true,
        },
      });

      if (adminCount <= 1) {
        return {
          error: {
            code: USER_ERROR_CODES.CANNOT_DELETE_LAST_ADMIN,
            message: USER_ERROR_MESSAGES[USER_ERROR_CODES.CANNOT_DELETE_LAST_ADMIN],
          },
        };
      }
    }

    // Check if user is in use (has created clients, owns meetings, etc.)
    const [clientsCount, meetingsCount, validationsCount] = await Promise.all([
      prisma.client.count({
        where: { createdByUserId: userId },
      }),
      prisma.meeting.count({
        where: { ownerUserId: userId },
      }),
      prisma.validation.count({
        where: { validatedByUserId: userId },
      }),
    ]);

    if (clientsCount > 0 || meetingsCount > 0 || validationsCount > 0) {
      return {
        error: {
          code: USER_ERROR_CODES.USER_IN_USE,
          message: USER_ERROR_MESSAGES[USER_ERROR_CODES.USER_IN_USE],
          details: { clientsCount, meetingsCount, validationsCount },
        },
      };
    }

    // Hard delete - physically remove from database
    await prisma.user.delete({
      where: { id: userId },
    });

    return {
      data: { success: true },
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete user',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}




