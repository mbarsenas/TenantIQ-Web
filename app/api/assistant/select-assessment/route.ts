import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedCustomerId } from '../../../../lib/tenantiq-auth';

const COOKIE_NAME = 'tenantiq_selected_assessment';

export async function GET(request: NextRequest) {
  try {
    await getAuthenticatedCustomerId();
  } catch {
    return NextResponse.redirect(new URL('/signin', request.url));
  }

  const assessmentId = String(request.nextUrl.searchParams.get('assessment') || '').trim();
  const response = NextResponse.redirect(new URL('/assistant', request.url));
  if (assessmentId) {
    response.cookies.set(COOKIE_NAME, assessmentId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 30,
    });
  }
  return response;
}
