/**
 * Directory Module Service
 * Business logic for participant directory operations
 */

import { ParticipantType } from '@prisma/client';
import {
  ParticipantResponse,
  CreateParticipantRequest,
  UpdateParticipantRequest,
  ParticipantDetailResponse,
} from './dto';
import { ParticipantsQueryParams, PaginatedResponse } from './types';
import {
  validateFullName,
  validateParticipantType,
  validateParticipantData,
  validateTags,
  validateParticipantId,
  validatePaginationParams,
} from './validation';
import {
  DIRECTORY_ERROR_CODES,
  DIRECTORY_ERROR_MESSAGES,
  DIRECTORY_CONSTANTS,
} from './constants';
import { prisma } from '../prisma';

export interface DirectoryServiceError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Create a new participant
 */
export async function createParticipant(
  data: CreateParticipantRequest,
  createdByUserId: string
): Promise<{ data: ParticipantResponse } | { error: DirectoryServiceError }> {
  // Validate full name
  const nameValidation = validateFullName(data.fullName);
  if (!nameValidation.valid) {
    return {
      error: {
        code: nameValidation.error!.code,
        message: nameValidation.error!.message,
      },
    };
  }

  // Validate participant type
  const typeValidation = validateParticipantType(data.type);
  if (!typeValidation.valid) {
    return {
      error: {
        code: typeValidation.error!.code,
        message: typeValidation.error!.message,
      },
    };
  }

  // Validate conditional fields
  const conditionalValidation = validateParticipantData(data.type, {
    companyName: data.companyName,
    department: data.department,
  });
  if (!conditionalValidation.valid) {
    return {
      error: {
        code: conditionalValidation.error!.code,
        message: conditionalValidation.error!.message,
      },
    };
  }

  // Validate tags
  if (data.tags !== undefined) {
    const tagsValidation = validateTags(data.tags);
    if (!tagsValidation.valid) {
      return {
        error: {
          code: tagsValidation.error!.code,
          message: tagsValidation.error!.message,
        },
      };
    }
  }

  try {
    const { generateShortId } = await import('../db/id-generator');
    const participantId = await generateShortId('directory_participant');
    const participant = await prisma.directoryParticipant.create({
      data: {
        id: participantId,
        type: data.type as ParticipantType,
        fullName: data.fullName.trim(),
        roleTitle: data.roleTitle?.trim() || null,
        companyName: data.companyName?.trim() || null,
        department: data.department?.trim() || null,
        tags: data.tags ? (data.tags as object) : null,
        createdByUserId,
      },
      select: {
        id: true,
        type: true,
        fullName: true,
        roleTitle: true,
        companyName: true,
        department: true,
        tags: true,
        isActive: true,
        createdAt: true,
        createdByUserId: true,
      },
    });

    return {
      data: {
        id: participant.id,
        type: participant.type as ParticipantType,
        fullName: participant.fullName,
        roleTitle: participant.roleTitle,
        companyName: participant.companyName,
        department: participant.department,
        tags: participant.tags as Record<string, unknown> | null,
        isActive: participant.isActive,
        createdAt: participant.createdAt.toISOString(),
        createdByUserId: participant.createdByUserId,
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        error: {
          code: DIRECTORY_ERROR_CODES.PARTICIPANT_ALREADY_EXISTS,
          message: DIRECTORY_ERROR_MESSAGES[DIRECTORY_ERROR_CODES.PARTICIPANT_ALREADY_EXISTS],
          details: { originalError: error.message },
        },
      };
    }
    throw error;
  }
}

/**
 * Get participant by ID
 */
export async function getParticipantById(
  participantId: string
): Promise<{ data: ParticipantResponse } | { error: DirectoryServiceError }> {
  // Validate participant ID format
  const idValidation = validateParticipantId(participantId);
  if (!idValidation.valid) {
    return {
      error: {
        code: idValidation.error!.code,
        message: idValidation.error!.message,
      },
    };
  }

  try {
    const participant = await prisma.directoryParticipant.findUnique({
      where: { id: participantId },
      select: {
        id: true,
        type: true,
        fullName: true,
        roleTitle: true,
        companyName: true,
        department: true,
        tags: true,
        isActive: true,
        createdAt: true,
        createdByUserId: true,
      },
    });

    if (!participant) {
      return {
        error: {
          code: DIRECTORY_ERROR_CODES.PARTICIPANT_NOT_FOUND,
          message: DIRECTORY_ERROR_MESSAGES[DIRECTORY_ERROR_CODES.PARTICIPANT_NOT_FOUND],
        },
      };
    }

    return {
      data: {
        id: participant.id,
        type: participant.type as ParticipantType,
        fullName: participant.fullName,
        roleTitle: participant.roleTitle,
        companyName: participant.companyName,
        department: participant.department,
        tags: participant.tags as Record<string, unknown> | null,
        isActive: participant.isActive,
        createdAt: participant.createdAt.toISOString(),
        createdByUserId: participant.createdByUserId,
      },
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch participant',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Get participant detail by ID (with additional info)
 */
export async function getParticipantDetail(
  participantId: string
): Promise<{ data: ParticipantDetailResponse } | { error: DirectoryServiceError }> {
  // Validate participant ID format
  const idValidation = validateParticipantId(participantId);
  if (!idValidation.valid) {
    return {
      error: {
        code: idValidation.error!.code,
        message: idValidation.error!.message,
      },
    };
  }

  try {
    const participant = await prisma.directoryParticipant.findUnique({
      where: { id: participantId },
      select: {
        id: true,
        type: true,
        fullName: true,
        roleTitle: true,
        companyName: true,
        department: true,
        tags: true,
        isActive: true,
        createdAt: true,
        createdByUserId: true,
        createdByUser: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            meetingParticipants: true,
          },
        },
      },
    });

    if (!participant) {
      return {
        error: {
          code: DIRECTORY_ERROR_CODES.PARTICIPANT_NOT_FOUND,
          message: DIRECTORY_ERROR_MESSAGES[DIRECTORY_ERROR_CODES.PARTICIPANT_NOT_FOUND],
        },
      };
    }

    return {
      data: {
        id: participant.id,
        type: participant.type as ParticipantType,
        fullName: participant.fullName,
        roleTitle: participant.roleTitle,
        companyName: participant.companyName,
        department: participant.department,
        tags: participant.tags as Record<string, unknown> | null,
        isActive: participant.isActive,
        createdAt: participant.createdAt.toISOString(),
        createdByUserId: participant.createdByUserId,
        createdByUserName: participant.createdByUser.name,
        meetingsCount: participant._count.meetingParticipants,
      },
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch participant details',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Get paginated list of participants with filters and search
 */
export async function getParticipants(
  params: ParticipantsQueryParams = {}
): Promise<{ data: PaginatedResponse<ParticipantResponse> } | { error: DirectoryServiceError }> {
  // Validate pagination parameters
  const paginationValidation = validatePaginationParams({
    page: params.page,
    pageSize: params.pageSize,
  });

  if (!paginationValidation.valid) {
    return {
      error: {
        code: paginationValidation.error!.code,
        message: paginationValidation.error!.message,
      },
    };
  }

  const { page, pageSize } = paginationValidation;
  const skip = (page - 1) * pageSize;
  const searchTerm = params.filter?.search?.trim();
  const filterType = params.filter?.type;
  const filterIsActive = params.filter?.isActive;

  try {
    // Build where clause
    const where: {
      type?: ParticipantType;
      isActive?: boolean;
      OR?: Array<{
        fullName?: { contains: string; mode: 'insensitive' };
        roleTitle?: { contains: string; mode: 'insensitive' };
        companyName?: { contains: string; mode: 'insensitive' };
        department?: { contains: string; mode: 'insensitive' };
      }>;
    } = {};

    // Apply type filter
    if (filterType) {
      where.type = filterType as ParticipantType;
    }

    // Apply isActive filter
    if (filterIsActive !== undefined) {
      where.isActive = filterIsActive;
    }

    // Apply search filter
    if (searchTerm) {
      where.OR = [
        { fullName: { contains: searchTerm, mode: 'insensitive' } },
        { roleTitle: { contains: searchTerm, mode: 'insensitive' } },
        { companyName: { contains: searchTerm, mode: 'insensitive' } },
        { department: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    // Get total count and participants in parallel
    const [total, participants] = await Promise.all([
      prisma.directoryParticipant.count({ where }),
      prisma.directoryParticipant.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          type: true,
          fullName: true,
          roleTitle: true,
          companyName: true,
          department: true,
          tags: true,
          isActive: true,
          createdAt: true,
          createdByUserId: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: {
        items: participants.map((participant) => ({
          id: participant.id,
          type: participant.type as ParticipantType,
          fullName: participant.fullName,
          roleTitle: participant.roleTitle,
          companyName: participant.companyName,
          department: participant.department,
          tags: participant.tags as Record<string, unknown> | null,
          isActive: participant.isActive,
          createdAt: participant.createdAt.toISOString(),
          createdByUserId: participant.createdByUserId,
        })),
        total,
        page,
        pageSize,
        totalPages,
      },
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch participants',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Update participant
 */
export async function updateParticipant(
  participantId: string,
  data: UpdateParticipantRequest
): Promise<{ data: ParticipantResponse } | { error: DirectoryServiceError }> {
  // Validate participant ID format
  const idValidation = validateParticipantId(participantId);
  if (!idValidation.valid) {
    return {
      error: {
        code: idValidation.error!.code,
        message: idValidation.error!.message,
      },
    };
  }

  // Validate full name if provided
  if (data.fullName !== undefined) {
    const nameValidation = validateFullName(data.fullName);
    if (!nameValidation.valid) {
      return {
        error: {
          code: nameValidation.error!.code,
          message: nameValidation.error!.message,
        },
      };
    }
  }

  // Validate participant type if provided
  if (data.type !== undefined) {
    const typeValidation = validateParticipantType(data.type);
    if (!typeValidation.valid) {
      return {
        error: {
          code: typeValidation.error!.code,
          message: typeValidation.error!.message,
        },
      };
    }
  }

  // Validate tags if provided
  if (data.tags !== undefined) {
    const tagsValidation = validateTags(data.tags);
    if (!tagsValidation.valid) {
      return {
        error: {
          code: tagsValidation.error!.code,
          message: tagsValidation.error!.message,
        },
      };
    }
  }

  try {
    // Check if participant exists and get current data
    const existingParticipant = await prisma.directoryParticipant.findUnique({
      where: { id: participantId },
    });

    if (!existingParticipant) {
      return {
        error: {
          code: DIRECTORY_ERROR_CODES.PARTICIPANT_NOT_FOUND,
          message: DIRECTORY_ERROR_MESSAGES[DIRECTORY_ERROR_CODES.PARTICIPANT_NOT_FOUND],
        },
      };
    }

    // Determine final type (use existing if not updating)
    const finalType = (data.type || existingParticipant.type) as ParticipantType;

    // Validate conditional fields if type is being changed or relevant fields are updated
    if (data.type !== undefined || data.companyName !== undefined || data.department !== undefined) {
      const conditionalValidation = validateParticipantData(finalType, {
        companyName: data.companyName !== undefined ? data.companyName : existingParticipant.companyName,
        department: data.department !== undefined ? data.department : existingParticipant.department,
      });
      if (!conditionalValidation.valid) {
        return {
          error: {
            code: conditionalValidation.error!.code,
            message: conditionalValidation.error!.message,
          },
        };
      }
    }

    // Build update data
    const updateData: {
      type?: ParticipantType;
      fullName?: string;
      roleTitle?: string | null;
      companyName?: string | null;
      department?: string | null;
      tags?: object | null;
      isActive?: boolean;
    } = {};

    if (data.type !== undefined) {
      updateData.type = data.type as ParticipantType;
    }
    if (data.fullName !== undefined) {
      updateData.fullName = data.fullName.trim();
    }
    if (data.roleTitle !== undefined) {
      updateData.roleTitle = data.roleTitle?.trim() || null;
    }
    if (data.companyName !== undefined) {
      updateData.companyName = data.companyName?.trim() || null;
    }
    if (data.department !== undefined) {
      updateData.department = data.department?.trim() || null;
    }
    if (data.tags !== undefined) {
      updateData.tags = data.tags ? (data.tags as object) : null;
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    // Update participant
    const participant = await prisma.directoryParticipant.update({
      where: { id: participantId },
      data: updateData,
      select: {
        id: true,
        type: true,
        fullName: true,
        roleTitle: true,
        companyName: true,
        department: true,
        tags: true,
        isActive: true,
        createdAt: true,
        createdByUserId: true,
      },
    });

    return {
      data: {
        id: participant.id,
        type: participant.type as ParticipantType,
        fullName: participant.fullName,
        roleTitle: participant.roleTitle,
        companyName: participant.companyName,
        department: participant.department,
        tags: participant.tags as Record<string, unknown> | null,
        isActive: participant.isActive,
        createdAt: participant.createdAt.toISOString(),
        createdByUserId: participant.createdByUserId,
      },
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update participant',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Deactivate participant (soft delete)
 */
export async function deactivateParticipant(
  participantId: string
): Promise<{ data: ParticipantResponse } | { error: DirectoryServiceError }> {
  return updateParticipant(participantId, { isActive: false });
}

/**
 * Activate participant
 */
export async function activateParticipant(
  participantId: string
): Promise<{ data: ParticipantResponse } | { error: DirectoryServiceError }> {
  return updateParticipant(participantId, { isActive: true });
}








