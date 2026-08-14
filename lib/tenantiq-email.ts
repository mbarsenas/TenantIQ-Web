const resendApiKey = process.env.RESEND_API_KEY?.trim();
const fromEmail = process.env.TENANTIQ_DELIVERY_FROM_EMAIL?.trim() || 'TenantIQ <licenses@tenantiq365.com>';
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000').replace(/\/$/, '');

async function sendEmail(to: string, subject: string, html: string) {
  if (!resendApiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RESEND_API_KEY is required to send TenantIQ authentication emails in production.');
    }
    return false;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: fromEmail, to: [to], subject, html }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`TenantIQ email delivery failed: ${response.status} ${detail}`);
  }

  return true;
}

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${siteUrl}/verify-email?token=${encodeURIComponent(token)}`;
  return sendEmail(
    email,
    'Verify your TenantIQ email',
    `<p>Verify your TenantIQ account email address.</p><p><a href="${url}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
  );
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${siteUrl}/reset-password?token=${encodeURIComponent(token)}`;
  return sendEmail(
    email,
    'Reset your TenantIQ password',
    `<p>A password reset was requested for your TenantIQ account.</p><p><a href="${url}">Reset password</a></p><p>This link expires in 60 minutes. If you did not request this, you can ignore this message.</p>`,
  );
}
