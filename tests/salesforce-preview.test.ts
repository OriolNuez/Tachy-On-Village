import { describe, expect, it } from 'vitest';
import { approvedPreviewURL, previewHost, territoryURL } from '../electron/salesforce-policy';
describe('Salesforce preview navigation policy', () => {
  it('allows only exact approved HTTPS origins', () => {
    expect(approvedPreviewURL(territoryURL)).toBe(true);
    expect(approvedPreviewURL('https://w3id.sso.ibm.com/auth')).toBe(true);
    for (const url of ['http://ibmsc.lightning.force.com/', 'https://ibmsc.lightning.force.com.evil.test/', 'https://evil.test/', 'https://other.salesforce.com/', 'https://w3id.sso.ibm.com:444/', 'https://user:secret@w3id.sso.ibm.com/', 'file:///tmp/test', 'javascript:alert(1)', 'data:text/html,test']) expect(approvedPreviewURL(url), url).toBe(false);
  });
  it('reports only hostnames, never auth paths or query tokens', () => {
    expect(previewHost('https://login.ibm.com/callback?token=secret#private')).toBe('login.ibm.com');
    expect(previewHost('bad url')).toBe('invalid destination');
  });
});
