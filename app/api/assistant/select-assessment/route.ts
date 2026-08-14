import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedCustomerId } from '../../../../lib/tenantiq-auth';

const COOKIE_NAME = 'tenantiq_selected_assessment';
const QUESTION_COOKIE = 'tenantiq_prefill_question';

function publicUrl(request: NextRequest, pathname: string) {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
  if (configured) return new URL(pathname, `${configured}/`);

  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) return new URL(pathname, `${forwardedProto}://${forwardedHost}`);

  return new URL(pathname, request.url);
}

export async function GET(request: NextRequest) {
  try {
    await getAuthenticatedCustomerId();
  } catch {
    return NextResponse.redirect(publicUrl(request, '/signin'));
  }

  const assessmentId = String(request.nextUrl.searchParams.get('assessment') || '').trim();
  const question = String(request.nextUrl.searchParams.get('question') || '').trim();
  const response = NextResponse.redirect(publicUrl(request, '/assistant'));

  if (assessmentId) {
    response.cookies.set(COOKIE_NAME, assessmentId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 30,
    });
  }

  if (question) {
    response.cookies.set(QUESTION_COOKIE, question.slice(0, 1800), {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 5,
    });
  }

  return response;
}
