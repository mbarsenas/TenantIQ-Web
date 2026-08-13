type DeliveryMail = {
  to: string;
  edition: string;
  licenseId: string;
  claimUrl: string;
  claimExpiresAt: string;
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

async function getGraphToken() {
  const tenantId = required('TENANTIQ_GRAPH_TENANT_ID');
  const clientId = required('TENANTIQ_GRAPH_CLIENT_ID');
  const clientSecret = required('TENANTIQ_GRAPH_CLIENT_SECRET');

  const body = new URLSearchParams();
  body.set('client_id', clientId);
  body.set('client_secret', clientSecret);
  body.set('scope', 'https://graph.microsoft.com/.default');
  body.set('grant_type', 'client_credentials');

  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      cache: 'no-store',
    },
  );

  const data = await response.json();
  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || `Microsoft identity token request failed (${response.status}).`);
  }

  return String(data.access_token);
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
  const from = required('TENANTIQ_GRAPH_FROM_EMAIL');
  const token = await getGraphToken();

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: 'Your TenantIQ license is ready',
          body: {
            contentType: 'HTML',
            content: buildDeliveryHtml(mail),
          },
          toRecipients: [
            {
              emailAddress: { address: mail.to },
            },
          ],
        },
        saveToSentItems: true,
      }),
      cache: 'no-store',
    },
  );

  if (response.status !== 202) {
    const body = await response.text();
    throw new Error(`Microsoft Graph sendMail failed (${response.status}): ${body.slice(0, 500)}`);
  }
}
