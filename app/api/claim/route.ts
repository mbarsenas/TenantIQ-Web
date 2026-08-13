import { createHash, createHmac } from 'crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SAS_VERSION = '2023-11-03';
const DOWNLOAD_MINUTES = 10;

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function maskEmail(email: string | null | undefined) {
  if (!email || !email.includes('@')) return null;
  const [local, domain] = email.split('@');
  const visible = local.length <= 2 ? local[0] ?? '*' : local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

function isoSeconds(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function safeDownloadName(blobName: string) {
  const raw = blobName.split('/').pop() || 'TenantIQ.zip';
  return raw.replace(/[\r\n"\\]/g, '-');
}

function createBlobReadSas(account: string, accountKey: string, container: string, blobName: string) {
  const permissions = 'r';
  const startsOn = isoSeconds(new Date(Date.now() - 5 * 60 * 1000));
  const expiresOn = isoSeconds(new Date(Date.now() + DOWNLOAD_MINUTES * 60 * 1000));
  const protocol = 'https';
  const resource = 'b';
  const contentDisposition = `attachment; filename="${safeDownloadName(blobName)}"`;
  const contentType = 'application/zip';
  const canonicalizedResource = `/blob/${account}/${container}/${blobName}`;

  // Azure service SAS string-to-sign for Blob Storage service versions 2020-12-06 and later.
  const stringToSign = [
    permissions,
    startsOn,
    expiresOn,
    canonicalizedResource,
    '', // signedIdentifier
    '', // signedIP
    protocol,
    SAS_VERSION,
    resource,
    '', // signedSnapshotTime
    '', // signedEncryptionScope
    '', // rscc
    contentDisposition,
    '', // rsce
    '', // rscl
    contentType,
  ].join('\n');

  let decodedKey: Buffer;
  try {
    decodedKey = Buffer.from(accountKey, 'base64');
  } catch {
    throw new Error('Azure Storage key is invalid.');
  }
  if (!decodedKey.length) throw new Error('Azure Storage key is invalid.');

  const signature = createHmac('sha256', decodedKey).update(stringToSign, 'utf8').digest('base64');
  const params = new URLSearchParams({
    sp: permissions,
    st: startsOn,
    se: expiresOn,
    spr: protocol,
    sv: SAS_VERSION,
    sr: resource,
    rscd: contentDisposition,
    rsct: contentType,
    sig: signature,
  });

  const encodedBlobPath = blobName.split('/').map(encodeURIComponent).join('/');
  return {
    url: `https://${account}.blob.core.windows.net/${encodeURIComponent(container)}/${encodedBlobPath}?${params.toString()}`,
    expiresAt: expiresOn,
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

  let body: { token?: string };
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
  const search = new URLSearchParams();
  search.set('query', `metadata['tenantiq_claim_token_sha256']:'${tokenHash}'`);
  search.set('limit', '2');

  try {
    const result = await stripeGet('subscriptions/search', secretKey, search);
    const matches = Array.isArray(result?.data) ? result.data : [];

    if (matches.length !== 1) {
      return NextResponse.json({ error: 'Claim link is invalid or no longer active.' }, { status: 404 });
    }

    const subscription = matches[0];
    const metadata = subscription.metadata ?? {};
    const expiryRaw = metadata.tenantiq_claim_expires_at;
    const expiry = expiryRaw ? new Date(expiryRaw) : null;

    if (subscription.status !== 'active') {
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
      const configuredAccount = process.env.TENANTIQ_AZURE_STORAGE_ACCOUNT?.trim();
      const accountKey = process.env.TENANTIQ_AZURE_STORAGE_KEY?.trim();
      const configuredContainer = process.env.TENANTIQ_AZURE_STORAGE_CONTAINER?.trim() || 'tenantiq-deliveries';
      const storageAccount = metadata.tenantiq_storage_account;
      const storageContainer = metadata.tenantiq_storage_container;
      const storageBlob = metadata.tenantiq_storage_blob;

      if (!configuredAccount || !accountKey) {
        return NextResponse.json({ error: 'Private download storage is not configured on the TenantIQ site.' }, { status: 503 });
      }
      if (storageAccount !== configuredAccount || storageContainer !== configuredContainer || !storageBlob) {
        console.error('[TenantIQ claim] Stripe storage metadata does not match configured private storage.', {
          storageAccount,
          storageContainer,
          storageBlob: Boolean(storageBlob),
        });
        return NextResponse.json({ error: 'Private package storage metadata is invalid.' }, { status: 409 });
      }

      const sas = createBlobReadSas(configuredAccount, accountKey, configuredContainer, storageBlob);
      downloadUrl = sas.url;
      downloadExpiresAt = sas.expiresAt;
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
