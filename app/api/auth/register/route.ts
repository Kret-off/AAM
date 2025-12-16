/**
 * API Route: Register
 * POST /api/auth/register
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: {
        code: 'REGISTRATION_DISABLED',
        message: 'Registration is disabled. Please contact administrator.',
      },
    },
    { status: 403 }
  );
}

