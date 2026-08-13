# TenantIQ Web

Dedicated Next.js application for **TenantIQ365.com**.

The website was separated from the TenantIQ PowerShell assessment repository so web deployment, Stripe checkout, customer fulfillment, and future website releases can be managed independently from the validated assessment engine.

## Local development

```powershell
npm install
npm run dev
```

Production validation:

```powershell
npm run build
npm start
```

## Environment variables

```text
NEXT_PUBLIC_SITE_URL=https://tenantiq365.com
RESEND_API_KEY=
EARLY_ACCESS_TO_EMAIL=
EARLY_ACCESS_FROM_EMAIL=
TENANTIQ_DELIVERY_FROM_EMAIL=TenantIQ <licenses@tenantiq365.com>

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
TENANTIQ_FULFILLMENT_API_KEY=

TENANTIQ_R2_ACCOUNT_ID=
TENANTIQ_R2_ACCESS_KEY_ID=
TENANTIQ_R2_SECRET_ACCESS_KEY=
TENANTIQ_R2_BUCKET=tenantiq-deliveries
```

`RESEND_API_KEY` is used for transactional mail. `TENANTIQ_DELIVERY_FROM_EMAIL` must use a sender address on a domain verified in Resend before production delivery.

`TENANTIQ_FULFILLMENT_API_KEY` is a separate high-entropy bearer secret used only by the trusted TenantIQ fulfillment worker when a licensed package has finished publishing to private R2 storage.

## Automated delivery email

After the fulfillment worker has generated the license, built and uploaded the customer ZIP, generated the TenantIQ `/claim?token=...` URL, and updated the Stripe subscription metadata to `license_issued` + `download_ready`, it calls:

```text
POST /api/fulfillment/delivery-email
Authorization: Bearer <TENANTIQ_FULFILLMENT_API_KEY>
Content-Type: application/json
```

```json
{
  "subscriptionId": "sub_...",
  "claimUrl": "https://tenantiq365.com/claim?token=..."
}
```

The endpoint re-reads the Stripe subscription as the source of truth, verifies the license/R2/claim metadata, prevents duplicate sends through Stripe delivery-email state, and sends the customer the secure TenantIQ claim URL through Resend. It also supplies a deterministic Resend `Idempotency-Key` for the license delivery request. The email never exposes the private R2 object URL.

## Resend setup

1. Create a Resend account.
2. Add and verify `tenantiq365.com` in Resend using the DNS records Resend provides.
3. Create a Resend API key and store it as `RESEND_API_KEY` on the TenantIQ host.
4. Set `TENANTIQ_DELIVERY_FROM_EMAIL`, for example `TenantIQ <licenses@tenantiq365.com>`.
5. Send a test email before enabling the Stripe fulfillment handoff.

No Exchange Online mailbox or Microsoft Graph application is required for this delivery path.

## Product baseline

TenantIQ v1.0 currently represents **416 registered controls across 8 Microsoft 365 workloads**.

## Deployment

Production host: GoDaddy Node.js hosting.

Expected deployment source:

```text
Repository: mbarsenas/TenantIQ-Web
Branch:     main
Runtime:    Node.js 22
```

## Migration note

The application source has been moved into this repository. Large image/PDF assets are temporarily served from the original public TenantIQ repository until their binary files are copied into this repository. Do not remove the original `public` assets until the migration and GoDaddy cutover have been validated.
