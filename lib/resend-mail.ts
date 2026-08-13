type DeliveryMail = {
  to: string;
  edition: string;
  licenseId: string;
  claimUrl: string;
  claimExpiresAt: string;
  idempotencyKey: string;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatUtcDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function buildDeliveryHtml(mail: DeliveryMail) {
  const edition = escapeHtml(mail.edition);
  const licenseId = escapeHtml(mail.licenseId);
  const claimUrl = escapeHtml(mail.claimUrl);
  const expires = escapeHtml(formatUtcDate(mail.claimExpiresAt));

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f7f6;font-family:Arial,Helvetica,sans-serif;color:#17211d;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f6;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #dfe7e3;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 12px;font-size:24px;font-weight:700;">TenantIQ</td>
            </tr>
            <tr>
              <td style="padding:8px 32px 28px;">
                <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;">Your TenantIQ license is ready</h1>
                <p style="margin:0 0 16px;line-height:1.6;">Thank you for purchasing TenantIQ ${edition}.</p>
                <p style="margin:0 0 24px;line-height:1.6;">Your personalized TenantIQ package has been generated and licensed for your organization.</p>
                <p style="margin:0 0 28px;">
                  <a href="${claimUrl}" style="display:inline-block;background:#123d31;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:8px;">Download TenantIQ</a>
                </p>
                <p style="margin:0 0 20px;line-height:1.6;">This secure claim link expires on <strong>${expires}</strong>. The actual R2 download URL is generated only after the claim is validated and is short-lived.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;background:#f7faf8;border-radius:8px;margin:0 0 24px;">
                  <tr><td style="padding:14px 16px 6px;font-size:13px;color:#65736c;">License ID</td></tr>
                  <tr><td style="padding:0 16px 10px;font-weight:700;">${licenseId}</td></tr>
                  <tr><td style="padding:4px 16px 6px;font-size:13px;color:#65736c;">Edition</td></tr>
                  <tr><td style="padding:0 16px 14px;font-weight:700;">${edition}</td></tr>
                </table>
                <p style="margin:0;line-height:1.6;color:#52615a;">Need help? Visit TenantIQ Support at <a href="https://tenantiq365.com" style="color:#123d31;">tenantiq365.com</a>.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendTenantIQDeliveryEmail(mail: DeliveryMail) {
  const apiKey = required('RESEND_API_KEY');
  const from = required('TENANTIQ_DELIVERY_FROM_EMAIL');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': mail.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [mail.to],
      subject: 'Your TenantIQ license is ready',
      html: buildDeliveryHtml(mail),
    }),
    cache: 'no-store',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.id) {
    const detail = data?.message || data?.name || JSON.stringify(data).slice(0, 500);
    throw new Error(`Resend email request failed (${response.status}): ${detail}`);
  }

  return String(data.id);
}
