import {
  knowledgeWorkloads as baseKnowledgeWorkloads,
  type KnowledgeControl,
  type KnowledgeWorkload,
} from './knowledge-catalog';

function control(id: string, title: string, category: string): KnowledgeControl {
  return {
    id,
    title,
    category,
    sourceFile: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${id.toLowerCase()}.md`,
  };
}

const entra: KnowledgeWorkload = {
  slug: 'entra',
  name: 'Entra ID',
  description: 'Identity, authentication, Conditional Access, applications, and governance guidance.',
  controls: [
    control('ENTRA-GOV-001', 'Access Reviews', 'Identity Governance'),
    control('ENTRA-GOV-002', 'Administrative Units', 'Identity Governance'),
    control('ENTRA-APP-001', 'Admin Consent Request Policy', 'Applications'),
    control('ENTRA-APP-002', 'Admin Consent Workflow', 'Applications'),
    control('ENTRA-APP-003', 'App Registrations', 'Applications'),
    control('ENTRA-APP-004', 'Application Credentials', 'Applications'),
    control('ENTRA-APP-006', 'Application Proxy', 'Applications'),
    control('ENTRA-CA-001', 'Authentication Context', 'Conditional Access'),
  ],
};

const exchange: KnowledgeWorkload = {
  slug: 'exchange',
  name: 'Exchange Online',
  description: 'Mail flow, authentication, threat protection, mailbox security, retention, operations, and governance guidance.',
  controls: [
    control('EXO-MF-001', 'Accepted Domains', 'Mail Flow'),
    control('EXO-MF-002', 'Connectors', 'Mail Flow'),
    control('EXO-MF-003', 'DKIM', 'Mail Authentication'),
    control('EXO-MF-004', 'DMARC', 'Mail Authentication'),
    control('EXO-MF-005', 'Remote Domains', 'Mail Flow'),
    control('EXO-MF-006', 'SPF', 'Mail Authentication'),
    control('EXO-MF-007', 'Transport Rules', 'Mail Flow'),
    control('EXO-SEC-001', 'Anti-Spam Policies', 'Security'),
    control('EXO-SEC-002', 'Authentication Policies', 'Authentication'),
    control('EXO-SEC-003', 'External Forwarding', 'Security'),
    control('EXO-SEC-004', 'Mailbox Auditing', 'Security'),
    control('EXO-SEC-005', 'SMTP AUTH', 'Authentication'),
    control('EXO-PROD-001', 'Exchange Bulk Control', 'Operations'),
    control('EXO-TP-001', 'Anti-Phish Policies', 'Threat Protection'),
    control('EXO-TP-002', 'Safe Links Policies', 'Threat Protection'),
    control('EXO-TP-003', 'Safe Attachments Policies', 'Threat Protection'),
    control('EXO-TP-004', 'Quarantine Policies', 'Threat Protection'),
    control('EXO-TP-005', 'Outbound Spam Policies', 'Threat Protection'),
    control('EXO-TP-006', 'Connection Filter Policy', 'Threat Protection'),
    control('EXO-TP-007', 'Malware Filter Policies', 'Threat Protection'),
    control('EXO-TP-008', 'Tenant Allow Block List', 'Threat Protection'),
    control('EXO-COMP-001', 'Journaling Rules', 'Compliance / Retention'),
    control('EXO-COMP-002', 'Retention Policies', 'Compliance / Retention'),
    control('EXO-COMP-003', 'Retention Tags', 'Compliance / Retention'),
    control('EXO-COMP-004', 'Litigation Hold Coverage', 'Compliance / Retention'),
    control('EXO-COMP-005', 'In-Place Hold Coverage', 'Compliance / Retention'),
    control('EXO-COMP-006', 'Mailbox Retention Assignments', 'Compliance / Retention'),
    control('EXO-MBX-001', 'Recoverable Items Quota', 'Mailbox Security'),
    control('EXO-MBX-002', 'Archive Mailbox Coverage', 'Mailbox Security'),
    control('EXO-MBX-003', 'Mailbox Forwarding Rules', 'Mailbox Security'),
    control('EXO-MBX-004', 'Shared Mailbox Sign-In Risk', 'Mailbox Security'),
    control('EXO-OPS-001', 'Mailbox Size Utilization', 'Operations / Hygiene'),
    control('EXO-OPS-002', 'Inactive Mailboxes', 'Operations / Hygiene'),
    control('EXO-OPS-003', 'Distribution Group Governance', 'Operations / Hygiene'),
    control('EXO-OPS-004', 'Dynamic Distribution Groups', 'Operations / Hygiene'),
    control('EXO-OPS-005', 'Mail-Enabled Security Groups', 'Operations / Hygiene'),
    control('EXO-OPS-006', 'Public Folders', 'Operations / Hygiene'),
    control('EXO-OPS-007', 'Mail Contacts', 'Operations / Hygiene'),
    control('EXO-OPS-008', 'Mail Users', 'Operations / Hygiene'),
    control('EXO-OPS-009', 'Focused Inbox Configuration', 'Operations / Hygiene'),
    control('EXO-MF-008', 'Moderated Recipients', 'Mail Flow / Domains'),
    control('EXO-MF-009', 'Message Size Limits', 'Mail Flow / Domains'),
    control('EXO-MF-010', 'External Sender Identification', 'Mail Flow / Domains'),
    control('EXO-MF-011', 'Transport Configuration', 'Transport / Connectors'),
    control('EXO-AUTH-001', 'Modern Authentication Readiness', 'Security / Authentication'),
    control('EXO-AUTH-002', 'Legacy Protocol Exposure', 'Security / Authentication'),
    control('EXO-AUTH-003', 'OAuth Configuration', 'Security / Authentication'),
    control('EXO-GOV-001', 'Organization Configuration', 'Governance / Summary'),
    control('EXO-GOV-002', 'Administrative Role Groups', 'Governance / Summary'),
    control('EXO-GOV-003', 'Exchange Governance Summary', 'Governance / Summary'),
  ],
};

export const knowledgeWorkloads: KnowledgeWorkload[] = [entra, exchange, ...baseKnowledgeWorkloads];

export function getKnowledgeWorkload(slug: string) {
  return knowledgeWorkloads.find((item) => item.slug === slug.toLowerCase());
}

export function getKnowledgeControl(workloadSlug: string, controlSlug: string) {
  const workload = getKnowledgeWorkload(workloadSlug);
  if (!workload) return null;
  return workload.controls.find((item) => item.id.toLowerCase() === controlSlug.toLowerCase()) || null;
}
