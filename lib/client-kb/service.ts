/**
 * Client KB Module Service
 * Business logic for client operations
 */

import { ClientResponse, CreateClientRequest, UpdateClientRequest, ClientDetailResponse, TransferClientOwnershipRequest } from './dto';
import { PaginationParams, PaginatedResponse } from './types';
import { validateClientName, validateClientId, validatePaginationParams } from './validation';
import { CLIENT_KB_ERROR_CODES, CLIENT_KB_ERROR_MESSAGES, CLIENT_KB_CONSTANTS } from './constants';
import { prisma } from '../prisma';
import { generateShortId } from '../db/id-generator';
import { UserRole, PrismaClientKnownRequestError } from '@prisma/client';

export interface ClientServiceError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Create a new client
 */
export async function createClient(
  data: CreateClientRequest,
  createdByUserId: string
): Promise<{ data: ClientResponse } | { error: ClientServiceError }> {
  // Validate client name
  const nameValidation = validateClientName(data.name);
  if (!nameValidation.valid) {
    return {
      error: {
        code: nameValidation.error!.code,
        message: nameValidation.error!.message,
      },
    };
  }

  const trimmedName = data.name.trim();

  // Check if client with this name already exists
  // Note: We check by name since there's no unique constraint on name in DB
  // This is a business logic check to prevent duplicates
  try {
    const existingClient = await prisma.client.findFirst({
      where: {
        name: trimmedName,
        createdByUserId, // Only check for clients created by the same user
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (existingClient) {
      return {
        error: {
          code: CLIENT_KB_ERROR_CODES.CLIENT_ALREADY_EXISTS,
          message: CLIENT_KB_ERROR_MESSAGES[CLIENT_KB_ERROR_CODES.CLIENT_ALREADY_EXISTS],
          details: { clientId: existingClient.id },
        },
      };
    }
  } catch (checkError) {
    // If check fails, continue with creation attempt
    // The actual create will handle any real errors
    logger.error('Error checking for existing client', checkError);
  }

  // Generate client ID
  let clientId: string;
  try {
    clientId = await generateShortId('client');
  } catch (idError) {
    logger.error('Error generating client ID', idError);
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate client ID',
        details: { 
          originalError: idError instanceof Error ? idError.message : 'Unknown error',
          errorType: 'ID_GENERATION_ERROR'
        },
      },
    };
  }

  // Create client
  try {
    const client = await prisma.client.create({
      data: {
        id: clientId,
        name: trimmedName,
        createdByUserId,
      },
      select: {
        id: true,
        name: true,
        clientContextSummaryMd: true,
        createdAt: true,
        createdByUserId: true,
        updatedAt: true,
      },
    });

    return {
      data: {
        id: client.id,
        name: client.name,
        contextSummary: client.clientContextSummaryMd,
        createdAt: client.createdAt.toISOString(),
        createdByUserId: client.createdByUserId,
        updatedAt: client.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    logger.error('Error creating client', error);
    
    // Handle Prisma errors properly
    if (error instanceof PrismaClientKnownRequestError) {
      // P2002 = Unique constraint violation (e.g., duplicate ID)
      if (error.code === 'P2002') {
        logger.warn('Duplicate ID detected, syncing counter and retrying...');
        // Sync counter with existing data to avoid duplicate IDs
        try {
          const { syncCounterWithExistingData } = await import('../db/id-generator');
          await syncCounterWithExistingData('client');
        } catch (syncError) {
          logger.error('Error syncing counter', syncError);
        }
        
        // Try to regenerate ID and retry once
        try {
          const retryClientId = await generateShortId('client');
          const client = await prisma.client.create({
            data: {
              id: retryClientId,
              name: trimmedName,
              createdByUserId,
            },
            select: {
              id: true,
              name: true,
              clientContextSummaryMd: true,
              createdAt: true,
              createdByUserId: true,
              updatedAt: true,
            },
          });

          return {
            data: {
              id: client.id,
              name: client.name,
              contextSummary: client.clientContextSummaryMd,
              createdAt: client.createdAt.toISOString(),
              createdByUserId: client.createdByUserId,
              updatedAt: client.updatedAt.toISOString(),
            },
          };
        } catch (retryError) {
          logger.error('Error on retry', retryError);
          // If retry also fails, return error
          return {
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to create client after retry',
              details: { 
                originalError: error.message,
                originalCode: error.code,
                retryError: retryError instanceof Error ? retryError.message : 'Unknown error',
                retryErrorType: retryError instanceof PrismaClientKnownRequestError ? retryError.code : 'UNKNOWN'
              },
            },
          };
        }
      }
      
      // P2003 = Foreign key constraint violation (e.g., invalid createdByUserId)
      if (error.code === 'P2003') {
        return {
          error: {
            code: CLIENT_KB_ERROR_CODES.USER_NOT_FOUND,
            message: CLIENT_KB_ERROR_MESSAGES[CLIENT_KB_ERROR_CODES.USER_NOT_FOUND],
            details: { originalError: error.message },
          },
        };
      }

      // Other Prisma known errors
      return {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create client',
          details: { 
            originalError: error.message,
            errorCode: error.code,
            errorType: 'PRISMA_ERROR'
          },
        },
      };
    }

    // For other errors (not Prisma errors)
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create client',
        details: { 
          originalError: error instanceof Error ? error.message : 'Unknown error',
          errorType: 'UNKNOWN_ERROR',
          errorStack: error instanceof Error ? error.stack : undefined
        },
      },
    };
  }
}

/**
 * Get client by ID
 */
export async function getClientById(
  clientId: string,
  userId: string,
  userRole: UserRole
): Promise<{ data: ClientResponse } | { error: ClientServiceError }> {
  // Validate client ID format
  const idValidation = validateClientId(clientId);
  if (!idValidation.valid) {
    return {
      error: {
        code: idValidation.error!.code,
        message: idValidation.error!.message,
      },
    };
  }

  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        clientContextSummaryMd: true,
        createdAt: true,
        createdByUserId: true,
        updatedAt: true,
      },
    });

    if (!client) {
      return {
        error: {
          code: CLIENT_KB_ERROR_CODES.CLIENT_NOT_FOUND,
          message: CLIENT_KB_ERROR_MESSAGES[CLIENT_KB_ERROR_CODES.CLIENT_NOT_FOUND],
        },
      };
    }

    // Check ownership
    if (client.createdByUserId !== userId) {
      return {
        error: {
          code: CLIENT_KB_ERROR_CODES.UNAUTHORIZED_ACCESS,
          message: CLIENT_KB_ERROR_MESSAGES[CLIENT_KB_ERROR_CODES.UNAUTHORIZED_ACCESS],
        },
      };
    }

    return {
      data: {
        id: client.id,
        name: client.name,
        contextSummary: client.clientContextSummaryMd,
        createdAt: client.createdAt.toISOString(),
        createdByUserId: client.createdByUserId,
        updatedAt: client.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch client',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Get client detail by ID (with additional info like meetings count)
 */
export async function getClientDetail(
  clientId: string,
  userId: string,
  userRole: UserRole
): Promise<{ data: ClientDetailResponse } | { error: ClientServiceError }> {
  // Validate client ID format
  const idValidation = validateClientId(clientId);
  if (!idValidation.valid) {
    return {
      error: {
        code: idValidation.error!.code,
        message: idValidation.error!.message,
      },
    };
  }

  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        clientContextSummaryMd: true,
        createdAt: true,
        createdByUserId: true,
        updatedAt: true,
        createdByUser: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            meetings: true,
          },
        },
      },
    });

    if (!client) {
      return {
        error: {
          code: CLIENT_KB_ERROR_CODES.CLIENT_NOT_FOUND,
          message: CLIENT_KB_ERROR_MESSAGES[CLIENT_KB_ERROR_CODES.CLIENT_NOT_FOUND],
        },
      };
    }

    // Check ownership (Admin has access to all clients)
    if (userRole !== 'ADMIN' && client.createdByUserId !== userId) {
      return {
        error: {
          code: CLIENT_KB_ERROR_CODES.UNAUTHORIZED_ACCESS,
          message: CLIENT_KB_ERROR_MESSAGES[CLIENT_KB_ERROR_CODES.UNAUTHORIZED_ACCESS],
        },
      };
    }

    return {
      data: {
        id: client.id,
        name: client.name,
        contextSummary: client.clientContextSummaryMd,
        createdAt: client.createdAt.toISOString(),
        createdByUserId: client.createdByUserId,
        updatedAt: client.updatedAt.toISOString(),
        meetingsCount: client._count.meetings,
        createdByUserName: client.createdByUser.name,
      },
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch client details',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Get paginated list of clients
 */
export async function getClients(
  params: PaginationParams = {},
  userId: string,
  userRole: UserRole
): Promise<{ data: PaginatedResponse<ClientResponse> } | { error: ClientServiceError }> {
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
  const searchTerm = params.search?.trim();

  try {
    // Build where clause for search and ownership filter
    // Admin can see all clients, regular users only their own
    const where: {
      createdByUserId?: string;
      name?: {
        contains: string;
        mode: 'insensitive';
      };
    } = {};

    // For non-admin users, filter by owner
    if (userRole !== 'ADMIN') {
      where.createdByUserId = userId;
    }

    // Add search filter if provided
    if (searchTerm) {
      where.name = {
        contains: searchTerm,
        mode: 'insensitive' as const,
      };
    }

    // Get total count and clients in parallel
    const [total, clients] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: {
          updatedAt: 'desc',
        },
        select: {
          id: true,
          name: true,
          clientContextSummaryMd: true,
          createdAt: true,
          createdByUserId: true,
          updatedAt: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: {
        items: clients.map((client) => ({
          id: client.id,
          name: client.name,
          contextSummary: client.clientContextSummaryMd,
          createdAt: client.createdAt.toISOString(),
          createdByUserId: client.createdByUserId,
          updatedAt: client.updatedAt.toISOString(),
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
        message: 'Failed to fetch clients',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Update client
 */
export async function updateClient(
  clientId: string,
  data: UpdateClientRequest,
  userId: string,
  userRole: UserRole
): Promise<{ data: ClientResponse } | { error: ClientServiceError }> {
  // Validate client ID format
  const idValidation = validateClientId(clientId);
  if (!idValidation.valid) {
    return {
      error: {
        code: idValidation.error!.code,
        message: idValidation.error!.message,
      },
    };
  }

  // Validate client name if provided
  if (data.name !== undefined) {
    const nameValidation = validateClientName(data.name);
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
    // Check if client exists
    const existingClient = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!existingClient) {
      return {
        error: {
          code: CLIENT_KB_ERROR_CODES.CLIENT_NOT_FOUND,
          message: CLIENT_KB_ERROR_MESSAGES[CLIENT_KB_ERROR_CODES.CLIENT_NOT_FOUND],
        },
      };
    }

    // Check ownership (Admin can update any client)
    if (userRole !== 'ADMIN' && existingClient.createdByUserId !== userId) {
      return {
        error: {
          code: CLIENT_KB_ERROR_CODES.UNAUTHORIZED_ACCESS,
          message: CLIENT_KB_ERROR_MESSAGES[CLIENT_KB_ERROR_CODES.UNAUTHORIZED_ACCESS],
        },
      };
    }

    // Build update data object
    const updateData: {
      name?: string;
      clientContextSummaryMd?: string | null;
    } = {};

    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }

    if (data.contextSummary !== undefined) {
      updateData.clientContextSummaryMd = data.contextSummary.trim() || null;
    }

    // Update client
    const client = await prisma.client.update({
      where: { id: clientId },
      data: updateData,
      select: {
        id: true,
        name: true,
        clientContextSummaryMd: true,
        createdAt: true,
        createdByUserId: true,
        updatedAt: true,
      },
    });

    return {
      data: {
        id: client.id,
        name: client.name,
        contextSummary: client.clientContextSummaryMd,
        createdAt: client.createdAt.toISOString(),
        createdByUserId: client.createdByUserId,
        updatedAt: client.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update client',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Transfer client ownership to another user (only owner or admin can do this)
 * Also transfers ownership of all meetings associated with this client
 */
export async function transferClientOwnership(
  clientId: string,
  data: TransferClientOwnershipRequest,
  currentOwnerUserId: string,
  userRole: UserRole
): Promise<{ success: true } | { error: ClientServiceError }> {
  // Validate client ID format
  const idValidation = validateClientId(clientId);
  if (!idValidation.valid) {
    return {
      error: {
        code: idValidation.error!.code,
        message: idValidation.error!.message,
      },
    };
  }

  // Cannot transfer to self
  if (data.newOwnerUserId === currentOwnerUserId) {
    return {
      error: {
        code: CLIENT_KB_ERROR_CODES.CANNOT_TRANSFER_TO_SELF,
        message: CLIENT_KB_ERROR_MESSAGES[CLIENT_KB_ERROR_CODES.CANNOT_TRANSFER_TO_SELF],
      },
    };
  }

  try {
    // Verify client exists and check ownership
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        createdByUserId: true,
      },
    });

    if (!client) {
      return {
        error: {
          code: CLIENT_KB_ERROR_CODES.CLIENT_NOT_FOUND,
          message: CLIENT_KB_ERROR_MESSAGES[CLIENT_KB_ERROR_CODES.CLIENT_NOT_FOUND],
        },
      };
    }

    // Check ownership (Admin can transfer any client)
    if (userRole !== 'ADMIN' && client.createdByUserId !== currentOwnerUserId) {
      return {
        error: {
          code: CLIENT_KB_ERROR_CODES.UNAUTHORIZED_ACCESS,
          message: CLIENT_KB_ERROR_MESSAGES[CLIENT_KB_ERROR_CODES.UNAUTHORIZED_ACCESS],
        },
      };
    }

    // Verify new owner exists
    const newOwner = await prisma.user.findUnique({
      where: { id: data.newOwnerUserId },
      select: { id: true },
    });

    if (!newOwner) {
      return {
        error: {
          code: CLIENT_KB_ERROR_CODES.USER_NOT_FOUND,
          message: CLIENT_KB_ERROR_MESSAGES[CLIENT_KB_ERROR_CODES.USER_NOT_FOUND],
        },
      };
    }

    // Transfer ownership in transaction
    await prisma.$transaction(async (tx) => {
      // Update client owner
      await tx.client.update({
        where: { id: clientId },
        data: {
          createdByUserId: data.newOwnerUserId,
        },
      });

      // Update owner for all meetings associated with this client
      await tx.meeting.updateMany({
        where: {
          clientId: clientId,
        },
        data: {
          ownerUserId: data.newOwnerUserId,
        },
      });
    });

    return { success: true };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to transfer ownership',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

