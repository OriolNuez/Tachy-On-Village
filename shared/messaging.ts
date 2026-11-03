import type { Result } from './cadences';
export interface MessageTemplate { filename: string; body: string; subject?: string }
export interface MessagingAPI {
  list(): Promise<Result<string[]>>;
  read(filename: string): Promise<Result<MessageTemplate>>;
}
export const messagingChannels = { list: 'messaging:list', read: 'messaging:read' } as const;
