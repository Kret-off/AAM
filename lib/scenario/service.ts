/**
 * Scenario Module Service
 * Business logic for scenario and meeting type operations
 */

import { UserRole } from '@prisma/client';
import {
  CreateScenarioRequest,
  UpdateScenarioRequest,
  ScenarioResponse,
  ScenarioDetailResponse,
  CreateMeetingTypeRequest,
  UpdateMeetingTypeRequest,
  MeetingTypeResponse,
} from './dto';
import { ScenariosQueryParams, MeetingTypesQueryParams, ScenarioServiceError } from './types';
import {
  validateScenarioId,
  validateMeetingTypeId,
  validateScenarioName,
  validateMeetingTypeName,
  validateSystemPrompt,
  validateJSONSchema,
  validateKeyterms,
  validatePaginationParams,
} from './validation';
import {
  SCENARIO_ERROR_CODES,
  SCENARIO_ERROR_MESSAGES,
  SCENARIO_CONSTANTS,
} from './constants';
import { prisma } from '../prisma';
import { generateShortId } from '../db/id-generator';

/**
 * Check if user is admin
 */
function checkAdminAccess(userRole: UserRole): { allowed: boolean; error?: ScenarioServiceError } {
  if (userRole !== 'ADMIN') {
    return {
      allowed: false,
      error: {
        code: SCENARIO_ERROR_CODES.UNAUTHORIZED_ACCESS,
        message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.UNAUTHORIZED_ACCESS],
      },
    };
  }
  return { allowed: true };
}

/**
 * Create a new scenario
 */
export async function createScenario(
  data: CreateScenarioRequest,
  updatedByUserId: string,
  userRole: UserRole
): Promise<{ data: ScenarioResponse } | { error: ScenarioServiceError }> {
  // Check admin access
  const accessCheck = checkAdminAccess(userRole);
  if (!accessCheck.allowed) {
    return { error: accessCheck.error! };
  }

  // Validate meeting type ID
  const meetingTypeIdValidation = validateMeetingTypeId(data.meetingTypeId);
  if (!meetingTypeIdValidation.valid) {
    return {
      error: {
        code: meetingTypeIdValidation.error!.code,
        message: meetingTypeIdValidation.error!.message,
      },
    };
  }

  // Validate scenario name
  const nameValidation = validateScenarioName(data.name);
  if (!nameValidation.valid) {
    return {
      error: {
        code: nameValidation.error!.code,
        message: nameValidation.error!.message,
      },
    };
  }

  // Validate system prompt
  const promptValidation = validateSystemPrompt(data.systemPrompt);
  if (!promptValidation.valid) {
    return {
      error: {
        code: promptValidation.error!.code,
        message: promptValidation.error!.message,
      },
    };
  }

  // Validate output schema
  const schemaValidation = validateJSONSchema(data.outputSchema, 'outputSchema');
  if (!schemaValidation.valid) {
    return {
      error: {
        code: schemaValidation.error!.code,
        message: schemaValidation.error!.message,
      },
    };
  }

  // Validate artifacts config
  const configValidation = validateJSONSchema(data.artifactsConfig, 'artifactsConfig');
  if (!configValidation.valid) {
    return {
      error: {
        code: configValidation.error!.code,
        message: configValidation.error!.message,
      },
    };
  }

  // Validate keyterms
  const keytermsValidation = validateKeyterms(data.keyterms);
  if (!keytermsValidation.valid) {
    return {
      error: {
        code: keytermsValidation.error!.code,
        message: keytermsValidation.error!.message,
      },
    };
  }

  // Normalize keyterms: trim, remove empty strings, remove duplicates
  const normalizedKeyterms = data.keyterms
    ? Array.from(
        new Set(
          data.keyterms
            .map((k) => k.trim())
            .filter((k) => k.length > 0)
        )
      )
    : [];

  try {
    // Verify meeting type exists
    const meetingType = await prisma.meetingType.findUnique({
      where: { id: data.meetingTypeId },
      select: { id: true, name: true },
    });

    if (!meetingType) {
      return {
        error: {
          code: SCENARIO_ERROR_CODES.MEETING_TYPE_NOT_FOUND,
          message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.MEETING_TYPE_NOT_FOUND],
        },
      };
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: updatedByUserId },
      select: { id: true, name: true },
    });

    if (!user) {
      return {
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      };
    }

    // Create scenario
    const scenarioId = await generateShortId('prompt_scenario');
    const scenario = await prisma.promptScenario.create({
      data: {
        id: scenarioId,
        meetingTypeId: data.meetingTypeId,
        name: data.name.trim(),
        systemPrompt: data.systemPrompt.trim(),
        outputSchema: data.outputSchema,
        artifactsConfig: data.artifactsConfig,
        keyterms: normalizedKeyterms,
        isActive: data.isActive ?? true,
        version: 1,
        updatedByUserId,
      },
      select: {
        id: true,
        meetingTypeId: true,
        meetingType: {
          select: { name: true },
        },
        name: true,
        systemPrompt: true,
        outputSchema: true,
        artifactsConfig: true,
        keyterms: true,
        isActive: true,
        version: true,
        updatedAt: true,
        updatedByUserId: true,
        updatedByUser: {
          select: { name: true },
        },
      },
    });

    return {
      data: {
        id: scenario.id,
        meetingTypeId: scenario.meetingTypeId,
        meetingTypeName: scenario.meetingType.name,
        name: scenario.name,
        systemPrompt: scenario.systemPrompt,
        outputSchema: scenario.outputSchema,
        artifactsConfig: scenario.artifactsConfig,
        keyterms: scenario.keyterms,
        isActive: scenario.isActive,
        version: scenario.version,
        updatedAt: scenario.updatedAt.toISOString(),
        updatedByUserId: scenario.updatedByUserId,
        updatedByUserName: scenario.updatedByUser.name,
      },
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create scenario',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Update scenario
 */
export async function updateScenario(
  scenarioId: string,
  data: UpdateScenarioRequest,
  updatedByUserId: string,
  userRole: UserRole
): Promise<{ data: ScenarioResponse } | { error: ScenarioServiceError }> {
  // Check admin access
  const accessCheck = checkAdminAccess(userRole);
  if (!accessCheck.allowed) {
    return { error: accessCheck.error! };
  }

  // Validate scenario ID
  const idValidation = validateScenarioId(scenarioId);
  if (!idValidation.valid) {
    return {
      error: {
        code: idValidation.error!.code,
        message: idValidation.error!.message,
      },
    };
  }

  try {
    // Get current scenario
    const currentScenario = await prisma.promptScenario.findUnique({
      where: { id: scenarioId },
      select: {
        id: true,
        meetingTypeId: true,
        name: true,
        systemPrompt: true,
        outputSchema: true,
        artifactsConfig: true,
        isActive: true,
        version: true,
      },
    });

    if (!currentScenario) {
      return {
        error: {
          code: SCENARIO_ERROR_CODES.SCENARIO_NOT_FOUND,
          message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.SCENARIO_NOT_FOUND],
        },
      };
    }

    // Validate fields if provided
    if (data.name !== undefined) {
      const nameValidation = validateScenarioName(data.name);
      if (!nameValidation.valid) {
        return {
          error: {
            code: nameValidation.error!.code,
            message: nameValidation.error!.message,
          },
        };
      }
    }

    if (data.systemPrompt !== undefined) {
      const promptValidation = validateSystemPrompt(data.systemPrompt);
      if (!promptValidation.valid) {
        return {
          error: {
            code: promptValidation.error!.code,
            message: promptValidation.error!.message,
          },
        };
      }
    }

    if (data.outputSchema !== undefined) {
      const schemaValidation = validateJSONSchema(data.outputSchema, 'outputSchema');
      if (!schemaValidation.valid) {
        return {
          error: {
            code: schemaValidation.error!.code,
            message: schemaValidation.error!.message,
          },
        };
      }
    }

    if (data.artifactsConfig !== undefined) {
      const configValidation = validateJSONSchema(data.artifactsConfig, 'artifactsConfig');
      if (!configValidation.valid) {
        return {
          error: {
            code: configValidation.error!.code,
            message: configValidation.error!.message,
          },
        };
      }
    }

    if (data.keyterms !== undefined) {
      const keytermsValidation = validateKeyterms(data.keyterms);
      if (!keytermsValidation.valid) {
        return {
          error: {
            code: keytermsValidation.error!.code,
            message: keytermsValidation.error!.message,
          },
        };
      }
    }

    // Validate meeting type ID if provided
    if (data.meetingTypeId !== undefined) {
      const meetingTypeIdValidation = validateMeetingTypeId(data.meetingTypeId);
      if (!meetingTypeIdValidation.valid) {
        return {
          error: {
            code: meetingTypeIdValidation.error!.code,
            message: meetingTypeIdValidation.error!.message,
          },
        };
      }

      // Verify meeting type exists
      const meetingType = await prisma.meetingType.findUnique({
        where: { id: data.meetingTypeId },
        select: { id: true, name: true },
      });

      if (!meetingType) {
        return {
          error: {
            code: SCENARIO_ERROR_CODES.MEETING_TYPE_NOT_FOUND,
            message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.MEETING_TYPE_NOT_FOUND],
          },
        };
      }
    }

    // Build update data
    const updateData: {
      meetingTypeId?: string;
      name?: string;
      systemPrompt?: string;
      outputSchema?: unknown;
      artifactsConfig?: unknown;
      keyterms?: string[];
      isActive?: boolean;
      version?: number;
      updatedByUserId: string;
    } = {
      updatedByUserId,
    };

    if (data.meetingTypeId !== undefined) {
      updateData.meetingTypeId = data.meetingTypeId;
    }
    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }
    if (data.systemPrompt !== undefined) {
      updateData.systemPrompt = data.systemPrompt.trim();
    }
    if (data.outputSchema !== undefined) {
      updateData.outputSchema = data.outputSchema;
    }
    if (data.artifactsConfig !== undefined) {
      updateData.artifactsConfig = data.artifactsConfig;
    }
    if (data.keyterms !== undefined) {
      // Normalize keyterms: trim, remove empty strings, remove duplicates
      updateData.keyterms = Array.from(
        new Set(
          data.keyterms
            .map((k) => k.trim())
            .filter((k) => k.length > 0)
        )
      );
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    // Increment version if systemPrompt, outputSchema, or artifactsConfig changed
    if (data.systemPrompt !== undefined || data.outputSchema !== undefined || data.artifactsConfig !== undefined) {
      updateData.version = currentScenario.version + 1;
    }

    // Update scenario
    const updatedScenario = await prisma.promptScenario.update({
      where: { id: scenarioId },
      data: updateData,
      select: {
        id: true,
        meetingTypeId: true,
        meetingType: {
          select: { name: true },
        },
        name: true,
        systemPrompt: true,
        outputSchema: true,
        artifactsConfig: true,
        keyterms: true,
        isActive: true,
        version: true,
        updatedAt: true,
        updatedByUserId: true,
        updatedByUser: {
          select: { name: true },
        },
      },
    });

    return {
      data: {
        id: updatedScenario.id,
        meetingTypeId: updatedScenario.meetingTypeId,
        meetingTypeName: updatedScenario.meetingType.name,
        name: updatedScenario.name,
        systemPrompt: updatedScenario.systemPrompt,
        outputSchema: updatedScenario.outputSchema,
        artifactsConfig: updatedScenario.artifactsConfig,
        keyterms: updatedScenario.keyterms,
        isActive: updatedScenario.isActive,
        version: updatedScenario.version,
        updatedAt: updatedScenario.updatedAt.toISOString(),
        updatedByUserId: updatedScenario.updatedByUserId,
        updatedByUserName: updatedScenario.updatedByUser.name,
      },
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update scenario',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Get scenario by ID
 */
export async function getScenarioById(
  scenarioId: string
): Promise<{ data: ScenarioResponse } | { error: ScenarioServiceError }> {
  // Validate scenario ID
  const idValidation = validateScenarioId(scenarioId);
  if (!idValidation.valid) {
    return {
      error: {
        code: idValidation.error!.code,
        message: idValidation.error!.message,
      },
    };
  }

  try {
    const scenario = await prisma.promptScenario.findUnique({
      where: { id: scenarioId },
      select: {
        id: true,
        meetingTypeId: true,
        meetingType: {
          select: { name: true },
        },
        name: true,
        systemPrompt: true,
        outputSchema: true,
        artifactsConfig: true,
        keyterms: true,
        isActive: true,
        version: true,
        updatedAt: true,
        updatedByUserId: true,
        updatedByUser: {
          select: { name: true },
        },
      },
    });

    if (!scenario) {
      return {
        error: {
          code: SCENARIO_ERROR_CODES.SCENARIO_NOT_FOUND,
          message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.SCENARIO_NOT_FOUND],
        },
      };
    }

    return {
      data: {
        id: scenario.id,
        meetingTypeId: scenario.meetingTypeId,
        meetingTypeName: scenario.meetingType.name,
        name: scenario.name,
        systemPrompt: scenario.systemPrompt,
        outputSchema: scenario.outputSchema,
        artifactsConfig: scenario.artifactsConfig,
        keyterms: scenario.keyterms,
        isActive: scenario.isActive,
        version: scenario.version,
        updatedAt: scenario.updatedAt.toISOString(),
        updatedByUserId: scenario.updatedByUserId,
        updatedByUserName: scenario.updatedByUser.name,
      },
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch scenario',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Get paginated list of scenarios
 */
export async function getScenarios(
  params: ScenariosQueryParams
): Promise<{ data: import('./types').ScenariosListResponse } | { error: ScenarioServiceError }> {
  // Validate pagination
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

  try {
    // Build where clause
    const where: {
      meetingTypeId?: string;
      isActive?: boolean;
      OR?: Array<{
        name?: { contains: string; mode: 'insensitive' };
      }>;
    } = {};

    if (params.filter?.meetingTypeId) {
      where.meetingTypeId = params.filter.meetingTypeId;
    }

    if (params.filter?.isActive !== undefined) {
      where.isActive = params.filter.isActive;
    }

    if (params.filter?.search) {
      const searchTerm = params.filter.search.trim();
      where.OR = [{ name: { contains: searchTerm, mode: 'insensitive' } }];
    }

    // Get total count and scenarios in parallel
    const [total, scenarios] = await Promise.all([
      prisma.promptScenario.count({ where }),
      prisma.promptScenario.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: {
          updatedAt: 'desc',
        },
        select: {
          id: true,
          meetingTypeId: true,
          meetingType: {
            select: { name: true },
          },
          name: true,
          systemPrompt: true,
          outputSchema: true,
          artifactsConfig: true,
          keyterms: true,
          isActive: true,
          version: true,
          updatedAt: true,
          updatedByUserId: true,
          updatedByUser: {
            select: { name: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: {
        items: scenarios.map((scenario) => ({
          id: scenario.id,
          meetingTypeId: scenario.meetingTypeId,
          meetingTypeName: scenario.meetingType.name,
          name: scenario.name,
          systemPrompt: scenario.systemPrompt,
          outputSchema: scenario.outputSchema,
          artifactsConfig: scenario.artifactsConfig,
          keyterms: scenario.keyterms,
          isActive: scenario.isActive,
          version: scenario.version,
          updatedAt: scenario.updatedAt.toISOString(),
          updatedByUserId: scenario.updatedByUserId,
          updatedByUserName: scenario.updatedByUser.name,
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
        message: 'Failed to fetch scenarios',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Delete scenario (soft delete via isActive)
 */
export async function deleteScenario(
  scenarioId: string,
  userRole: UserRole
): Promise<{ data: { success: boolean } } | { error: ScenarioServiceError }> {
  // Check admin access
  const accessCheck = checkAdminAccess(userRole);
  if (!accessCheck.allowed) {
    return { error: accessCheck.error! };
  }

  // Validate scenario ID
  const idValidation = validateScenarioId(scenarioId);
  if (!idValidation.valid) {
    return {
      error: {
        code: idValidation.error!.code,
        message: idValidation.error!.message,
      },
    };
  }

  try {
    // Check if scenario is in use
    const meetingsCount = await prisma.meeting.count({
      where: { scenarioId },
    });

    if (meetingsCount > 0) {
      return {
        error: {
          code: SCENARIO_ERROR_CODES.SCENARIO_IN_USE,
          message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.SCENARIO_IN_USE],
          details: { meetingsCount },
        },
      };
    }

    // Hard delete - physically remove from database
    await prisma.promptScenario.delete({
      where: { id: scenarioId },
    });

    return {
      data: { success: true },
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete scenario',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Get all meeting types
 */
export async function getMeetingTypes(
  params?: MeetingTypesQueryParams
): Promise<{ data: MeetingTypeResponse[] } | { error: ScenarioServiceError }> {
  try {
    const where: { isActive?: boolean } = {};

    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    const meetingTypes = await prisma.meetingType.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        isActive: true,
        _count: {
          select: {
            meetings: true,
          },
        },
      },
    });

    return {
      data: meetingTypes.map((mt) => ({
        id: mt.id,
        name: mt.name,
        isActive: mt.isActive,
        scenariosCount: mt._count.meetings,
      })),
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch meeting types',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Get meeting type by ID
 */
export async function getMeetingTypeById(
  meetingTypeId: string
): Promise<{ data: MeetingTypeResponse } | { error: ScenarioServiceError }> {
  // Validate meeting type ID
  const idValidation = validateMeetingTypeId(meetingTypeId);
  if (!idValidation.valid) {
    return {
      error: {
        code: idValidation.error!.code,
        message: idValidation.error!.message,
      },
    };
  }

  try {
    const meetingType = await prisma.meetingType.findUnique({
      where: { id: meetingTypeId },
      select: {
        id: true,
        name: true,
        isActive: true,
        _count: {
          select: {
            meetings: true,
          },
        },
      },
    });

    if (!meetingType) {
      return {
        error: {
          code: SCENARIO_ERROR_CODES.MEETING_TYPE_NOT_FOUND,
          message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.MEETING_TYPE_NOT_FOUND],
        },
      };
    }

    // Get users with access
    const usersWithAccess = await prisma.user.findMany({
      where: {
        availableMeetingTypes: {
          some: {
            meetingTypeId: meetingType.id,
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    return {
      data: {
        id: meetingType.id,
        name: meetingType.name,
        isActive: meetingType.isActive,
        scenariosCount: meetingType._count.meetings,
        users: usersWithAccess,
      },
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch meeting type',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Create meeting type
 */
export async function createMeetingType(
  data: CreateMeetingTypeRequest,
  userRole: UserRole
): Promise<{ data: MeetingTypeResponse } | { error: ScenarioServiceError }> {
  // Check admin access
  const accessCheck = checkAdminAccess(userRole);
  if (!accessCheck.allowed) {
    return { error: accessCheck.error! };
  }

  // Validate name
  const nameValidation = validateMeetingTypeName(data.name);
  if (!nameValidation.valid) {
    return {
      error: {
        code: nameValidation.error!.code,
        message: nameValidation.error!.message,
      },
    };
  }

  try {
    const meetingTypeId = await generateShortId('meeting_type');
    
    // Create meeting type with user access in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const meetingType = await tx.meetingType.create({
        data: {
          id: meetingTypeId,
          name: data.name.trim(),
          isActive: data.isActive ?? true,
        },
        select: {
          id: true,
          name: true,
          isActive: true,
          _count: {
            select: {
              meetings: true,
            },
          },
        },
      });

      // Create user access records if userIds provided
      if (data.userIds && data.userIds.length > 0) {
        // Validate that all users exist
        const users = await tx.user.findMany({
          where: {
            id: { in: data.userIds },
            isActive: true,
          },
          select: { id: true },
        });

        if (users.length !== data.userIds.length) {
          throw new Error('Some users not found or inactive');
        }

        // Create UserMeetingType records
        await tx.userMeetingType.createMany({
          data: data.userIds.map((userId) => ({
            userId,
            meetingTypeId: meetingType.id,
          })),
          skipDuplicates: true,
        });
      }

      return meetingType;
    });

    // Get users with access for response
    const usersWithAccess = await prisma.user.findMany({
      where: {
        availableMeetingTypes: {
          some: {
            meetingTypeId: result.id,
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    return {
      data: {
        id: result.id,
        name: result.name,
        isActive: result.isActive,
        scenariosCount: result._count.meetings,
        users: usersWithAccess,
      },
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create meeting type',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Update meeting type
 */
export async function updateMeetingType(
  meetingTypeId: string,
  data: UpdateMeetingTypeRequest,
  userRole: UserRole
): Promise<{ data: MeetingTypeResponse } | { error: ScenarioServiceError }> {
  // Check admin access
  const accessCheck = checkAdminAccess(userRole);
  if (!accessCheck.allowed) {
    return { error: accessCheck.error! };
  }

  // Validate meeting type ID
  const idValidation = validateMeetingTypeId(meetingTypeId);
  if (!idValidation.valid) {
    return {
      error: {
        code: idValidation.error!.code,
        message: idValidation.error!.message,
      },
    };
  }

  // Validate name if provided
  if (data.name !== undefined) {
    const nameValidation = validateMeetingTypeName(data.name);
    if (!nameValidation.valid) {
      return {
        error: {
          code: nameValidation.error!.code,
          message: nameValidation.error!.message,
        },
      };
    }
  }

  try {
    // Update meeting type and user access in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const updateData: {
        name?: string;
        isActive?: boolean;
      } = {};

      if (data.name !== undefined) {
        updateData.name = data.name.trim();
      }
      if (data.isActive !== undefined) {
        updateData.isActive = data.isActive;
      }

      const meetingType = await tx.meetingType.update({
        where: { id: meetingTypeId },
        data: updateData,
        select: {
          id: true,
          name: true,
          isActive: true,
          _count: {
            select: {
              meetings: true,
            },
          },
        },
      });

      // Update user access if userIds provided
      if (data.userIds !== undefined) {
        // Remove all existing user access
        await tx.userMeetingType.deleteMany({
          where: { meetingTypeId: meetingTypeId },
        });

        // Add new user access if provided
        if (data.userIds.length > 0) {
          // Validate that all users exist
          const users = await tx.user.findMany({
            where: {
              id: { in: data.userIds },
              isActive: true,
            },
            select: { id: true },
          });

          if (users.length !== data.userIds.length) {
            throw new Error('Some users not found or inactive');
          }

          // Create UserMeetingType records
          await tx.userMeetingType.createMany({
            data: data.userIds.map((userId) => ({
              userId,
              meetingTypeId: meetingType.id,
            })),
            skipDuplicates: true,
          });
        }
      }

      return meetingType;
    });

    // Get users with access for response
    const usersWithAccess = await prisma.user.findMany({
      where: {
        availableMeetingTypes: {
          some: {
            meetingTypeId: result.id,
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    return {
      data: {
        id: result.id,
        name: result.name,
        isActive: result.isActive,
        scenariosCount: result._count.meetings,
        users: usersWithAccess,
      },
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update meeting type',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Delete meeting type (soft delete)
 */
export async function deleteMeetingType(
  meetingTypeId: string,
  userRole: UserRole
): Promise<{ data: { success: boolean } } | { error: ScenarioServiceError }> {
  // Check admin access
  const accessCheck = checkAdminAccess(userRole);
  if (!accessCheck.allowed) {
    return { error: accessCheck.error! };
  }

  // Validate meeting type ID
  const idValidation = validateMeetingTypeId(meetingTypeId);
  if (!idValidation.valid) {
    return {
      error: {
        code: idValidation.error!.code,
        message: idValidation.error!.message,
      },
    };
  }

  try {
    // Check if meeting type is in use (has meetings or scenarios)
    const [meetingsCount, scenariosCount, userMeetingTypesCount] = await Promise.all([
      prisma.meeting.count({
        where: { meetingTypeId },
      }),
      prisma.promptScenario.count({
        where: { meetingTypeId },
      }),
      prisma.userMeetingType.count({
        where: { meetingTypeId },
      }),
    ]);

    if (meetingsCount > 0 || scenariosCount > 0) {
      return {
        error: {
          code: SCENARIO_ERROR_CODES.MEETING_TYPE_IN_USE,
          message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.MEETING_TYPE_IN_USE],
          details: { meetingsCount, scenariosCount },
        },
      };
    }

    // Delete UserMeetingType associations first (they have foreign key constraint)
    if (userMeetingTypesCount > 0) {
      await prisma.userMeetingType.deleteMany({
        where: { meetingTypeId },
      });
    }

    // Hard delete - physically remove from database
    await prisma.meetingType.delete({
      where: { id: meetingTypeId },
    });

    return {
      data: { success: true },
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete meeting type',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

