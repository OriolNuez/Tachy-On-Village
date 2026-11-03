export const territoryURL = 'https://ibmsc.lightning.force.com/lightning/n/TerritoryProspecting';
// Exact hosts only. New federation hosts require review, never automatic approval.
export const previewHosts = new Set([
  'ibmsc.lightning.force.com', 'ibmsc.my.salesforce.com', 'login.salesforce.com',
  'w3id.sso.ibm.com', 'login.w3.ibm.com', 'login.ibm.com',
]);
export function approvedPreviewURL(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && previewHosts.has(url.hostname);
  } catch { return false; }
}
export function previewHost(value: string): string {
  try { return new URL(value).hostname || 'unknown destination'; } catch { return 'invalid destination'; }
}
