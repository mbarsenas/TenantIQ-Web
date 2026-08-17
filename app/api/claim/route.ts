import { createHash, createHmac } from 'crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DOWNLOAD_MINUTES = 10;
const R2_REGION = 'auto';
const R2_SERVICE = 's3';

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function hmac(key: Buffer | string, value: string) {
  return createHmac('sha256', key).update(value, 'utf8').digest();
}

function maskEmail(email: string | null | undefined) {
  if (!email || !email.includes('@')) return null;
  const [local, domain] = email.split('@');
  const visible = local.length <= 2 ? local[0] ?? '*' : local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

function awsEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function canonicalObjectPath(bucket: string, objectKey: string) {
  const encodedBucket = awsEncode(bucket);
  const encodedKey = objectKey.split('/').map(awsEncode).join('/');
  return `/${encodedBucket}/${encodedKey}`;
}

function amzTimestamp(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function createR2ReadUrl(
  accountId: string,
  accessKeyId: string,
  secretAccessKey: string,
  bucket: string,
  objectKey: string,
) {
  const now = new Date();
  const amzDate = amzTimestamp(now);
  const dateStamp = amzDate.slice(0, 8);
  const expiresSeconds = DOWNLOAD_MINUTES * 60;
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = canonicalObjectPath(bucket, objectKey);
  const credentialScope = `${dateStamp}/${R2_REGION}/${R2_SERVICE}/aws4_request`;

  const query = new Map<string, string>([
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Content-Sha256', 'UNSIGNED-PAYLOAD'],
    ['X-Amz-Credential', `${accessKeyId}/${credentialScope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(expiresSeconds)],
    ['X-Amz-SignedHeaders', 'host'],
  ]);

  const canonicalQuery = [...query.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${awsEncode(key)}=${awsEncode(value)}`)
    .join('&');

  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [
    'GET',
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, R2_REGION);
  const kService = hmac(kRegion, R2_SERVICE);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  const finalQuery = `${canonicalQuery}&X-Amz-Signature=${signature}`;
  return {
    url: `https://${host}${canonicalUri}?${finalQuery}`,
    expiresAt: new Date(now.getTime() + expiresSeconds * 1000).toISOString(),
  };
}

async function stripeGet(path: string, secretKey: string, query?: URLSearchParams) {
  const url = new URL(`https://api.stripe.com/v1/${path}`);
  if (query) url.search = query.toString();

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${secretKey}` },
    cache: 'no-store',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `Stripe API request failed (${response.status}).`);
  }
  return data;
}

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    return NextResponse.json({ error: 'Claim service is not configured.' }, { status: 503 });
  }

  let body: { token?: string; subscriptionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const token = body.token?.trim();
  if (!token || token.length < 20 || token.length > 256) {
    return NextResponse.json({ error: 'Invalid claim token.' }, { status: 400 });
  }

  const tokenHash = sha256(token);
  const subscriptionId = body.subscriptionId?.trim();

  if (subscriptionId && !/^sub_[A-Za-z0-9]+$/.test(subscriptionId)) {
    return NextResponse.json({ error: 'Invalid subscription reference.' }, { status: 400 });
  }

  try {
    let subscription;

    if (subscriptionId) {
      // Direct retrieval is read-after-write consistent. Stripe's Search API is
      // eventually consistent and can reject a valid link immediately after a
      // new package is fulfilled.
      subscription = await stripeGet(`subscriptions/${encodeURIComponent(subscriptionId)}`, secretKey);
      if (subscription?.metadata?.tenantiq_claim_token_sha256 !== tokenHash) {
        return NextResponse.json({ error: 'Claim link is invalid or no longer active.' }, { status: 404 });
      }
    } else {
      // Backward compatibility for previously issued token-only claim links.
      const search = new URLSearchParams();
      search.set('query', `metadata['tenantiq_claim_token_sha256']:'${tokenHash}'`);
      search.set('limit', '2');
      const result = await stripeGet('subscriptions/search', secretKey, search);
      const matches = Array.isArray(result?.data) ? result.data : [];

      if (matches.length !== 1) {
        return NextResponse.json({ error: 'Claim link is invalid or no longer active.' }, { status: 404 });
      }
      subscription = matches[0];
    }
    const metadata = subscription.metadata ?? {};
    const expiryRaw = metadata.tenantiq_claim_expires_at;
    const expiry = expiryRaw ? new Date(expiryRaw) : null;

    if (!['active', 'trialing'].includes(subscription.status)) {
      return NextResponse.json({ error: 'The related TenantIQ subscription is not active.' }, { status: 403 });
    }
    if (metadata.tenantiq_fulfillment_status !== 'license_issued') {
      return NextResponse.json({ error: 'License issuance is not complete.' }, { status: 409 });
    }
    if (!['package_ready', 'download_ready'].includes(metadata.tenantiq_delivery_status)) {
      return NextResponse.json({ error: 'The customer package is not ready.' }, { status: 409 });
    }
    if (!expiry || Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'This claim link has expired.' }, { status: 410 });
    }

    let downloadUrl: string | null = null;
    let downloadExpiresAt: string | null = null;
    let message = 'Your TenantIQ package is verified. Private download publishing is still pending.';

    if (metadata.tenantiq_delivery_status === 'download_ready') {
      const accountId = process.env.TENANTIQ_R2_ACCOUNT_ID?.trim();
      const accessKeyId = process.env.TENANTIQ_R2_ACCESS_KEY_ID?.trim();
      const secretAccessKey = process.env.TENANTIQ_R2_SECRET_ACCESS_KEY?.trim();
      const configuredBucket = process.env.TENANTIQ_R2_BUCKET?.trim() || 'tenantiq-deliveries';
      const storageProvider = metadata.tenantiq_storage_provider;
      const storageBucket = metadata.tenantiq_storage_bucket;
      const storageObject = metadata.tenantiq_storage_object;

      if (!accountId || !accessKeyId || !secretAccessKey) {
        return NextResponse.json({ error: 'Private R2 download storage is not configured on the TenantIQ site.' }, { status: 503 });
      }
      if (
        storageProvider !== 'cloudflare_r2' ||
        storageBucket !== configuredBucket ||
        !storageObject ||
        typeof storageObject !== 'string' ||
        !storageObject.startsWith('deliveries/')
      ) {
        console.error('[TenantIQ claim] Stripe R2 metadata does not match configured private storage.', {
          storageProvider,
          storageBucket,
          storageObject: Boolean(storageObject),
        });
        return NextResponse.json({ error: 'Private package storage metadata is invalid.' }, { status: 409 });
      }

      const signed = createR2ReadUrl(
        accountId,
        accessKeyId,
        secretAccessKey,
        configuredBucket,
        storageObject,
      );
      downloadUrl = signed.url;
      downloadExpiresAt = signed.expiresAt;
      message = `Your TenantIQ package is verified and ready. The download link below is valid for ${DOWNLOAD_MINUTES} minutes.`;
    }

    return NextResponse.json({
      valid: true,
      deliveryId: metadata.tenantiq_delivery_id ?? null,
      edition: metadata.tenantiq_edition ?? metadata.edition ?? null,
      licenseId: metadata.tenantiq_license_id ?? null,
      domain: metadata.tenantiq_license_domain ?? null,
      maxTenants: Number(metadata.tenantiq_max_tenants ?? 0),
      expiresAt: metadata.tenantiq_license_expires_at ?? null,
      claimExpiresAt: expiry.toISOString(),
      customerEmail: maskEmail(metadata.tenantiq_customer_email ?? null),
      downloadAvailable: Boolean(downloadUrl),
      downloadUrl,
      downloadExpiresAt,
      deliverySha256: metadata.tenantiq_delivery_sha256 ?? null,
      message,
    });
  } catch (error) {
    console.error('[TenantIQ claim] Validation failed:', error);
    return NextResponse.json({ error: 'Unable to validate this claim right now.' }, { status: 502 });
  }
}
