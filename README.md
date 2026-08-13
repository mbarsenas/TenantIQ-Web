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
```

Stripe test-mode environment variables will be added when the checkout flow is implemented.

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
