/**
 * API Route: Register
 * POST /api/auth/register
 */

import { NextRequest } from 'next/server';
import { CommonErrors } from '@/lib/api/response-utils';

export async function POST(request: NextRequest) {
  return CommonErrors.forbidden('Registration is disabled. Please contact administrator.');
}

