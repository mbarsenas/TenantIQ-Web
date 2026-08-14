export type KnowledgeControl = {
  id: string;
  title: string;
  category: string;
  sourceFile: string;
};

export type KnowledgeWorkload = {
  slug: string;
  name: string;
  description: string;
  controls: KnowledgeControl[];
};

const categoryNames: Record<string, string> = {
  ac: 'Access Control', app: 'Applications', aud: 'Audit', auto: 'Automation', cert: 'Certificates',
  cfg: 'Configuration', ch: 'Channels', class: 'Classification', cloud: 'Cloud Apps', cm: 'Compliance Management',
  comm: 'Communication Compliance', comp: 'Compliance', dev: 'Devices', dlp: 'Data Loss Prevention', edisc: 'eDiscovery',
  email: 'Email Security', end: 'Endpoint Security', enr: 'Enrollment', ext: 'External Access', gov: 'Governance',
  guest: 'Guest Access', hunt: 'Hunting', ib: 'Information Barriers', id: 'Identity', int: 'Integrations', ip: 'Information Protection',
  ir: 'Insider Risk', lc: 'Lifecycle', lic: 'Licensing', mtg: 'Meetings', ops: 'Operations', post: 'Security Posture',
  rec: 'Records & Recovery', sec: 'Security', shr: 'Sharing', site: 'Sites', stor: 'Storage', sync: 'Sync', team: 'Teams',
  ten: 'Tenant Configuration', win: 'Windows', msg: 'Messaging', adm: 'Administration', alt: 'Alerts',
};

function titleCase(value: string) {
  return value.split('-').map((word) => {
    const upper = word.toUpperCase();
    if (['MFA','DLP','DMARC','DKIM','SMTP','EDR','AIR','IOS','MDM','LAPS'].includes(upper)) return upper;
    if (upper === 'ONEDRIVE') return 'OneDrive';
    if (upper === 'SHAREPOINT') return 'SharePoint';
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

function parseControl(file: string): KnowledgeControl | null {
  const base = file.replace(/\.md$/i, '');
  const match = base.match(/^(.*?)-((?:od|spo|teams|intune|def|pur)-([a-z]+)-\d{3})$/i);
  if (!match) return null;
  return {
    title: titleCase(match[1]),
    id: match[2].toUpperCase(),
    category: categoryNames[match[3].toLowerCase()] || titleCase(match[3]),
    sourceFile: file,
  };
}

function controls(files: string[]) {
  return files.map(parseControl).filter((item): item is KnowledgeControl => Boolean(item));
}

export const knowledgeWorkloads: KnowledgeWorkload[] = [
  {
    slug: 'onedrive', name: 'OneDrive', description: 'Sharing, access, sync, lifecycle, recovery, storage, and governance controls.',
    controls: controls([
      'anyone-link-exposure-od-shr-001.md','app-only-authentication-od-sec-001.md','block-sync-on-unmanaged-devices-od-sync-001.md','conditional-access-alignment-od-ac-001.md','default-sharing-links-od-shr-002.md','deleted-user-retention-coverage-od-lc-001.md','device-compliance-alignment-od-ac-002.md','dlp-coverage-od-comp-001.md','download-restrictions-od-ac-003.md','ediscovery-readiness-od-comp-006.md','external-user-expiration-od-shr-003.md','file-restore-readiness-od-rec-001.md','files-on-demand-configuration-od-sync-002.md','former-employee-onedrives-od-lc-002.md','guest-resharing-od-shr-004.md','high-storage-consumers-od-stor-001.md','inactive-onedrive-sites-od-lc-003.md','information-barriers-integration-od-comp-002.md','known-folder-move-adoption-od-ops-001.md','known-folder-move-readiness-od-sync-003.md','legacy-authentication-od-sec-002.md','malware-and-infected-file-controls-od-sec-003.md','mfa-access-alignment-od-ac-004.md','onedrive-admin-notifications-od-ops-002.md','onedrive-external-sharing-od-shr-005.md','onedrive-governance-summary-od-gov-001.md','onedrive-license-coverage-od-lic-001.md','onedrive-ownership-coverage-od-site-001.md','onedrive-retention-od-lc-004.md','onedrive-security-baseline-od-sec-004.md','onedrive-service-health-readiness-od-ops-003.md','onedrive-site-inventory-od-site-002.md','onedrive-storage-defaults-od-stor-002.md','onedrive-usage-trends-od-ops-004.md','orphaned-onedrive-sites-od-lc-005.md','personal-vault-governance-od-sec-005.md','ransomware-recovery-posture-od-sec-006.md','records-management-integration-od-comp-003.md','recycle-bin-retention-od-rec-002.md'
    ])
  },
  {
    slug: 'sharepoint', name: 'SharePoint Online', description: 'Sharing, sites, lifecycle, apps, governance, compliance, and access controls.',
    controls: controls([
      'add-in-retirement-readiness-spo-app-001.md','app-catalog-configuration-spo-app-002.md','app-only-authentication-spo-ac-001.md','automatic-version-trimming-spo-cm-001.md','conditional-access-integration-spo-ac-002.md','custom-script-settings-spo-sec-001.md','deleted-site-retention-spo-lc-001.md','domain-restricted-sync-spo-ac-003.md','external-sharing-security-groups-spo-shr-004.md','external-sharing-spo-shr-003.md','hub-site-association-coverage-spo-site-001.md','hub-site-configuration-spo-site-002.md','idle-session-sign-out-spo-ac-004.md','inactive-sites-spo-site-003.md','information-barriers-integration-spo-comp-001.md','large-list-threshold-risk-spo-cm-002.md','legacy-authentication-spo-ac-005.md','m365-group-guest-membership-spo-shr-007.md','m365-group-site-ownership-spo-site-004.md','onedrive-retention-configuration-spo-od-001.md','onedrive-sharing-alignment-spo-od-002.md','orphaned-group-connected-sites-spo-site-005.md','records-management-integration-spo-comp-002.md','restricted-content-discovery-spo-sec-002.md','sharepoint-governance-summary-spo-gov-001.md','site-access-restrictions-spo-ac-006.md','site-classification-spo-gov-002.md','site-collection-administrator-coverage-spo-site-006.md','site-collection-app-catalogs-spo-app-003.md','site-creation-controls-spo-gov-003.md','site-external-sharing-spo-shr-009.md','site-inventory-spo-site-007.md','site-lifecycle-policies-spo-lc-002.md','site-lock-state-spo-site-008.md'
    ])
  },
  {
    slug: 'teams', name: 'Teams', description: 'Meetings, messaging, guest access, apps, channels, devices, governance, and compliance controls.',
    controls: controls([
      'anonymous-meeting-join-teams-mtg-001.md','archived-teams-teams-lc-001.md','channel-ownership-and-membership-teams-ch-001.md','custom-app-upload-teams-app-001.md','external-access-federation-teams-ext-001.md','external-meeting-access-teams-mtg-002.md','external-shared-channel-access-teams-ch-002.md','guest-access-configuration-teams-guest-001.md','guest-calling-controls-teams-guest-002.md','guest-meeting-controls-teams-guest-003.md','guest-membership-in-teams-teams-team-001.md','guest-messaging-controls-teams-guest-004.md','inactive-teams-teams-lc-002.md','information-barriers-for-teams-teams-comp-001.md','meeting-app-permissions-teams-mtg-003.md','meeting-chat-controls-teams-mtg-004.md','meeting-lobby-configuration-teams-mtg-005.md','meeting-recording-controls-teams-mtg-006.md','meeting-transcription-controls-teams-mtg-007.md','ownerless-teams-teams-team-002.md','private-channel-inventory-teams-ch-003.md','shared-channel-inventory-teams-ch-004.md','single-owner-teams-teams-team-003.md','teams-app-inventory-teams-app-002.md','teams-app-permission-policies-teams-app-003.md','teams-app-setup-policies-teams-app-004.md','teams-audit-configuration-teams-sec-001.md','teams-device-compliance-teams-dev-001.md','teams-devices-inventory-teams-dev-002.md','teams-dlp-integration-teams-comp-002.md','teams-ediscovery-readiness-teams-comp-005.md','teams-expiration-alignment-teams-lc-003.md','teams-governance-summary-teams-gov-001.md','teams-meeting-policies-teams-mtg-008.md','teams-messaging-policies-teams-msg-001.md','teams-ownership-coverage-teams-team-004.md','teams-phone-device-configuration-teams-dev-003.md','teams-retention-integration-teams-comp-003.md','teams-rooms-configuration-teams-dev-004.md'
    ])
  },
  {
    slug: 'intune', name: 'Intune', description: 'Enrollment, compliance, endpoint security, applications, configuration, devices, and Windows controls.',
    controls: controls([
      'account-protection-policies-intune-sec-001.md','android-compliance-policies-intune-comp-001.md','android-enrollment-intune-enr-001.md','antivirus-policies-intune-sec-002.md','app-configuration-policies-intune-app-001.md','app-protection-policies-intune-app-002.md','apple-enrollment-intune-enr-002.md','application-control-policies-intune-sec-003.md','attack-surface-reduction-intune-sec-004.md','autopilot-deployment-profiles-intune-win-001.md','autopilot-esp-configuration-intune-win-002.md','bitlocker-configuration-intune-sec-005.md','certificate-profiles-intune-cert-001.md','compliance-grace-periods-intune-comp-002.md','conditional-access-integration-intune-comp-003.md','corporate-device-identifiers-intune-enr-003.md','device-configuration-profiles-intune-cfg-001.md','device-inventory-intune-dev-001.md','devices-without-primary-user-intune-dev-002.md','disk-encryption-policies-intune-sec-006.md','duplicate-device-records-intune-dev-003.md','endpoint-security-policies-intune-sec-007.md','enrollment-device-limits-intune-enr-004.md','enrollment-restrictions-intune-enr-005.md','failed-application-deployments-intune-app-003.md','feature-update-policies-intune-win-003.md','filevault-configuration-intune-sec-008.md','firewall-policies-intune-sec-009.md','intune-governance-summary-intune-gov-001.md','intune-security-baseline-summary-intune-sec-010.md','intune-tenant-configuration-intune-ten-001.md','ios-compliance-policies-intune-comp-006.md','local-admin-password-solution-intune-sec-011.md','macos-compliance-policies-intune-comp-007.md','managed-app-inventory-intune-app-004.md','mdm-authority-intune-ten-002.md','noncompliant-device-actions-intune-comp-004.md','noncompliant-devices-intune-dev-004.md','quality-update-policies-intune-win-004.md','required-application-deployment-intune-app-005.md'
    ])
  },
  {
    slug: 'defender', name: 'Defender', description: 'Email protection, endpoint security, identity protection, incidents, hunting, automation, and cloud controls.',
    controls: controls([
      'advanced-hunting-readiness-def-hunt-001.md','air-pending-actions-def-auto-001.md','alert-policies-def-alert-001.md','anti-malware-policies-def-email-001.md','anti-phishing-policies-def-email-002.md','anti-spam-policies-def-email-003.md','attack-surface-reduction-def-end-001.md','automated-investigation-configuration-def-auto-002.md','campaign-view-readiness-def-email-004.md','cloud-delivered-protection-def-end-002.md','cloud-discovery-coverage-def-cloud-001.md','compromised-user-signals-def-id-001.md','custom-detection-rules-def-hunt-002.md','defender-for-cloud-apps-integration-def-cloud-002.md','defender-for-endpoint-onboarding-def-end-003.md','defender-for-identity-sensor-health-def-id-002.md','defender-for-office-365-licensing-def-lic-001.md','defender-governance-summary-def-gov-001.md','defender-integration-coverage-def-int-001.md','defender-security-baseline-def-post-001.md','defender-tenant-configuration-def-ten-001.md','device-isolation-readiness-def-end-004.md','edr-in-block-mode-def-end-005.md','email-authentication-findings-def-email-005.md','endpoint-sensor-health-def-end-006.md','endpoint-tamper-protection-def-end-007.md','identity-alerts-def-id-003.md','incident-queue-health-def-alert-002.md','lateral-movement-paths-def-id-004.md','microsoft-secure-score-def-post-002.md','network-protection-def-end-008.md','oauth-app-risk-def-cloud-003.md','preset-security-policies-def-email-006.md','quarantine-policies-def-email-007.md','safe-attachments-policies-def-email-008.md','safe-links-policies-def-email-009.md','secure-score-improvement-actions-def-post-003.md','suppression-rules-def-alert-003.md','tenant-allow-block-list-def-email-010.md','threat-analytics-access-def-hunt-003.md'
    ])
  },
  {
    slug: 'purview', name: 'Microsoft Purview', description: 'Audit, information protection, DLP, records, eDiscovery, insider risk, and compliance controls.',
    controls: controls([
      'adaptive-policy-scopes-pur-lc-001.md','audit-configuration-pur-aud-001.md','audit-retention-policies-pur-aud-002.md','audit-search-readiness-pur-aud-003.md','auto-labeling-policies-pur-ip-001.md','communication-compliance-alerts-pur-comm-001.md','communication-compliance-policies-pur-comm-002.md','compliance-manager-assessments-pur-cm-001.md','compliance-score-pur-cm-002.md','container-sensitivity-labels-pur-ip-002.md','content-search-readiness-pur-edisc-001.md','custom-sensitive-information-types-pur-class-001.md','data-classification-coverage-pur-class-002.md','data-explorer-readiness-pur-class-003.md','default-sensitivity-labels-pur-ip-003.md','disposition-review-pur-rec-001.md','dlp-alerts-pur-dlp-001.md','dlp-policies-pur-dlp-002.md','dlp-policy-mode-pur-dlp-003.md','ediscovery-cases-pur-edisc-002.md','ediscovery-holds-pur-edisc-003.md','encryption-settings-pur-ip-004.md','endpoint-dlp-configuration-pur-dlp-004.md','endpoint-dlp-devices-pur-dlp-005.md','event-based-retention-pur-rec-002.md','exact-data-match-configuration-pur-class-004.md','exchange-dlp-coverage-pur-dlp-006.md','information-barriers-policies-pur-ib-001.md','information-barriers-segments-pur-ib-002.md','insider-risk-alerts-pur-ir-001.md','insider-risk-policies-pur-ir-002.md','onedrive-dlp-coverage-pur-dlp-007.md','privileged-purview-roles-pur-adm-001.md','purview-alerts-and-incidents-pur-alt-001.md','purview-governance-summary-pur-gov-001.md','purview-security-baseline-pur-gov-002.md','record-labels-pur-rec-003.md','records-management-configuration-pur-rec-004.md','regulatory-record-labels-pur-rec-005.md'
    ])
  },
];

export function getKnowledgeWorkload(slug: string) {
  return knowledgeWorkloads.find((item) => item.slug === slug.toLowerCase());
}

export function getKnowledgeControl(workloadSlug: string, controlSlug: string) {
  const workload = getKnowledgeWorkload(workloadSlug);
  if (!workload) return null;
  return workload.controls.find((item) => item.id.toLowerCase() === controlSlug.toLowerCase()) || null;
}
