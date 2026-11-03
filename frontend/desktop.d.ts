import type { MessagingAPI } from '../shared/messaging';
import type { SalesforcePreviewAPI } from '../shared/salesforce-preview';
import type { CadenceAPI } from '../shared/cadences';
import type { JobsAPI } from '../shared/jobs';
declare global {
  interface Window {
    villageDesktop?: { version: string; messaging: MessagingAPI; cadences: CadenceAPI; jobs: JobsAPI; salesforcePreview: SalesforcePreviewAPI };
  }
}
