export interface SalesforcePreviewAPI {
  open(): Promise<void>;
  close(): Promise<void>;
  status(): Promise<string>;
  openChrome(): Promise<string>;
}
export const previewChannels = { open: 'preview:open', close: 'preview:close', status: 'preview:status', chrome: 'preview:chrome' } as const;
