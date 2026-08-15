export const TENANTIQ_WORKLOADS = [
  { key: 'entra', label: 'Entra ID', slug: 'entra' },
  { key: 'exchange', label: 'Exchange Online', slug: 'exchange' },
  { key: 'sharepoint', label: 'SharePoint Online', slug: 'sharepoint' },
  { key: 'teams', label: 'Teams', slug: 'teams' },
  { key: 'onedrive', label: 'OneDrive', slug: 'onedrive' },
  { key: 'intune', label: 'Intune', slug: 'intune' },
  { key: 'defender', label: 'Defender', slug: 'defender' },
  { key: 'purview', label: 'Microsoft Purview', slug: 'purview' },
] as const;

export type TenantIQWorkloadKey = (typeof TENANTIQ_WORKLOADS)[number]['key'];
export type TenantIQWorkloadLabel = (typeof TENANTIQ_WORKLOADS)[number]['label'];

function normalized(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[._]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function hasToken(value: string, token: string) {
  return (`-${value}-`).includes(`-${token}-`);
}

export function tenantIQWorkloadKey(value: string): TenantIQWorkloadKey | '' {
  const name = normalized(value);

  if (
    name.includes('exchange-online') ||
    name.includes('exchangeonline') ||
    hasToken(name, 'exchange') ||
    hasToken(name, 'exo')
  ) return 'exchange';

  if (
    name.includes('entra-id') ||
    name.includes('entraid') ||
    hasToken(name, 'entra') ||
    name.includes('azure-ad') ||
    name.includes('azuread') ||
    name.includes('aad')
  ) return 'entra';

  if (
    name.includes('sharepoint-online') ||
    name.includes('sharepointonline') ||
    hasToken(name, 'sharepoint') ||
    hasToken(name, 'spo')
  ) return 'sharepoint';

  if (
    name.includes('microsoft-teams') ||
    name.includes('microsoftteams') ||
    hasToken(name, 'teams') ||
    hasToken(name, 'team')
  ) return 'teams';

  if (
    name.includes('one-drive') ||
    name.includes('onedrive') ||
    hasToken(name, 'od')
  ) return 'onedrive';

  if (
    hasToken(name, 'intune') ||
    name.includes('endpoint-manager') ||
    name.includes('endpointmanager') ||
    name.includes('mem-intune')
  ) return 'intune';

  if (
    hasToken(name, 'defender') ||
    name.includes('microsoft-defender') ||
    name.includes('microsoftdefender') ||
    hasToken(name, 'mdo') ||
    hasToken(name, 'mde') ||
    hasToken(name, 'mdatp')
  ) return 'defender';

  if (
    hasToken(name, 'purview') ||
    name.includes('microsoft-purview') ||
    name.includes('microsoftpurview') ||
    name.includes('compliance-center') ||
    name.includes('compliancecenter')
  ) return 'purview';

  return '';
}

export function tenantIQWorkloadLabel(value: string, fallback = 'TenantIQ assessment'): TenantIQWorkloadLabel | string {
  const key = tenantIQWorkloadKey(value);
  return TENANTIQ_WORKLOADS.find((item) => item.key === key)?.label || fallback;
}

export function tenantIQKnowledgeHref(value: string) {
  const key = tenantIQWorkloadKey(value);
  const workload = TENANTIQ_WORKLOADS.find((item) => item.key === key);
  return workload ? `/knowledge/${workload.slug}` : '/knowledge';
}
