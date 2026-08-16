const required = [
  'NEXT_PUBLIC_SITE_URL',
  'RESEND_API_KEY',
  'TENANTIQ_DELIVERY_FROM_EMAIL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'TENANTIQ_FULFILLMENT_API_KEY',
  'TENANTIQ_GITHUB_TOKEN',
];

let failed = false;

function pass(message) {
  console.log(`[PASS] ${message}`);
}

function fail(message) {
  failed = true;
  console.error(`[FAIL] ${message}`);
}

console.log('TenantIQ launch environment gate');
console.log('================================');

for (const name of required) {
  if (String(process.env[name] || '').trim()) pass(`${name} is configured`);
  else fail(`${name} is missing`);
}

const siteUrl = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim();
if (siteUrl) {
  try {
    const url = new URL(siteUrl);
    if (url.protocol !== 'https:') fail('NEXT_PUBLIC_SITE_URL must use HTTPS for production');
    else pass('NEXT_PUBLIC_SITE_URL uses HTTPS');

    if (url.hostname !== 'tenantiq365.com') {
      fail(`NEXT_PUBLIC_SITE_URL points to ${url.hostname}, expected tenantiq365.com`);
    } else {
      pass('NEXT_PUBLIC_SITE_URL points to tenantiq365.com');
    }
  } catch {
    fail('NEXT_PUBLIC_SITE_URL is not a valid URL');
  }
}

const stripeSecret = String(process.env.STRIPE_SECRET_KEY || '').trim();
if (stripeSecret) {
  try {
    const response = await fetch('https://api.stripe.com/v1/account', {
      headers: { Authorization: `Bearer ${stripeSecret}` },
    });

    if (response.ok) {
      const account = await response.json();
      pass(`Stripe API key is valid for account ${account.id || '(unknown id)'}`);
    } else {
      const body = await response.json().catch(() => ({}));
      const code = body?.error?.code || body?.error?.type || `HTTP ${response.status}`;
      fail(`Stripe API key validation failed (${code})`);
    }
  } catch (error) {
    fail(`Stripe API validation could not run: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

const githubToken = String(process.env.TENANTIQ_GITHUB_TOKEN || '').trim();
const repository = String(process.env.TENANTIQ_FULFILLMENT_REPOSITORY || 'mbarsenas/TenantIQ').trim();
const workflow = String(process.env.TENANTIQ_FULFILLMENT_WORKFLOW || 'fulfill-order.yml').trim();
if (githubToken) {
  try {
    const response = await fetch(`https://api.github.com/repos/${repository}/actions/workflows/${encodeURIComponent(workflow)}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubToken}`,
        'User-Agent': 'TenantIQ-Launch-Gate',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (response.ok) pass(`GitHub fulfillment workflow is reachable: ${repository}/${workflow}`);
    else fail(`GitHub fulfillment workflow validation failed (HTTP ${response.status})`);
  } catch (error) {
    fail(`GitHub fulfillment validation could not run: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

if (failed) {
  console.error('\nTenantIQ launch environment FAILED.');
  process.exit(1);
}

console.log('\nTenantIQ launch environment PASSED.');
