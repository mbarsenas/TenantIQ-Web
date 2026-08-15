import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/product', '/details', '/pricing', '/security', '/privacy', '/terms', '/signin', '/signup'],
      disallow: [
        '/workspace',
        '/assessments',
        '/assistant',
        '/knowledge',
        '/workflow',
        '/account',
        '/license-required',
        '/claim',
        '/reset-password',
        '/forgot-password',
        '/api/',
      ],
    },
    sitemap: 'https://tenantiq365.com/sitemap.xml',
    host: 'https://tenantiq365.com',
  };
}
